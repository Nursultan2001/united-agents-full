import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

type TaskDoc = {
  _id: string;
  _creationTime: number;
  title: string;
  description: string;
  posterId?: string;
  posterName: string;
  budget: number;
  currency: string;
  stack: string[];
  skillsWanted: string[];
  status: "open" | "escrowed" | "in_progress" | "submitted" | "approved" | "disputed" | "cancelled";
  acceptedAgentId?: string;
  escrowMode: "demo" | "stripe";
  createdAt: number;
  deadline?: number;
  isSample: boolean;
};

type BidDoc = {
  _id: string;
  taskId: string;
  agentId: string;
  message: string;
  proposedPrice: number;
  status: "pending" | "accepted" | "rejected";
  createdAt: number;
};

export const list = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("open"),
        v.literal("escrowed"),
        v.literal("in_progress"),
        v.literal("submitted"),
        v.literal("approved"),
        v.literal("disputed"),
        v.literal("cancelled"),
      ),
    ),
    stack: v.optional(v.string()),
  },
  handler: async (ctx, { status, stack }) => {
    const all = (await ctx.db.query("tasks").collect()) as unknown as TaskDoc[];
    const filtered = all.filter((t: TaskDoc) => {
      if (status && t.status !== status) return false;
      if (stack && !t.stack.map((s) => s.toLowerCase()).includes(stack.toLowerCase())) {
        return false;
      }
      return true;
    });
    filtered.sort((a, b) => b.createdAt - a.createdAt);
    return filtered;
  },
});

export const get = query({
  args: { id: v.id("tasks") },
  handler: async (ctx, { id }) => {
    const task = (await ctx.db.get(id)) as unknown as TaskDoc | null;
    if (!task) return null;

    const bids = (await ctx.db
      .query("bids")
      .withIndex("by_task", (q) => q.eq("taskId" as never, id as never))
      .collect()) as unknown as BidDoc[];

    return { task, bids };
  },
});

export const post = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    budget: v.number(),
    stack: v.array(v.string()),
    skillsWanted: v.array(v.string()),
    posterName: v.string(),
    deadline: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("tasks", {
      ...args,
      currency: "USD",
      status: "open",
      escrowMode: "demo",
      createdAt: Date.now(),
      isSample: false,
    });
  },
});

export const escrow = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, { id }) => {
    const task = (await ctx.db.get(id)) as unknown as TaskDoc | null;
    if (!task) throw new Error("Task not found");
    if (task.status !== "open") throw new Error("Task is not open for escrow");
    await ctx.db.patch(id, { status: "escrowed" });
    return { ok: true, demo: true };
  },
});

export const placeBid = mutation({
  args: {
    taskId: v.id("tasks"),
    agentId: v.id("agents"),
    message: v.string(),
    proposedPrice: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("bids", {
      ...args,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

export const acceptBid = mutation({
  args: { bidId: v.id("bids") },
  handler: async (ctx, { bidId }) => {
    const bid = (await ctx.db.get(bidId)) as unknown as BidDoc | null;
    if (!bid) throw new Error("Bid not found");
    await ctx.db.patch(bidId, { status: "accepted" });
    await ctx.db.patch(bid.taskId as never, {
      status: "in_progress" as const,
      acceptedAgentId: bid.agentId as never,
    });
    return { ok: true };
  },
});

export const submit = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { status: "submitted" });
    return { ok: true };
  },
});

export const approve = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { status: "approved" });
    return { ok: true, payout: "demo (no real funds moved)" };
  },
});
