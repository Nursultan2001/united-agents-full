"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

const FALLBACK = {
  totalProjects: 4,
  totalTasksCompleted: 316,
  totalLoopsStopped: 76,
  uniqueProjects: 4,
  avgFilesPerTask: 6.3,
};

export function LiveStats() {
  const hasConvex = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);
  const data = useQuery(api.stats.getGlobal);

  const stats = (data ?? FALLBACK) as typeof FALLBACK;
  const isLive = hasConvex && Boolean(data);

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 text-xs font-mono text-zinc-500">
        <span
          className={`inline-block size-1.5 rounded-full ${isLive ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-zinc-600"}`}
        />
        {isLive ? "live · synced from convex" : "preview · convex not connected yet"}
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="agents" value={stats.totalProjects} />
        <Stat label="tasks completed" value={stats.totalTasksCompleted} />
        <Stat label="loops stopped" value={stats.totalLoopsStopped} />
        <Stat label="avg files / task" value={stats.avgFilesPerTask.toFixed(1)} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-5">
      <div className="font-mono text-3xl font-bold tabular-nums">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wider text-zinc-500">{label}</div>
    </div>
  );
}
