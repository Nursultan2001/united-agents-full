import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  agents: defineTable({
    username: v.string(),
    displayName: v.string(),
    bio: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    githubLogin: v.optional(v.string()),
    projectHash: v.optional(v.string()),
    repoUrl: v.optional(v.string()),
    skills: v.array(v.string()),
    skillsSource: v.optional(v.string()),
    skillsIndexedAt: v.optional(v.number()),
    stack: v.array(v.string()),
    verified: v.boolean(),
    isSample: v.boolean(),
    claimedAt: v.optional(v.number()),
  })
    .index("by_username", ["username"])
    .index("by_projectHash", ["projectHash"]),

  agentStats: defineTable({
    agentId: v.id("agents"),
    tasksCompleted: v.number(),
    loopsStopped: v.number(),
    filesTracedTotal: v.number(),
    successRate: v.number(),
    lastTaskAt: v.optional(v.number()),
  }).index("by_agent", ["agentId"]),

  globalStats: defineTable({
    totalProjects: v.number(),
    totalTasksCompleted: v.number(),
    totalLoopsStopped: v.number(),
    uniqueProjects: v.number(),
    avgFilesPerTask: v.number(),
    syncedAt: v.number(),
  }),

  taskEvents: defineTable({
    agentId: v.optional(v.id("agents")),
    projectHash: v.string(),
    event: v.union(
      v.literal("setup"),
      v.literal("task_complete"),
      v.literal("task_incomplete"),
    ),
    filesInMap: v.number(),
    file: v.optional(v.string()),
    task: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_agent", ["agentId"])
    .index("by_projectHash", ["projectHash"])
    .index("by_createdAt", ["createdAt"]),

  // Phase 3 — Marketplace
  tasks: defineTable({
    title: v.string(),
    description: v.string(),
    posterId: v.optional(v.id("agents")),
    posterName: v.string(),
    budget: v.number(),
    currency: v.string(),
    stack: v.array(v.string()),
    skillsWanted: v.array(v.string()),
    status: v.union(
      v.literal("open"),
      v.literal("escrowed"),
      v.literal("in_progress"),
      v.literal("submitted"),
      v.literal("approved"),
      v.literal("disputed"),
      v.literal("cancelled"),
    ),
    acceptedAgentId: v.optional(v.id("agents")),
    escrowMode: v.union(v.literal("demo"), v.literal("stripe")),
    createdAt: v.number(),
    deadline: v.optional(v.number()),
    isSample: v.boolean(),
  })
    .index("by_status", ["status"])
    .index("by_posterId", ["posterId"])
    .index("by_acceptedAgentId", ["acceptedAgentId"])
    .index("by_createdAt", ["createdAt"]),

  bids: defineTable({
    taskId: v.id("tasks"),
    agentId: v.id("agents"),
    message: v.string(),
    proposedPrice: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("rejected"),
    ),
    createdAt: v.number(),
  })
    .index("by_task", ["taskId"])
    .index("by_agent", ["agentId"]),

  // Phase 4 — Agent Economy
  delegations: defineTable({
    parentTaskId: v.id("tasks"),
    fromAgentId: v.id("agents"),
    toAgentId: v.id("agents"),
    subTaskTitle: v.string(),
    amount: v.number(),
    currency: v.string(),
    paymentMethod: v.union(v.literal("x402"), v.literal("escrow")),
    status: v.union(
      v.literal("proposed"),
      v.literal("settled"),
      v.literal("cancelled"),
    ),
    createdAt: v.number(),
    settledAt: v.optional(v.number()),
    isSample: v.boolean(),
  })
    .index("by_parentTask", ["parentTaskId"])
    .index("by_fromAgent", ["fromAgentId"])
    .index("by_toAgent", ["toAgentId"]),

  x402Ledger: defineTable({
    delegationId: v.optional(v.id("delegations")),
    fromAgentId: v.id("agents"),
    toAgentId: v.id("agents"),
    amount: v.number(),
    currency: v.string(),
    txHash: v.string(),
    memo: v.optional(v.string()),
    createdAt: v.number(),
    isSample: v.boolean(),
  })
    .index("by_fromAgent", ["fromAgentId"])
    .index("by_toAgent", ["toAgentId"])
    .index("by_createdAt", ["createdAt"]),
});
