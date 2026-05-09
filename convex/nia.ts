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
