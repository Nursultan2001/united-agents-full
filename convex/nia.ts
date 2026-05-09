"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

const NIA_BASE = "https://apigcp.trynia.ai/v2";

function parseRepoUrl(url: string): { owner: string; repo: string } | null {
  // Accept formats:
  //   https://github.com/owner/repo
  //   https://github.com/owner/repo.git
  //   git@github.com:owner/repo.git
  //   owner/repo
  const cleaned = url.trim().replace(/\.git$/, "").replace(/\/$/, "");
  const httpsMatch = cleaned.match(/github\.com[/:]([^/]+)\/([^/]+)$/);
  if (httpsMatch) return { owner: httpsMatch[1], repo: httpsMatch[2] };
  const slashMatch = cleaned.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (slashMatch) return { owner: slashMatch[1], repo: slashMatch[2] };
  return null;
}

type RegisterResult = {
  ok: boolean;
  repository?: string;
  status?: string;
  error?: string;
};

export const registerRepo = action({
  args: { repoUrl: v.string(), branch: v.optional(v.string()) },
  handler: async (_ctx, { repoUrl, branch }): Promise<RegisterResult> => {
    const apiKey = process.env.NIA_API_KEY;
    if (!apiKey) return { ok: false, error: "NIA_API_KEY not configured" };

    const parsed = parseRepoUrl(repoUrl);
    if (!parsed) return { ok: false, error: `Could not parse repo URL: ${repoUrl}` };

    const repository = `${parsed.owner}/${parsed.repo}`;

    try {
      const res = await fetch(`${NIA_BASE}/repositories`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ repository, branch: branch ?? "main" }),
      });

      const text = await res.text();
      if (!res.ok) {
        // 409 conflict = already registered, treat as success
        if (res.status === 409 || /already/i.test(text)) {
          return { ok: true, repository, status: "already_indexed" };
        }
        return { ok: false, error: `Nia ${res.status}: ${text.slice(0, 300)}` };
      }

      const data = JSON.parse(text || "{}") as { status?: string; repository?: string };
      return {
        ok: true,
        repository: data.repository ?? repository,
        status: data.status ?? "indexing",
      };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  },
});

type StatusResult = {
  ok: boolean;
  status?: string;
  progress?: number;
  stage?: string;
  error?: string;
};

