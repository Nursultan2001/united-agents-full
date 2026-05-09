import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getGlobal = query({
  args: {},
  handler: async (ctx) => {
    const latest = await ctx.db.query("globalStats").order("desc").take(1);
    return latest[0] ?? null;
  },
});

export const upsertGlobal = mutation({
  args: {
    totalProjects: v.number(),
    totalTasksCompleted: v.number(),
    totalLoopsStopped: v.number(),
    uniqueProjects: v.number(),
    avgFilesPerTask: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("globalStats").take(1);
    if (existing[0]) {
      await ctx.db.patch(existing[0]._id, { ...args, syncedAt: Date.now() });
      return existing[0]._id;
    }
    return await ctx.db.insert("globalStats", { ...args, syncedAt: Date.now() });
  },
});
