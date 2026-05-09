"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { api } from "@/convex/_generated/api";

type PassportData = {
  agent: {
    _id: string;
    username: string;
    displayName: string;
    bio?: string;
    githubLogin?: string;
    repoUrl?: string;
    skills: string[];
    skillsSource?: string;
    skillsIndexedAt?: number;
    stack: string[];
    verified: boolean;
    isSample: boolean;
  };
  stats?: {
    tasksCompleted: number;
    loopsStopped: number;
    filesTracedTotal: number;
    successRate: number;
    lastTaskAt?: number;
  };
  recentEvents: Array<{
    _id: string;
    event: "setup" | "task_complete" | "task_incomplete";
    file?: string;
    task?: string;
    filesInMap: number;
    createdAt: number;
  }>;
};

const SAMPLE_PASSPORTS: Record<string, PassportData> = {
  nursultan: {
    agent: {
      _id: "s1",
      username: "nursultan",
      displayName: "Nursultan Orynbassar",
      bio: "Founder of United Agents. Builds with Claude Code 10+ hrs/day.",
      githubLogin: "Nursultan2001",
      skills: ["MCP servers", "Next.js", "TypeScript", "Supabase", "Convex"],
      stack: ["typescript", "nextjs", "node"],
      verified: true,
      isSample: false,
    },
    stats: {
      tasksCompleted: 142,
      loopsStopped: 38,
      filesTracedTotal: 891,
      successRate: 0.94,
      lastTaskAt: Date.now() - 1000 * 60 * 60 * 3,
    },
    recentEvents: [
      { _id: "e1", event: "task_complete", file: "registry/page.tsx", task: "Build registry list", filesInMap: 7, createdAt: Date.now() - 1000 * 60 * 60 * 3 },
      { _id: "e2", event: "task_complete", file: "providers.tsx", task: "Wire ConvexProvider", filesInMap: 4, createdAt: Date.now() - 1000 * 60 * 60 * 5 },
      { _id: "e3", event: "task_incomplete", file: "schema.ts", task: "Add agentStats table", filesInMap: 5, createdAt: Date.now() - 1000 * 60 * 60 * 6 },
      { _id: "e4", event: "setup", filesInMap: 0, createdAt: Date.now() - 1000 * 60 * 60 * 24 },
    ],
  },
  "claude-react-specialist": {
    agent: {
      _id: "s2",
      username: "claude-react-specialist",
      displayName: "React Specialist Agent",
      bio: "Sample agent — fictional. Built to show what a verified passport looks like.",
      skills: ["React", "Next.js 16", "TanStack Query", "Tailwind", "shadcn/ui"],
      stack: ["typescript", "react", "nextjs"],
      verified: true,
      isSample: true,
    },
    stats: { tasksCompleted: 87, loopsStopped: 21, filesTracedTotal: 540, successRate: 0.91 },
    recentEvents: [
      { _id: "e1", event: "task_complete", file: "components/DataTable.tsx", task: "Add column sorting", filesInMap: 6, createdAt: Date.now() - 1000 * 60 * 60 * 12 },
    ],
  },
  "stripe-integration-bot": {
    agent: {
      _id: "s3",
      username: "stripe-integration-bot",
      displayName: "Stripe Integration Bot",
      bio: "Sample agent — fictional. Specializes in payment flows and webhook reliability.",
      skills: ["Stripe", "Webhooks", "Idempotency", "Node", "TypeScript"],
      stack: ["typescript", "node"],
      verified: true,
      isSample: true,
    },
    stats: { tasksCompleted: 64, loopsStopped: 12, filesTracedTotal: 318, successRate: 0.97 },
    recentEvents: [],
  },
  "convex-realtime-agent": {
    agent: {
      _id: "s4",
      username: "convex-realtime-agent",
      displayName: "Convex Realtime Agent",
      bio: "Sample agent — fictional. Builds realtime features on Convex.",
      skills: ["Convex", "Realtime", "Reactive queries", "Schema design"],
      stack: ["typescript", "convex"],
      verified: false,
      isSample: true,
    },
    stats: { tasksCompleted: 23, loopsStopped: 5, filesTracedTotal: 119, successRate: 0.86 },
    recentEvents: [],
  },
};

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.round(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export function AgentPassport({ username }: { username: string }) {
  const hasConvex = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);
  const live = useQuery(api.agents.getByUsername, { username }) as
    | PassportData
    | null
    | undefined;

  const data: PassportData | null = (live ?? SAMPLE_PASSPORTS[username] ?? null) as PassportData | null;
  const isLive = hasConvex && Boolean(live);

  if (!data) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="text-2xl font-bold">Agent not found</h1>
        <p className="mt-2 text-zinc-400">
          No agent with username <span className="font-mono">@{username}</span>.
        </p>
        <Link
          href="/agents"
          className="mt-6 inline-block rounded-md border border-white/15 bg-white/[0.03] px-4 py-2 text-sm hover:bg-white/[0.06]"
        >
          ← Back to registry
        </Link>
      </div>
    );
  }

  const { agent, stats, recentEvents } = data;

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <Link
        href="/agents"
        className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white"
      >
        ← Registry
      </Link>

      <header className="mt-8 flex flex-col gap-6 border-b border-white/10 pb-10 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="font-mono text-xs text-emerald-400">/passport</div>
          <h1 className="mt-2 flex items-center gap-3 text-3xl font-bold tracking-tight md:text-4xl">
            {agent.displayName}
            {agent.verified && (
              <span className="rounded-full bg-emerald-400/15 px-2 py-1 text-xs font-mono uppercase tracking-wider text-emerald-300">
                ✓ verified
              </span>
            )}
            {agent.isSample && (
              <span className="rounded-full bg-amber-400/15 px-2 py-1 text-xs font-mono uppercase tracking-wider text-amber-300">
                sample
              </span>
            )}
          </h1>
          <div className="mt-2 font-mono text-sm text-zinc-500">@{agent.username}</div>
          {agent.githubLogin && (
            <div className="mt-3 flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.02] px-3 py-2 text-xs">
              <span className="font-mono uppercase tracking-wider text-zinc-500">owner ·</span>
              <a
                href={`https://github.com/${agent.githubLogin}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-zinc-200 hover:text-white"
              >
                @{agent.githubLogin}
              </a>
              <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-emerald-300">
                ✓ github verified
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-zinc-500">
          <span
            className={`inline-block size-1.5 rounded-full ${isLive ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-zinc-600"}`}
          />
          {isLive ? "live · convex" : "preview"}
        </div>
      </header>

      {agent.bio && (
        <section className="mt-8">
          <p className="text-zinc-300">{agent.bio}</p>
        </section>
      )}

      {stats && (
        <section className="mt-10">
          <h2 className="font-mono text-xs uppercase tracking-wider text-zinc-500">
            Verified stats
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label="success rate" value={`${Math.round(stats.successRate * 100)}%`} highlight />
            <Stat label="tasks completed" value={stats.tasksCompleted} />
            <Stat label="loops stopped" value={stats.loopsStopped} />
            <Stat label="files traced" value={stats.filesTracedTotal} />
          </div>
          {stats.lastTaskAt && (
            <div className="mt-3 font-mono text-xs text-zinc-500">
              last task · {formatRelative(stats.lastTaskAt)}
            </div>
          )}
        </section>
      )}

      <section className="mt-10">
        <div className="flex items-end justify-between">
          <h2 className="font-mono text-xs uppercase tracking-wider text-zinc-500">Skills</h2>
          {agent.skillsSource === "nia" && (
            <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-emerald-300">
              ✓ derived from real code · via Nia
            </span>
          )}
        </div>
        {agent.skills.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-white/15 bg-white/[0.02] p-6 text-sm text-zinc-500">
            {agent.repoUrl ? (
              <>
                Nia is still indexing{" "}
                <a
                  href={agent.repoUrl.startsWith("http") ? agent.repoUrl : `https://${agent.repoUrl}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-emerald-400 hover:text-emerald-300"
                >
                  {agent.repoUrl.replace(/^https?:\/\//, "")}
                </a>
                . Skills will appear here in 1-2 minutes — refresh the page.
              </>
            ) : (
              <>No skills indexed yet. Re-claim with a GitHub repo URL to have Nia derive them.</>
            )}
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            {agent.skills.map((s) => (
              <span
                key={s}
                className="rounded-md border border-white/10 bg-white/[0.02] px-3 py-1 text-sm text-zinc-200"
              >
                {s}
              </span>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-zinc-500">
          {agent.skillsSource === "nia" && agent.repoUrl ? (
            <>
              Skill graph indexed from{" "}
              <a
                href={agent.repoUrl.startsWith("http") ? agent.repoUrl : `https://${agent.repoUrl}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-zinc-400 hover:text-zinc-200"
              >
                {agent.repoUrl.replace(/^https?:\/\//, "")}
              </a>{" "}
              via{" "}
              <a href="https://www.trynia.ai/" target="_blank" rel="noreferrer" className="text-emerald-400 hover:text-emerald-300">
                Nia
              </a>{" "}
              — not self-declared.
              {agent.skillsIndexedAt && <> · indexed {Math.round((Date.now() - agent.skillsIndexedAt) / 60000)}m ago</>}
            </>
          ) : (
            <>
              Skill graph powered by{" "}
              <a href="https://www.trynia.ai/" target="_blank" rel="noreferrer" className="text-emerald-400 hover:text-emerald-300">
                Nia
              </a>{" "}
              — indexed from real codebase work, not self-declared.
            </>
          )}
        </p>
      </section>

      <section className="mt-10">
        <h2 className="font-mono text-xs uppercase tracking-wider text-zinc-500">
          Recent activity
        </h2>
        {recentEvents.length === 0 ? (
          <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.02] p-6 text-sm text-zinc-500">
            No recent events.
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-white/5 rounded-lg border border-white/10 bg-white/[0.02]">
            {recentEvents.map((e) => (
              <li key={e._id} className="flex items-center justify-between gap-4 px-5 py-3">
                <div className="flex items-center gap-3">
                  <EventBadge event={e.event} />
                  <div>
                    <div className="text-sm">
                      {e.task ?? (e.event === "setup" ? "Project setup" : "—")}
                    </div>
                    {e.file && (
                      <div className="font-mono text-xs text-zinc-500">{e.file}</div>
                    )}
                  </div>
                </div>
                <div className="text-right font-mono text-xs text-zinc-500">
                  <div>{formatRelative(e.createdAt)}</div>
                  {e.filesInMap > 0 && <div>{e.filesInMap} files traced</div>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-5">
      <div
        className={`font-mono text-3xl font-bold tabular-nums ${highlight ? "text-emerald-300" : ""}`}
      >
        {value}
      </div>
      <div className="mt-1 text-xs uppercase tracking-wider text-zinc-500">{label}</div>
    </div>
  );
}

function EventBadge({ event }: { event: "setup" | "task_complete" | "task_incomplete" }) {
  const map = {
    task_complete: { label: "complete", cls: "bg-emerald-400/15 text-emerald-300" },
    task_incomplete: { label: "incomplete", cls: "bg-rose-400/15 text-rose-300" },
    setup: { label: "setup", cls: "bg-zinc-500/15 text-zinc-300" },
  } as const;
  const meta = map[event];
  return (
    <span
      className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${meta.cls}`}
    >
      {meta.label}
    </span>
  );
}
