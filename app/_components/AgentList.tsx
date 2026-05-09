"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { useSession } from "next-auth/react";
import { api } from "@/convex/_generated/api";

type Agent = {
  _id: string;
  username: string;
  displayName: string;
  bio?: string;
  githubLogin?: string;
  skills: string[];
  stack: string[];
  verified: boolean;
  isSample: boolean;
  stats?: {
    tasksCompleted: number;
    loopsStopped: number;
    successRate: number;
  };
};

const SAMPLE_FALLBACK: Agent[] = [
  {
    _id: "sample1",
    username: "nursultan",
    displayName: "Nursultan Orynbassar",
    bio: "Founder of United Agents. Builds with Claude Code 10+ hrs/day.",
    skills: ["MCP servers", "Next.js", "TypeScript", "Supabase", "Convex"],
    stack: ["typescript", "nextjs", "node"],
    verified: true,
    isSample: false,
    stats: { tasksCompleted: 142, loopsStopped: 38, successRate: 0.94 },
  },
  {
    _id: "sample2",
    username: "claude-react-specialist",
    displayName: "React Specialist Agent",
    bio: "Sample agent — fictional. Built to show what a verified passport looks like.",
    skills: ["React", "Next.js 16", "TanStack Query", "Tailwind", "shadcn/ui"],
    stack: ["typescript", "react", "nextjs"],
    verified: true,
    isSample: true,
    stats: { tasksCompleted: 87, loopsStopped: 21, successRate: 0.91 },
  },
  {
    _id: "sample3",
    username: "stripe-integration-bot",
    displayName: "Stripe Integration Bot",
    bio: "Sample agent — fictional. Specializes in payment flows and webhook reliability.",
    skills: ["Stripe", "Webhooks", "Idempotency", "Node", "TypeScript"],
    stack: ["typescript", "node"],
    verified: true,
    isSample: true,
    stats: { tasksCompleted: 64, loopsStopped: 12, successRate: 0.97 },
  },
  {
    _id: "sample4",
    username: "convex-realtime-agent",
    displayName: "Convex Realtime Agent",
    bio: "Sample agent — fictional. Builds realtime features on Convex.",
    skills: ["Convex", "Realtime", "Reactive queries", "Schema design"],
    stack: ["typescript", "convex"],
    verified: false,
    isSample: true,
    stats: { tasksCompleted: 23, loopsStopped: 5, successRate: 0.86 },
  },
];

type SearchHit = {
  id: string;
  title: string;
  snippet: string;
  source?: string;
  sourceUrl?: string;
  score?: number;
};

