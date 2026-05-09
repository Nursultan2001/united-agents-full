import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Platform admins — can delete any task. Add more GitHub logins here as the team grows.
const PLATFORM_ADMINS = ["Nursultan2001"];

function isAdmin(githubLogin: string | undefined | null): boolean {
  if (!githubLogin) return false;
  return PLATFORM_ADMINS.some((a) => a.toLowerCase() === githubLogin.toLowerCase());
}

type TaskDoc = {
  _id: string;
  _creationTime: number;
  title: string;
  description: string;
  posterId?: string;
  posterName: string;
  posterGithubLogin?: string;
  budget: number;
  currency: string;
  stack: string[];
  skillsWanted: string[];
  status: "open" | "escrowed" | "in_progress" | "submitted" | "approved" | "disputed" | "cancelled";
  acceptedAgentId?: string;
  escrowMode: "demo" | "stripe";
  createdAt: number;
  deadline?: number;
  deliverableUrl?: string;
  deliverableNotes?: string;
  submittedAt?: number;
  approvedAt?: number;
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
    posterGithubLogin: v.optional(v.string()),
    deadline: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (args.budget < 50) {
      throw new Error("Minimum task budget is $50 (Stripe + platform fees become unsustainable below).");
    }
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

// Tasks a given GitHub user has posted (for /dashboard "Tasks I posted").
export const myPosted = query({
  args: { githubLogin: v.string() },
  handler: async (ctx, { githubLogin }) => {
    const all = (await ctx.db.query("tasks").collect()) as unknown as TaskDoc[];
    const filtered = all.filter((t) => t.posterGithubLogin === githubLogin);
    filtered.sort((a, b) => b.createdAt - a.createdAt);
    return filtered;
  },
});

// Tasks where any of the user's owned agents has bid or been accepted.
// Returns { task, role: "bidder" | "accepted", bid? }.
export const myInvolved = query({
  args: { githubLogin: v.string() },
  handler: async (ctx, { githubLogin }) => {
    type AgentDoc = { _id: string; githubLogin?: string; username: string; displayName: string };
    const allAgents = (await ctx.db.query("agents").collect()) as unknown as AgentDoc[];
    const myAgents = allAgents.filter((a) => a.githubLogin === githubLogin);
    if (myAgents.length === 0) return [];
    const myAgentIds = new Set(myAgents.map((a) => a._id));
    const agentById = new Map(myAgents.map((a) => [a._id, a]));

    const allBids = (await ctx.db.query("bids").collect()) as unknown as BidDoc[];
    const myBids = allBids.filter((b) => myAgentIds.has(b.agentId));

    const allTasks = (await ctx.db.query("tasks").collect()) as unknown as TaskDoc[];
    const involvedTaskIds = new Set<string>();
    for (const b of myBids) involvedTaskIds.add(b.taskId);
    for (const t of allTasks) if (t.acceptedAgentId && myAgentIds.has(t.acceptedAgentId)) involvedTaskIds.add(t._id);

    const result = [];
    for (const taskId of involvedTaskIds) {
      const task = allTasks.find((t) => t._id === taskId);
      if (!task) continue;
      const acceptedAgent = task.acceptedAgentId ? agentById.get(task.acceptedAgentId) : undefined;
      const myBidsOnThisTask = myBids.filter((b) => b.taskId === taskId);
      const role = acceptedAgent ? "accepted" : "bidder";
      result.push({
        task,
        role,
        acceptedAgent,
        myBids: myBidsOnThisTask,
      });
    }
    result.sort((a, b) => b.task.createdAt - a.task.createdAt);
    return result;
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
    bidderGithubLogin: v.string(),
    message: v.string(),
    proposedPrice: v.number(),
  },
  handler: async (ctx, { taskId, agentId, bidderGithubLogin, message, proposedPrice }) => {
    // Guard 1: agent must be owned by the bidder
    const agent = (await ctx.db.get(agentId)) as unknown as { githubLogin?: string } | null;
    if (!agent) throw new Error("Agent not found");
    if (agent.githubLogin !== bidderGithubLogin) {
      throw new Error("You can only bid as an agent you own.");
    }
    // Guard 2: task must exist and be open
    const task = (await ctx.db.get(taskId)) as unknown as TaskDoc | null;
    if (!task) throw new Error("Task not found");
    if (task.status !== "open") {
      throw new Error(`Task is no longer open (currently ${task.status}).`);
    }
    // Guard 3: poster cannot bid on their own task
    if (task.posterGithubLogin === bidderGithubLogin) {
      throw new Error("You can't bid on your own task.");
    }
    // Guard 4: same agent can't double-bid
    const existing = (await ctx.db
      .query("bids")
      .withIndex("by_task", (q) => q.eq("taskId" as never, taskId as never))
      .collect()) as unknown as BidDoc[];
    if (existing.some((b) => b.agentId === agentId && b.status === "pending")) {
      throw new Error("This agent already has a pending bid on this task.");
    }
    return await ctx.db.insert("bids", {
      taskId,
      agentId,
      message,
      proposedPrice,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

export const acceptBid = mutation({
  args: { bidId: v.id("bids"), accepterGithubLogin: v.string() },
  handler: async (ctx, { bidId, accepterGithubLogin }) => {
    const bid = (await ctx.db.get(bidId)) as unknown as BidDoc | null;
    if (!bid) throw new Error("Bid not found");
    const task = (await ctx.db.get(bid.taskId as never)) as unknown as TaskDoc | null;
    if (!task) throw new Error("Task not found");
    if (task.posterGithubLogin && task.posterGithubLogin !== accepterGithubLogin) {
      throw new Error("Only the task poster can accept a bid.");
    }
    if (task.status !== "open" && task.status !== "escrowed") {
      throw new Error(`Task is no longer accepting bids (currently ${task.status}).`);
    }
    await ctx.db.patch(bidId, { status: "accepted" });
    // Reject all other pending bids on this task
    const allBids = (await ctx.db
      .query("bids")
      .withIndex("by_task", (q) => q.eq("taskId" as never, bid.taskId as never))
      .collect()) as unknown as BidDoc[];
    for (const b of allBids) {
      if (b._id !== bidId && b.status === "pending") {
        await ctx.db.patch(b._id as never, { status: "rejected" });
      }
    }
    await ctx.db.patch(bid.taskId as never, {
      status: "in_progress" as const,
      acceptedAgentId: bid.agentId as never,
    });
    return { ok: true, taskId: bid.taskId };
  },
});

export const submit = mutation({
  args: {
    id: v.id("tasks"),
    deliverableUrl: v.string(),
    deliverableNotes: v.optional(v.string()),
  },
  handler: async (ctx, { id, deliverableUrl, deliverableNotes }) => {
    const url = deliverableUrl.trim();
    if (url.length < 5) throw new Error("Deliverable URL is required.");
    if (!/^https?:\/\//i.test(url)) {
      throw new Error("Deliverable URL must start with http:// or https://");
    }
    await ctx.db.patch(id, {
      status: "submitted",
      deliverableUrl: url,
      deliverableNotes: deliverableNotes?.trim() || undefined,
      submittedAt: Date.now(),
    });
    return { ok: true };
  },
});

// Hard-delete a task (and cascade-delete its bids).
// Allowed if: requester is the task's poster, OR requester is a platform admin.
export const deleteTask = mutation({
  args: { id: v.id("tasks"), requesterGithubLogin: v.string() },
  handler: async (ctx, { id, requesterGithubLogin }) => {
    const task = (await ctx.db.get(id)) as unknown as TaskDoc | null;
    if (!task) throw new Error("Task not found");
    const isPoster = task.posterGithubLogin === requesterGithubLogin;
    if (!isPoster && !isAdmin(requesterGithubLogin)) {
      throw new Error("Only the task's poster or a platform admin can delete it.");
    }
    if (task.isSample) {
      throw new Error("Refusing to delete sample task. Use the Convex dashboard if you really need to.");
    }
    // Cascade: delete all bids for this task
    const bids = (await ctx.db
      .query("bids")
      .withIndex("by_task", (q) => q.eq("taskId" as never, id as never))
      .collect()) as unknown as BidDoc[];
    for (const b of bids) {
      await ctx.db.delete(b._id as never);
    }
    await ctx.db.delete(id);
    return { ok: true, deletedBids: bids.length, deletedAs: isPoster ? "poster" : "admin" };
  },
});

export const approve = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, { id }) => {
    const task = (await ctx.db.get(id)) as unknown as TaskDoc | null;
    if (!task) throw new Error("Task not found");
    if (task.status !== "submitted") {
      throw new Error(`Task must be 'submitted' to approve (currently ${task.status}).`);
    }
    await ctx.db.patch(id, { status: "approved", approvedAt: Date.now() });

    // Bump the accepted agent's verified stats — marketplace completions count too.
    if (task.acceptedAgentId) {
      type StatsDoc = {
        _id: string;
        agentId: string;
        tasksCompleted: number;
        loopsStopped: number;
        filesTracedTotal: number;
        successRate: number;
      };
      const stats = (await ctx.db
        .query("agentStats")
        .withIndex("by_agent", (q) => q.eq("agentId" as never, task.acceptedAgentId as never))
        .unique()) as StatsDoc | null;
      if (stats) {
        const newCompleted = stats.tasksCompleted + 1;
        const totalAttempts = newCompleted + stats.loopsStopped;
        const newSuccess = totalAttempts > 0 ? newCompleted / totalAttempts : 1;
        await ctx.db.patch(stats._id as never, {
          tasksCompleted: newCompleted,
          successRate: newSuccess,
          lastTaskAt: Date.now(),
        });
      } else {
        await ctx.db.insert("agentStats", {
          agentId: task.acceptedAgentId as never,
          tasksCompleted: 1,
          loopsStopped: 0,
          filesTracedTotal: 0,
          successRate: 1,
          lastTaskAt: Date.now(),
        });
      }
    }

    return {
      ok: true,
      payout: "demo (no real funds moved)",
      statsUpdated: Boolean(task.acceptedAgentId),
    };
  },
});
