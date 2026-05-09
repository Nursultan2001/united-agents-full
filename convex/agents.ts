import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

type AgentDoc = {
  _id: string;
  username: string;
  displayName: string;
  bio?: string;
  skills: string[];
  stack: string[];
  verified: boolean;
  isSample: boolean;
};

type StatsDoc = {
  _id: string;
  agentId: string;
  tasksCompleted: number;
  loopsStopped: number;
  filesTracedTotal: number;
  successRate: number;
  lastTaskAt?: number;
};

export const list = query({
  args: {
    search: v.optional(v.string()),
    stack: v.optional(v.string()),
    verifiedOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, { search, stack, verifiedOnly }) => {
    const all = (await ctx.db.query("agents").collect()) as unknown as AgentDoc[];

    const filtered = all.filter((a: AgentDoc) => {
      if (verifiedOnly && !a.verified) return false;
      if (
        stack &&
        !a.stack.map((s: string) => s.toLowerCase()).includes(stack.toLowerCase())
      ) {
        return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const haystack =
          `${a.username} ${a.displayName} ${a.bio ?? ""} ${a.skills.join(" ")} ${a.stack.join(" ")}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    const withStats = await Promise.all(
      filtered.map(async (agent: AgentDoc) => {
        const stats = (await ctx.db
          .query("agentStats")
          .withIndex("by_agent", (q) => q.eq("agentId" as never, agent._id as never))
          .unique()) as unknown as StatsDoc | null;
        return { ...agent, stats };
      }),
    );

    withStats.sort((a, b) => {
      const aRate = a.stats?.successRate ?? 0;
      const bRate = b.stats?.successRate ?? 0;
      if (bRate !== aRate) return bRate - aRate;
      return (b.stats?.tasksCompleted ?? 0) - (a.stats?.tasksCompleted ?? 0);
    });

    return withStats;
  },
});

export const getByUsername = query({
  args: { username: v.string() },
  handler: async (ctx, { username }) => {
    const agent = (await ctx.db
      .query("agents")
      .withIndex("by_username", (q) => q.eq("username" as never, username as never))
      .unique()) as unknown as AgentDoc | null;
    if (!agent) return null;

    const stats = (await ctx.db
      .query("agentStats")
      .withIndex("by_agent", (q) => q.eq("agentId" as never, agent._id as never))
      .unique()) as unknown as StatsDoc | null;

    const recentEvents = await ctx.db
      .query("taskEvents")
      .withIndex("by_agent", (q) => q.eq("agentId" as never, agent._id as never))
      .order("desc")
      .take(10);

    return { agent, stats, recentEvents };
  },
});

export const claim = mutation({
  args: {
    // The OWNER (human) — comes from GitHub OAuth session
    githubLogin: v.string(),
    ownerAvatarUrl: v.optional(v.string()),
    // The AGENT (the thing being named) — chosen by the user
    agentName: v.string(),
    agentBio: v.optional(v.string()),
    // The PROJECT hash to link
    projectHash: v.string(),
    // Optional GitHub repo URL — Nia indexes it to derive skills
    repoUrl: v.optional(v.string()),
  },
  handler: async (ctx, { githubLogin, ownerAvatarUrl, agentName, agentBio, projectHash, repoUrl }) => {
    const cleanHash = projectHash
      .trim()
      .toLowerCase()
      .replace(/[^a-f0-9]/g, "");
    if (cleanHash.length < 8) {
      throw new Error(`Project hash must be at least 8 hex characters (got '${cleanHash}').`);
    }
    const agentSlug = slugify(agentName);
    if (!agentSlug || agentSlug.length < 2) {
      throw new Error("Agent name must contain at least 2 letters or numbers.");
    }
    if (agentSlug.length > 40) {
      throw new Error("Agent name is too long (max 40 chars after slugifying).");
    }

    // 1. Reject if this hash is already claimed by a different agent
    const existingHashOwner = (await ctx.db
      .query("agents")
      .withIndex("by_projectHash", (q) => q.eq("projectHash" as never, cleanHash as never))
      .unique()) as { _id: string; username: string; githubLogin?: string } | null;

    if (existingHashOwner && existingHashOwner.username !== agentSlug) {
      throw new Error(
        `This project hash is already linked to agent @${existingHashOwner.username}` +
          (existingHashOwner.githubLogin ? ` (owned by ${existingHashOwner.githubLogin})` : "") +
          ".",
      );
    }

    // 2. Find or create the agent record for this slug
    const existingAgent = (await ctx.db
      .query("agents")
      .withIndex("by_username", (q) => q.eq("username" as never, agentSlug as never))
      .unique()) as
      | {
          _id: string;
          username: string;
          githubLogin?: string;
          verified: boolean;
          isSample: boolean;
        }
      | null;

    if (existingAgent && existingAgent.githubLogin && existingAgent.githubLogin !== githubLogin) {
      throw new Error(
        `Agent name @${agentSlug} is taken. Try something more specific like @${agentSlug}-${githubLogin.toLowerCase()}.`,
      );
    }

    let agentId: string;
    if (existingAgent) {
      await ctx.db.patch(existingAgent._id as never, {
        displayName: agentName,
        bio: agentBio,
        githubLogin,
        avatarUrl: ownerAvatarUrl,
        projectHash: cleanHash,
        ...(repoUrl ? { repoUrl } : {}),
        verified: true,
        claimedAt: Date.now(),
        ...(existingAgent.isSample ? { isSample: false } : {}),
      });
      agentId = existingAgent._id;
    } else {
      const newId = await ctx.db.insert("agents", {
        username: agentSlug,
        displayName: agentName,
        bio: agentBio,
        avatarUrl: ownerAvatarUrl,
        githubLogin,
        projectHash: cleanHash,
        repoUrl,
        skills: [],
        stack: [],
        verified: true,
        isSample: false,
        claimedAt: Date.now(),
      });
      agentId = newId as unknown as string;

      await ctx.db.insert("agentStats", {
        agentId: newId,
        tasksCompleted: 0,
        loopsStopped: 0,
        filesTracedTotal: 0,
        successRate: 0,
      });
    }

    return { ok: true, username: agentSlug, agentId, projectHash: cleanHash };
  },
});

// Set skills on an agent (called by the Nia extraction action).
export const setSkills = mutation({
  args: {
    agentId: v.id("agents"),
    skills: v.array(v.string()),
    source: v.optional(v.string()),
  },
  handler: async (ctx, { agentId, skills, source }) => {
    await ctx.db.patch(agentId, {
      skills,
      skillsSource: source ?? "manual",
      skillsIndexedAt: Date.now(),
    });
    return { ok: true, count: skills.length };
  },
});

// Set the linked GitHub repo on an agent.
export const setRepoUrl = mutation({
  args: { agentId: v.id("agents"), repoUrl: v.string() },
  handler: async (ctx, { agentId, repoUrl }) => {
    await ctx.db.patch(agentId, { repoUrl });
    return { ok: true };
  },
});

// List all agents owned by a given GitHub user (for "your agents" view).
export const listByOwner = query({
  args: { githubLogin: v.string() },
  handler: async (ctx, { githubLogin }) => {
    const all = (await ctx.db.query("agents").collect()) as Array<{
      _id: string;
      username: string;
      displayName: string;
      githubLogin?: string;
      verified: boolean;
      isSample: boolean;
    }>;
    return all.filter((a) => a.githubLogin === githubLogin && !a.isSample);
  },
});

// One-shot cleanup for the bad orphan agent record created with a space in the username.
// Safe to run multiple times — only deletes records whose slugified username differs from raw.
export const cleanupOrphanedUsernames = mutation({
  args: {},
  handler: async (ctx) => {
    const all = (await ctx.db.query("agents").collect()) as Array<{
      _id: string;
      username: string;
      isSample: boolean;
    }>;
    let deleted = 0;
    for (const a of all) {
      if (a.isSample) continue;
      if (a.username !== slugify(a.username)) {
        // Also delete dangling stats
        const stats = (await ctx.db
          .query("agentStats")
          .withIndex("by_agent", (q) => q.eq("agentId" as never, a._id as never))
          .collect()) as Array<{ _id: string }>;
        for (const s of stats) await ctx.db.delete(s._id as never);
        await ctx.db.delete(a._id as never);
        deleted++;
      }
    }
    return { deleted };
  },
});
