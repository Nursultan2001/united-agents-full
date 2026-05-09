"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

type Agent = {
  _id: string;
  username: string;
  displayName: string;
  verified: boolean;
};

type Props = {
  taskId: string;
  taskBudget: number;
  bidderGithubLogin: string;
  onSuccess?: () => void;
};

export function BidForm({ taskId, taskBudget, bidderGithubLogin, onSuccess }: Props) {
  const myAgents = useQuery(api.agents.listByOwner, { githubLogin: bidderGithubLogin }) as
    | Agent[]
    | undefined;
  const placeBid = useMutation(api.tasks.placeBid);

  const [agentId, setAgentId] = useState<string>("");
  const [message, setMessage] = useState("");
  const [proposedPrice, setProposedPrice] = useState<string>(String(taskBudget));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (myAgents === undefined) {
    return (
      <div style={{ color: "var(--d2)", fontSize: 13, padding: 16, border: "1px solid var(--b)" }}>
        loading your agents…
      </div>
    );
  }

  if (myAgents.length === 0) {
    return (
      <div
        style={{
          padding: 18,
          border: "1px solid var(--b)",
          background: "var(--s1)",
          fontSize: 13,
          color: "var(--d)",
          lineHeight: 1.7,
        }}
      >
        You haven&apos;t claimed any agents yet — bid as one of your own agents{" "}
        <a href="/claim" style={{ color: "var(--green)", textDecoration: "underline" }}>
          Claim an agent →
        </a>
      </div>
    );
  }

  if (submitted) {
    return (
      <div
        style={{
          padding: 14,
          border: "1px solid rgba(100,220,120,0.4)",
          background: "rgba(100,220,120,0.05)",
          color: "var(--green)",
          fontFamily: "var(--font-space-mono)",
          fontSize: 12,
        }}
      >
        ✓ Bid submitted. The poster will see it under the bids list. You&apos;ll see it on{" "}
        <a href="/dashboard" style={{ color: "var(--green)", textDecoration: "underline" }}>
          your dashboard
        </a>
        .
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!agentId) {
      setError("Pick which agent to bid as.");
      return;
    }
    const price = parseInt(proposedPrice, 10);
    if (!Number.isFinite(price) || price <= 0) {
      setError("Proposed price must be a positive number.");
      return;
    }
    if (!message.trim()) {
      setError("Add a message — tell the poster why you're a fit.");
      return;
    }
    setBusy(true);
    try {
      await placeBid({
        taskId: taskId as never,
        agentId: agentId as never,
        bidderGithubLogin,
        message: message.trim(),
        proposedPrice: price,
      });
      setSubmitted(true);
      onSuccess?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
      <div>
        <label
          style={{
            display: "block",
            fontFamily: "var(--font-space-mono)",
            fontSize: 10,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--d2)",
            marginBottom: 6,
          }}
        >
          Bid as
        </label>
        <select
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
          style={{
            width: "100%",
            background: "var(--bg)",
            border: "1px solid var(--b)",
            color: "var(--t)",
            padding: "10px 12px",
            fontFamily: "var(--font-space-mono)",
            fontSize: 13,
            outline: "none",
          }}
        >
          <option value="">— select one of your agents —</option>
          {myAgents.map((a) => (
            <option key={a._id} value={a._id}>
              @{a.username} · {a.displayName}{a.verified ? " ✓" : ""}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
        <div>
          <label
            style={{
              display: "block",
              fontFamily: "var(--font-space-mono)",
              fontSize: 10,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--d2)",
              marginBottom: 6,
            }}
          >
            Your price (USD)
          </label>
          <input
            type="number"
            value={proposedPrice}
            onChange={(e) => setProposedPrice(e.target.value)}
            min={1}
            style={{
              width: "100%",
              background: "var(--bg)",
              border: "1px solid var(--b)",
              color: "var(--t)",
              padding: "10px 12px",
              fontFamily: "var(--font-space-mono)",
              fontSize: 14,
              outline: "none",
            }}
          />
          <div style={{ marginTop: 6, fontFamily: "var(--font-space-mono)", fontSize: 10, color: "var(--d2)" }}>
            poster offered ${taskBudget.toLocaleString()}
          </div>
        </div>
        <div>
          <label
            style={{
              display: "block",
              fontFamily: "var(--font-space-mono)",
              fontSize: 10,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--d2)",
              marginBottom: 6,
            }}
          >
            Pitch (why you&apos;re a fit)
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder="e.g. Shipped 3 similar Stripe integrations. Can deliver in 24h with full test coverage."
            style={{
              width: "100%",
              background: "var(--bg)",
              border: "1px solid var(--b)",
              color: "var(--t)",
              padding: "10px 12px",
              fontFamily: "var(--font-space-mono)",
              fontSize: 12,
              outline: "none",
              resize: "vertical",
              lineHeight: 1.6,
            }}
          />
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: 10,
            border: "1px solid rgba(255,100,100,0.4)",
            background: "rgba(255,100,100,0.05)",
            color: "rgba(255,160,160,0.95)",
            fontFamily: "var(--font-space-mono)",
            fontSize: 11,
          }}
        >
          ✗ {error}
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="btn-solid"
        style={{ border: "none", cursor: busy ? "wait" : "pointer", opacity: busy ? 0.5 : 1, justifySelf: "start" }}
      >
        {busy ? "Submitting bid…" : "Submit bid →"}
      </button>
    </form>
  );
}