export function AgentList() {
  const [search, setSearch] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [mineOnly, setMineOnly] = useState(false);
  const [niaSource, setNiaSource] = useState<"nia" | "keyword-fallback" | null>(null);
  const [niaHits, setNiaHits] = useState<SearchHit[]>([]);
  const [niaLoading, setNiaLoading] = useState(false);
  const hasConvex = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);
  const { data: session } = useSession();
  const sessionLogin = (session?.user as { login?: string } | undefined)?.login ?? null;

  useEffect(() => {
    if (!search) {
      setNiaSource(null);
      setNiaHits([]);
      setNiaLoading(false);
      return;
    }
    let cancelled = false;
    setNiaLoading(true);
    const t = setTimeout(() => {
      fetch("/api/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: search }),
      })
        .then((r) => r.json())
        .then((d: { source?: "nia" | "keyword-fallback"; hits?: SearchHit[] }) => {
          if (cancelled) return;
          if (d.source) setNiaSource(d.source);
          setNiaHits(d.hits ?? []);
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setNiaLoading(false);
        });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [search]);

  const liveData = useQuery(api.agents.list, {
    search: search || undefined,
    verifiedOnly: verifiedOnly || undefined,
  }) as Agent[] | undefined;

  const baseData: Agent[] = (liveData ??
    SAMPLE_FALLBACK.filter((a) => {
      if (verifiedOnly && !a.verified) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${a.username} ${a.displayName} ${a.bio ?? ""} ${a.skills.join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })) as Agent[];

  const data: Agent[] = mineOnly && sessionLogin
    ? baseData.filter((a) => a.githubLogin === sessionLogin)
    : baseData;

  const myCount = sessionLogin
    ? baseData.filter((a) => a.githubLogin === sessionLogin).length
    : 0;

  const isLive = hasConvex && Boolean(liveData);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 items-center gap-3">
          <div className="flex w-full max-w-md flex-col gap-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search agents — try 'react' or 'stripe'…"
              className="w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm placeholder-zinc-500 focus:border-emerald-400/50 focus:outline-none"
            />
            {search && niaSource && (
              <span className="px-1 font-mono text-[10px] text-zinc-500">
                {niaSource === "nia" ? (
                  <>
                    semantic search ·{" "}
                    <a
                      href="https://www.trynia.ai/"
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-400 hover:text-emerald-300"
                    >
                      powered by Nia
                    </a>
                  </>
                ) : (
                  <>keyword fallback · add NIA_API_KEY for semantic search</>
                )}
              </span>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-400">
            <input
              type="checkbox"
              checked={verifiedOnly}
              onChange={(e) => setVerifiedOnly(e.target.checked)}
              className="size-4 accent-emerald-400"
            />
            verified only
          </label>
          {sessionLogin && (
            <button
              onClick={() => setMineOnly((v) => !v)}
              title={`${myCount} agent${myCount === 1 ? "" : "s"} owned by you`}
              className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-mono text-[11px] tracking-[0.04em] transition ${
                mineOnly
                  ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-300"
                  : "border-white/10 bg-transparent text-zinc-400 hover:bg-white/5"
              }`}
            >
              {mineOnly ? "✓ " : ""}my agents
              {myCount > 0 && (
                <span className={mineOnly ? "text-emerald-400/70" : "text-zinc-500"}>
                  ({myCount})
                </span>
              )}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-zinc-500">
          <span
            className={`inline-block size-1.5 rounded-full ${isLive ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-zinc-600"}`}
          />
          {isLive ? `${data.length} live` : `${data.length} preview`}
        </div>
      </div>

      {search && niaLoading && (
        <div className="mb-8 flex items-center gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-5 font-mono text-[11px] text-emerald-300">
          <span className="inline-block size-2 animate-pulse rounded-full bg-emerald-400" />
          searching codebases &amp; docs via Nia…
        </div>
      )}

      {search && niaSource === "nia" && niaHits.length > 0 && !niaLoading && (
        <div className="mb-8 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-emerald-300">
              ▸ Code & docs matching &ldquo;{search}&rdquo;
            </div>
            <a
              href="https://www.trynia.ai/"
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[10px] text-emerald-400 hover:text-emerald-300"
            >
              powered by Nia ↗
            </a>
          </div>
          <ul className="divide-y divide-emerald-400/10">
            {niaHits.slice(0, 4).map((h) => (
              <li key={h.id} className="py-2.5">
                <a
                  href={h.sourceUrl ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="block hover:bg-white/[0.02] -mx-2 px-2 py-1 rounded"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="font-mono text-sm text-zinc-100">{h.title}</div>
                    <div className="font-mono text-[10px] text-zinc-500">
                      {h.source ?? ""}
                      {h.score !== undefined && ` · ${Math.round(h.score * 100)}%`}
                    </div>
                  </div>
                  <div className="mt-1 line-clamp-2 text-xs text-zinc-400">
                    {h.snippet}
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-12 text-center text-zinc-500">
          No agents match your filters.
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {data.map((agent) => (
            <li key={agent._id}>
              <Link
                href={`/agents/${agent.username}`}
                className="block rounded-xl border border-white/10 bg-white/[0.02] p-5 transition hover:border-emerald-400/30 hover:bg-white/[0.04]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{agent.displayName}</span>
                      {agent.verified && (
                        <span
                          title="Verified by MCP task data"
                          className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-emerald-300"
                        >
                          ✓ verified
                        </span>
                      )}
                      {agent.isSample && (
                        <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-amber-300">
                          sample
                        </span>
                      )}
                    </div>
                    <div className="mt-1 font-mono text-xs text-zinc-500">
                      @{agent.username}
                    </div>
                  </div>
                  {agent.stats && (
                    <div className="text-right">
                      <div className="font-mono text-lg font-bold tabular-nums text-emerald-300">
                        {Math.round(agent.stats.successRate * 100)}%
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                        success rate
                      </div>
                    </div>
                  )}
                </div>
                {agent.bio && (
                  <p className="mt-3 line-clamp-2 text-sm text-zinc-400">{agent.bio}</p>
                )}
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {agent.skills.slice(0, 4).map((s) => (
                    <span
                      key={s}
                      className="rounded border border-white/10 bg-white/[0.02] px-2 py-0.5 text-[11px] text-zinc-300"
                    >
                      {s}
                    </span>
                  ))}
                  {agent.skills.length > 4 && (
                    <span className="text-[11px] text-zinc-500">
                      +{agent.skills.length - 4} more
                    </span>
                  )}
                </div>
                {agent.stats && (
                  <div className="mt-4 flex gap-6 border-t border-white/5 pt-3 font-mono text-xs text-zinc-500">
                    <span>
                      <span className="text-zinc-300">{agent.stats.tasksCompleted}</span>{" "}
                      tasks
                    </span>
                    <span>
                      <span className="text-zinc-300">{agent.stats.loopsStopped}</span>{" "}
                      loops stopped
                    </span>
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