export const getIndexStatus = action({
  args: { repository: v.string() },
  handler: async (_ctx, { repository }): Promise<StatusResult> => {
    const apiKey = process.env.NIA_API_KEY;
    if (!apiKey) return { ok: false, error: "NIA_API_KEY not configured" };

    try {
      const res = await fetch(
        `${NIA_BASE}/repositories/${encodeURIComponent(repository)}`,
        {
          headers: { authorization: `Bearer ${apiKey}` },
        },
      );
      if (!res.ok) {
        return { ok: false, error: `Nia ${res.status}: ${(await res.text()).slice(0, 200)}` };
      }
      const data = (await res.json()) as {
        status?: string;
        progress?: number;
        stage?: string;
      };
      return {
        ok: true,
        status: data.status,
        progress: data.progress,
        stage: data.stage,
      };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  },
});

const SKILL_QUERY =
  "List the programming languages, frameworks, libraries, design patterns, and major technical concepts present in this codebase. Focus on what a developer using this code would need to know.";

type ExtractResult = {
  ok: boolean;
  skills?: string[];
  rawHits?: number;
  error?: string;
};

// Common tech taxonomy used to extract clean skill names from Nia's prose.
const TECH_TAXONOMY = [
  "TypeScript", "JavaScript", "Python", "Go", "Rust", "Ruby", "PHP", "Java", "C#", "Swift",
  "Next.js", "React", "Vue", "Svelte", "Astro", "Remix", "Nuxt",
  "Node.js", "Deno", "Bun", "Express", "Fastify", "Hono",
  "Tailwind", "shadcn", "MUI", "Chakra",
  "Convex", "Supabase", "Firebase", "PostgreSQL", "MySQL", "MongoDB", "Redis", "SQLite",
  "Stripe", "Webhooks", "OAuth", "NextAuth", "JWT", "Auth.js", "Clerk",
  "MCP", "WebSockets", "REST", "GraphQL", "tRPC",
  "Vercel", "AWS", "Cloudflare", "Docker", "Kubernetes",
  "Prisma", "Drizzle",
  "Zod", "TanStack", "Zustand", "Redux",
  "Vitest", "Jest", "Playwright", "Cypress",
  "Turbopack", "Vite", "Webpack", "esbuild",
];

function deriveSkillsFromText(text: string): string[] {
  const lc = text.toLowerCase();
  const found = new Set<string>();
  for (const term of TECH_TAXONOMY) {
    // Word-boundary-ish match (allow . in names like Next.js)
    const pattern = new RegExp(
      `(^|[^a-z0-9])${term.toLowerCase().replace(/\./g, "\\.")}(\\b|[^a-z0-9])`,
      "i",
    );
    if (pattern.test(lc)) found.add(term);
  }
  return Array.from(found).slice(0, 16);
}

// Strip markdown markers + collapse whitespace for cleaner display
function cleanMarkdown(text: string): string {
  return text
    .replace(/^#+\s+/gm, "") // headings
    .replace(/```[\s\S]*?```/g, "") // code blocks
    .replace(/`([^`]+)`/g, "$1") // inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links → text
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "") // images
    .replace(/\*\*([^*]+)\*\*/g, "$1") // bold
    .replace(/\*([^*]+)\*/g, "$1") // italic
    .replace(/^\s*[-*+]\s+/gm, "") // list bullets
    .replace(/<[^>]+>/g, "") // html
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function firstParagraph(text: string): string {
  const cleaned = cleanMarkdown(text);
  const blocks = cleaned.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  // Prefer the first block that looks like a real description:
  //   - long enough to be more than a title/tagline
  //   - or contains a period (= sentence-ish)
  for (const b of blocks) {
    if (b.length >= 80 || b.includes(". ")) {
      return b.replace(/\n/g, " ").slice(0, 280);
    }
  }
  // Fallback: any block of length > 30
  for (const b of blocks) {
    if (b.length > 30) return b.replace(/\n/g, " ").slice(0, 280);
  }
  return blocks[0]?.slice(0, 280) ?? "";
}

type DescriptionResult = {
  ok: boolean;
  bio?: string;
  bioLong?: string;
  source?: string;
  error?: string;
};

// Generate an agent description from the linked GitHub repo.
// Tries README.md first (cleanest source), falls back to Nia universal-search.
export const generateAgentDescription = action({
  args: { agentId: v.id("agents"), repoUrl: v.string(), branch: v.optional(v.string()) },
  handler: async (ctx, { agentId, repoUrl, branch }): Promise<DescriptionResult> => {
    const cleaned = repoUrl.trim().replace(/\.git$/, "").replace(/\/$/, "");
    const m = cleaned.match(/github\.com[/:]([^/]+)\/([^/]+)$/) ?? cleaned.match(/^([^/\s]+)\/([^/\s]+)$/);
    if (!m) return { ok: false, error: `Could not parse repo URL: ${repoUrl}` };
    const owner = m[1];
    const repo = m[2];
    const ref = branch ?? "main";

    // Try README via GitHub Contents API (no CDN cache like raw.githubusercontent.com)
    let lastErr = "";
    for (const name of ["README.md", "readme.md", "Readme.md"]) {
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${name}?ref=${encodeURIComponent(ref)}`;
      try {
        const res = await fetch(url, {
          headers: {
            accept: "application/vnd.github.v3+json",
            "user-agent": "united-agents-bot",
          },
        });
        if (!res.ok) {
          lastErr = `${name} → ${res.status} ${(await res.text()).slice(0, 120)}`;
          continue;
        }
        const json = (await res.json()) as { content?: string; encoding?: string };
        let text = "";
        if (json.encoding === "base64" && json.content) {
          // GitHub wraps base64 with newlines — strip them before decoding
          text = Buffer.from(json.content.replace(/\n/g, ""), "base64").toString("utf-8");
        }
        if (text && text.length > 30) {
          const bio = firstParagraph(text);
          const bioLong = cleanMarkdown(text).slice(0, 4000);
          await ctx.runMutation(api.agents.setBios, {
            agentId,
            bio,
            bioLong,
            source: "readme",
          });
          return { ok: true, bio, bioLong, source: "readme" };
        }
        lastErr = `${name} decoded but text length=${text.length}`;
      } catch (e) {
        lastErr = `${name} threw: ${(e as Error).message}`;
      }
    }
    console.warn(`README fetch fell through for ${owner}/${repo}: ${lastErr}`);

    // Fallback: query Nia for project summary
    const apiKey = process.env.NIA_API_KEY;
    if (!apiKey) return { ok: false, error: "no README and NIA_API_KEY missing" };

    try {
      const res = await fetch(`${NIA_BASE}/universal-search`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          query: "Summarize what this codebase is, what it does, and the key technical patterns used.",
          repositories: [`${owner}/${repo}`],
        }),
      });
      if (!res.ok) {
        return { ok: false, error: `Nia ${res.status}: ${(await res.text()).slice(0, 200)}` };
      }
      const data = (await res.json()) as { results?: Array<{ summary?: string; content?: string }> };
      const blob = (data.results ?? [])
        .slice(0, 5)
        .map((r) => r.summary || r.content || "")
        .join("\n\n");
      const bio = firstParagraph(blob);
      const bioLong = cleanMarkdown(blob).slice(0, 4000);
      if (bio) {
        await ctx.runMutation(api.agents.setBios, {
          agentId,
          bio,
          bioLong,
          source: "nia",
        });
      }
      return { ok: true, bio, bioLong, source: "nia" };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  },
});

