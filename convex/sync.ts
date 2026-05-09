"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

const SUPABASE_URL = "https://fdypwnhvpqqbuoxhrkuq.supabase.co";
const SUPABASE_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkeXB3bmh2cHFxYnVveGhya3VxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxNjMxMDgsImV4cCI6MjA5MjczOTEwOH0.nNc80UDse_yB6WixTjl8xMpCN0B2Zph56R4xn5hwPzk";

type PublicStats = {
  total_projects: number;
  total_tasks_completed: number;
  total_loops_stopped: number;
  unique_projects: number;
  avg_files_per_task: number;
};

export const syncFromSupabase = action({
  args: {},
  handler: async (ctx): Promise<{ ok: boolean; synced?: PublicStats; error?: string }> => {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/ua_public_stats?select=*&limit=1`, {
        headers: {
          apikey: SUPABASE_ANON,
          authorization: `Bearer ${SUPABASE_ANON}`,
        },
      });

      if (!res.ok) {
        return { ok: false, error: `supabase ${res.status}: ${await res.text()}` };
      }

      const rows: PublicStats[] = await res.json();
      if (!rows || rows.length === 0) {
        return { ok: false, error: "ua_public_stats returned no rows" };
      }
      const row = rows[0];

      await ctx.runMutation(api.stats.upsertGlobal, {
        totalProjects: Number(row.total_projects ?? 0),
        totalTasksCompleted: Number(row.total_tasks_completed ?? 0),
        totalLoopsStopped: Number(row.total_loops_stopped ?? 0),
        uniqueProjects: Number(row.unique_projects ?? 0),
        avgFilesPerTask: Number(row.avg_files_per_task ?? 0),
      });

      return { ok: true, synced: row };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  },
});

// Optional: sync raw event log too (last 200 events)
type RawEvent = {
  id: number;
  event: "setup" | "task_complete" | "task_incomplete";
  project_hash: string;
  files_in_map: number;
  created_at: string;
};

export const syncEventLog = action({
  args: { limit: v.optional(v.number()) },
  handler: async (_ctx, { limit }): Promise<{ ok: boolean; count?: number; error?: string; sample?: RawEvent[] }> => {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/ua_analytics?select=*&order=created_at.desc&limit=${limit ?? 200}`,
        {
          headers: {
            apikey: SUPABASE_ANON,
            authorization: `Bearer ${SUPABASE_ANON}`,
          },
        },
      );
      if (!res.ok) {
        return { ok: false, error: `supabase ${res.status}: ${await res.text()}` };
      }
      const rows: RawEvent[] = await res.json();
      return { ok: true, count: rows.length, sample: rows.slice(0, 3) };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  },
});
