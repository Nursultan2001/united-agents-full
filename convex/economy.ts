import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

type DelegationDoc = {
  _id: string;
  parentTaskId: string;
  fromAgentId: string;
  toAgentId: string;
  subTaskTitle: string;
  amount: number;
  currency: string;
  paymentMethod: "x402" | "escrow";
  status: "proposed" | "settled" | "cancelled";
  createdAt: number;
  settledAt?: number;
  isSample: boolean;
};

type LedgerDoc = {
  _id: string;
  delegationId?: string;
  fromAgentId: string;
  toAgentId: string;
  amount: number;
  currency: string;
  txHash: string;
  memo?: string;
  createdAt: number;
  isSample: boolean;
};

export const listDelegations = query({
  args: {},
  handler: async (ctx) => {
    const all = (await ctx.db.query("delegations").collect()) as unknown as DelegationDoc[];
    all.sort((a, b) => b.createdAt - a.createdAt);
    return all;
  },
});

export const listLedger = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const all = (await ctx.db
      .query("x402Ledger")
      .withIndex("by_createdAt")
      .order("desc")
      .take(limit ?? 50)) as unknown as LedgerDoc[];
    return all;
  },
});

export const delegate = mutation({
  args: {
    parentTaskId: v.id("tasks"),
    fromAgentId: v.id("agents"),
    toAgentId: v.id("agents"),
    subTaskTitle: v.string(),
    amount: v.number(),
    paymentMethod: v.union(v.literal("x402"), v.literal("escrow")),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("delegations", {
      ...args,
      currency: "USD",
      status: "proposed",
      createdAt: Date.now(),
      isSample: false,
    });
    return id;
  },
});

export const settle = mutation({
  args: { delegationId: v.id("delegations") },
  handler: async (ctx, { delegationId }) => {
    const d = (await ctx.db.get(delegationId)) as unknown as DelegationDoc | null;
    if (!d) throw new Error("Delegation not found");

    const txHash = `0xua${Math.random().toString(16).slice(2, 18)}${Date.now().toString(16)}`;
    await ctx.db.patch(delegationId, {
      status: "settled",
      settledAt: Date.now(),
    });
    await ctx.db.insert("x402Ledger", {
      delegationId,
      fromAgentId: d.fromAgentId as never,
      toAgentId: d.toAgentId as never,
      amount: d.amount,
      currency: d.currency,
      txHash,
      memo: d.subTaskTitle,
      createdAt: Date.now(),
      isSample: false,
    });
    return { ok: true, txHash, demo: true };
  },
});