type HistoryEvent = {
  timestamp?: string;
  event?: "setup" | "task_complete" | "task_incomplete";
  files_in_map?: number;
  result?: string;
  project_hash?: string;
};

type DetectHashResult = {
  ok: boolean;
  projectHash?: string;
  source?: "history_metadata" | "manual_required";
  error?: string;
};

// Try to read the project hash directly from .ua-history.json in the repo.
// Works for MCP v1.0.18+ which stamps `project_hash` into every event.
// Falls back to "manual_required" for older history files.
export const detectProjectHash = action({
  args: { repoUrl: v.string(), branch: v.optional(v.string()) },
  handler: async (_ctx, { repoUrl, branch }): Promise<DetectHashResult> => {
    const cleaned = repoUrl.trim().replace(/\.git$/, "").replace(/\/$/, "");
    const m = cleaned.match(/github\.com[/:]([^/]+)\/([^/]+)$/) ?? cleaned.match(/^([^/\s]+)\/([^/\s]+)$/);
    if (!m) return { ok: false, error: `Could not parse repo URL: ${repoUrl}` };
    const owner = m[1];
    const repo = m[2];
    const ref = branch ?? "main";
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/.ua-history.json`;

    try {
      const res = await fetch(url, { headers: { accept: "application/json" } });
      if (!res.ok) return { ok: false, error: `${url} returned ${res.status}` };
      const events = (await res.json()) as HistoryEvent[];
      if (!Array.isArray(events) || events.length === 0) {
        return { ok: false, error: ".ua-history.json is empty or invalid" };
      }
      // Find the first event that carries a project_hash (newest events come last)
      for (let i = events.length - 1; i >= 0; i--) {
        const h = events[i].project_hash;
        if (typeof h === "string" && h.length >= 8) {
          return { ok: true, projectHash: h, source: "history_metadata" };
        }
      }
      return {
        ok: false,
        source: "manual_required",
        error: "No project_hash found in .ua-history.json — upgrade to united-agents-mcp@1.0.18+ for auto-detect.",
      };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  },
});

type BackfillResult = {
  ok: boolean;
  tasksCompleted?: number;
  loopsStopped?: number;
  filesTracedTotal?: number;
  successRate?: number;
  totalEvents?: number;
  error?: string;
};

// Pull the agent's `.ua-history.json` from its public GitHub repo and
// derive verified stats from the real MCP event log. No self-declared numbers.
export const backfillStatsFromRepo = action({
  args: {
    agentId: v.id("agents"),
    repoUrl: v.string(),
    branch: v.optional(v.string()),
  },
  handler: async (ctx, { agentId, repoUrl, branch }): Promise<BackfillResult> => {
    const cleaned = repoUrl.trim().replace(/\.git$/, "").replace(/\/$/, "");
    const m = cleaned.match(/github\.com[/:]([^/]+)\/([^/]+)$/) ?? cleaned.match(/^([^/\s]+)\/([^/\s]+)$/);
    if (!m) return { ok: false, error: `Could not parse repo URL: ${repoUrl}` };
    const owner = m[1];
    const repo = m[2];
    const ref = branch ?? "main";
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/.ua-history.json`;

    try {
      const res = await fetch(url, { headers: { accept: "application/json" } });
      if (!res.ok) {
        return {
          ok: false,
          error: `Could not fetch ${url} — ${res.status}. Make sure .ua-history.json is committed and the repo is public.`,
        };
      }
      const events = (await res.json()) as HistoryEvent[];
      if (!Array.isArray(events)) {
        return { ok: false, error: ".ua-history.json was not an array" };
      }
      // v1.0.18+: each event also carries a project_hash field.
      // Older versions don't include it — Nia/registry must rely on user-supplied hash.

      const completes = events.filter((e) => e.event === "task_complete");
      const incompletes = events.filter((e) => e.event === "task_incomplete");
      const total = completes.length + incompletes.length;

      const filesTracedTotal = events.reduce(
        (sum, e) => sum + (typeof e.files_in_map === "number" ? e.files_in_map : 0),
        0,
      );
      const successRate = total > 0 ? completes.length / total : 0;
      const lastTimestamps = events
        .map((e) => (e.timestamp ? Date.parse(e.timestamp) : NaN))
        .filter((n) => !isNaN(n));
      const lastTaskAt = lastTimestamps.length > 0 ? Math.max(...lastTimestamps) : undefined;

      await ctx.runMutation(api.agents.setAgentStats, {
        agentId,
        tasksCompleted: completes.length,
        loopsStopped: incompletes.length,
        filesTracedTotal,
        successRate,
        lastTaskAt,
      });

      return {
        ok: true,
        tasksCompleted: completes.length,
        loopsStopped: incompletes.length,
        filesTracedTotal,
        successRate,
        totalEvents: events.length,
      };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  },
});

export const extractSkills = action({
  args: { agentId: v.id("agents"), repository: v.string() },
  handler: async (ctx, { agentId, repository }): Promise<ExtractResult> => {
    const apiKey = process.env.NIA_API_KEY;
    if (!apiKey) return { ok: false, error: "NIA_API_KEY not configured" };

    try {
      const res = await fetch(`${NIA_BASE}/universal-search`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          query: SKILL_QUERY,
          repositories: [repository],
        }),
      });

      if (!res.ok) {
        return { ok: false, error: `Nia ${res.status}: ${(await res.text()).slice(0, 200)}` };
      }

      const data = (await res.json()) as {
        results?: Array<{ content?: string; summary?: string }>;
      };
      const blob = (data.results ?? [])
        .map((r) => `${r.summary ?? ""} ${r.content ?? ""}`)
        .join(" \n ");

      const skills = deriveSkillsFromText(blob);

      if (skills.length > 0) {
        await ctx.runMutation(api.agents.setSkills, {
          agentId,
          skills,
          source: "nia",
        });
      }

      return { ok: true, skills, rawHits: (data.results ?? []).length };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  },
});
