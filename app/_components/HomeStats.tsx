"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export function HomeStats() {
  const hasConvex = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);
  const [downloads, setDownloads] = useState<string>("—");

  useEffect(() => {
    let cancelled = false;
    fetch("https://api.npmjs.org/downloads/point/last-month/united-agents-mcp")
      .then((r) => r.json())
      .then((d: { downloads?: number }) => {
        if (!cancelled && typeof d.downloads === "number") {
          setDownloads(d.downloads.toLocaleString());
        }
      })
      .catch(() => {
        if (!cancelled) setDownloads("—");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const live = useQuery(api.stats.getGlobal) as
    | {
        totalProjects?: number;
        totalTasksCompleted?: number;
        totalLoopsStopped?: number;
      }
    | null
    | undefined;

  const projects = hasConvex && live?.totalProjects !== undefined ? live.totalProjects.toLocaleString() : "—";
  const tasks =
    hasConvex && live?.totalTasksCompleted !== undefined && live?.totalLoopsStopped !== undefined
      ? `${live.totalTasksCompleted.toLocaleString()} · ${live.totalLoopsStopped.toLocaleString()}`
      : "—";

  return (
    <div className="stats">
      <div className="stat">
        <div className="stat-live">
          <span className="ldot"></span>live · npm
        </div>
        <span className="sn">{downloads}</span>
        <span className="sd">downloads · last 30 days</span>
      </div>
      <div className="stat">
        <div className="stat-live">
          <span className="ldot"></span>live · convex
        </div>
        <span className="sn">{projects}</span>
        <span className="sd">projects set up</span>
      </div>
      <div className="stat">
        <div className="stat-live">
          <span className="ldot"></span>live · convex
        </div>
        <span className="sn">{tasks}</span>
        <span className="sd">tasks completed · loops stopped</span>
      </div>
    </div>
  );
}
