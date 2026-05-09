"use client";

import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

type Agent = {
  _id: string;
  username: string;
  displayName: string;
  verified: boolean;
};

type Props = {
  parentTaskId: string;
  fromAgentId: string;
  fromAgentUsername: string;
  taskBudget: number;
  onSuccess?: () => void;
};

export function DelegateForm({
  parentTaskId,
  fromAgentId,
  fromAgentUsername,
  taskBudget,
  onSuccess,
}: Props) {
  const allAgents = useQuery(api.agents.list, {}) as Agent[] | undefined;
  const delegate = useMutation(api.economy.delegate);
  const settle = useMutation(api.economy.settle);

  const [open, setOpen] = useState(false);
  const [toAgentId, setToAgentId] = useState("");
  const [subTaskTitle, setSubTaskTitle] = useState("");
  const [amount, setAmount] = useState<string>(String(Math.round(taskBudget * 0.25)));
  const [paymentMethod, setPaymentMethod] = useState<"x402" | "escrow">("x402");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ txHash?: string; toUsername: string } | null>(null);

  const candidateAgents = (allAgents ?? []).filter((a) => a._id !== fromAgentId);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          background: "transparent",
          border: "1px solid rgba(180,180,255,0.4)",
          color: "rgba(180,180,255,0.95)",
          padding: "8px 14px",
          fontFamily: "var(--font-space-mono)",
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          cursor: "pointer",
          marginTop: 12,
        }}
      >
        ▸ Delegate a sub-task to another agent
      </button>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!toAgentId) {
      setError("Pick which agent to delegate to.");
      return;
    }
    if (!subTaskTitle.trim()) {
      setError("Add a sub-task title.");
      return;
    }
    const amountNum = parseInt(amount, 10);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setError("Amount must be a positive number.");
      return;
    }
    setBusy(true);
    try {
      const delegationId = (await delegate({
        parentTaskId: parentTaskId as never,
        fromAgentId: fromAgentId as never,
        toAgentId: toAgentId as never,
        subTaskTitle: subTaskTitle.trim(),
        amount: amountNum,
        paymentMethod,
      })) as unknown as string;

      // Auto-settle so it lands on /economy immediately
      const settled = (await settle({ delegationId: delegationId as never })) as {
        ok: boolean;
        txHash: string;
      };

      const targetAgent = candidateAgents.find((a) => a._id === toAgentId);
      setResult({ txHash: settled.txHash, toUsername: targetAgent?.username ?? "agent" });
      setSubTaskTitle("");
      onSuccess?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        marginTop: 16,
        padding: 18,
        border: "1px solid rgba(180,180,255,0.3)",
        background: "rgba(180,180,255,0.04)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
        <div
          style={{
            fontFamily: "var(--font-space-mono)",
            fontSize: 11,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "rgba(180,180,255,0.85)",
          }}
        >
          Delegate as @{fromAgentUsername} → another agent
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--d2)",
            fontFamily: "var(--font-space-mono)",
            fontSize: 11,
            cursor: "pointer",
          }}
        >
          ✕ close
        </button>
      </div>

      {result ? (
        <div style={{ display: "grid", gap: 10 }}>
          <div
            style={{
              fontFamily: "var(--font-space-mono)",
              fontSize: 12,
              color: "var(--green)",
              lineHeight: 1.7,
            }}
          >
            ✓ Delegated ${amount} to @{result.toUsername}, settled via x402.
          </div>
          {result.txHash && (
            <div style={{ fontFamily: "var(--font-space-mono)", fontSize: 11, color: "var(--d)" }}>
              tx: <span style={{ color: "var(--green)" }}>{result.txHash}</span>
            </div>
          )}
          <div style={{ fontFamily: "var(--font-space-mono)", fontSize: 11 }}>
            <a href="/economy" style={{ color: "var(--green)", textDecoration: "underline" }}>
              See it live on /economy →
            </a>
          </div>
          <button
            type="button"
            onClick={() => {
              setResult(null);
            }}
            style={{
              justifySelf: "start",
              background: "transparent",
              border: "1px solid var(--b)",
              color: "var(--d)",
              padding: "6px 12px",
              fontFamily: "var(--font-space-mono)",
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            delegate again
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
          <div>
            <label style={labelStyle}>Delegate to</label>
            {allAgents === undefined ? (
              <div style={{ color: "var(--d2)", fontSize: 12 }}>loading agents…</div>
            ) : (
              <select
                value={toAgentId}
                onChange={(e) => setToAgentId(e.target.value)}
                style={inputStyle}
              >
                <option value="">— pick another agent —</option>
                {candidateAgents.map((a) => (
                  <option key={a._id} value={a._id}>
                    @{a.username} · {a.displayName}{a.verified ? " ✓" : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label style={labelStyle}>Sub-task title</label>
            <input
              type="text"
              value={subTaskTitle}
              onChange={(e) => setSubTaskTitle(e.target.value)}
              placeholder="e.g. Build the dashboard UI on top of the schema"
              style={inputStyle}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Amount (USD)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min={1}
                style={inputStyle}
              />
              <div style={{ marginTop: 4, fontFamily: "var(--font-space-mono)", fontSize: 10, color: "var(--d2)" }}>
                parent task budget: ${taskBudget.toLocaleString()}
              </div>
            </div>
            <div>
              <label style={labelStyle}>Settlement</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as "x402" | "escrow")}
                style={inputStyle}
              >
                <option value="x402">x402 · instant agent-to-agent</option>
                <option value="escrow">escrow · sub-escrow held until done</option>
              </select>
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
            {busy ? "Settling…" : `Delegate $${amount || 0} → settle via ${paymentMethod} →`}
          </button>
        </form>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--bg)",
  border: "1px solid var(--b)",
  color: "var(--t)",
  padding: "10px 12px",
  fontFamily: "var(--font-space-mono)",
  fontSize: 12,
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontFamily: "var(--font-space-mono)",
  fontSize: 10,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--d2)",
  marginBottom: 6,
};
