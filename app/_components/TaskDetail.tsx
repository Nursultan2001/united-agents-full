"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";

type Task = {
  _id: string;
  title: string;
  description: string;
  posterName: string;
  budget: number;
  currency: string;
  stack: string[];
  skillsWanted: string[];
  status: "open" | "escrowed" | "in_progress" | "submitted" | "approved" | "disputed" | "cancelled";
  acceptedAgentId?: string;
  createdAt: number;
  isSample: boolean;
  escrowMode: "demo" | "stripe";
};

type Bid = {
  _id: string;
  agentId: string;
  message: string;
  proposedPrice: number;
  status: "pending" | "accepted" | "rejected";
  createdAt: number;
};

const STATUS_FLOW: Record<Task["status"], { next?: string; label: string; color: string }> = {
  open: { next: "escrow", label: "open · accepting bids", color: "var(--green)" },
  escrowed: { next: "in_progress", label: "escrowed · awaiting agent", color: "rgba(180,180,255,0.85)" },
  in_progress: { next: "submitted", label: "in progress", color: "rgba(255,200,80,0.85)" },
  submitted: { next: "approved", label: "submitted · awaiting review", color: "rgba(180,180,255,0.85)" },
  approved: { label: "approved · paid out", color: "var(--green)" },
  disputed: { label: "disputed", color: "rgba(255,100,100,0.85)" },
  cancelled: { label: "cancelled", color: "var(--d2)" },
};

export function TaskDetail({ id }: { id: string }) {
  const hasConvex = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);
  const data = useQuery(api.tasks.get, { id: id as never }) as
    | { task: Task; bids: Bid[] }
    | null
    | undefined;

  const escrow = useMutation(api.tasks.escrow);
  const submit = useMutation(api.tasks.submit);
  const approve = useMutation(api.tasks.approve);

  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  if (!hasConvex) {
    return (
      <div style={{ padding: "64px var(--pad)", maxWidth: 720, margin: "0 auto" }}>
        <Link href="/tasks" style={{ color: "var(--d2)", fontSize: 13 }}>
          ← Tasks
        </Link>
        <h1 className="h1" style={{ marginTop: 24 }}>
          Convex not connected
        </h1>
        <p style={{ color: "var(--d)", marginTop: 12, lineHeight: 1.85 }}>
          Run <code style={{ color: "var(--green)" }}>npx convex dev</code> in this
          directory to enable live task data + the escrow mutations. Sample tasks
          listed on /tasks are static.
        </p>
      </div>
    );
  }

  if (data === undefined) {
    return (
      <div style={{ padding: "64px var(--pad)", textAlign: "center", color: "var(--d2)" }}>
        Loading…
      </div>
    );
  }

  if (data === null) {
    return (
      <div style={{ padding: "64px var(--pad)", maxWidth: 720, margin: "0 auto" }}>
        <Link href="/tasks" style={{ color: "var(--d2)", fontSize: 13 }}>
          ← Tasks
        </Link>
        <h1 className="h1" style={{ marginTop: 24 }}>Task not found</h1>
      </div>
    );
  }

  const { task, bids } = data;
  const flow = STATUS_FLOW[task.status];

  async function handleAdvance() {
    setBusy(task.status);
    try {
      if (task.status === "open") {
        await escrow({ id: task._id as never });
        setToast("✓ Demo escrow held. Marked as escrowed in Convex (no real $ moved).");
      } else if (task.status === "in_progress") {
        await submit({ id: task._id as never });
        setToast("✓ Marked as submitted. Awaiting poster review.");
      } else if (task.status === "submitted") {
        await approve({ id: task._id as never });
        setToast("✓ Approved. Demo payout recorded — Stripe Connect wires up post-hackathon.");
      }
    } catch (e) {
      setToast(`✗ ${(e as Error).message}`);
    } finally {
      setBusy(null);
      setTimeout(() => setToast(null), 4000);
    }
  }

  return (
    <div style={{ padding: "48px var(--pad)" }}>
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <Link href="/tasks" style={{ color: "var(--d2)", fontSize: 13 }}>
          ← Tasks
        </Link>

        <div
          style={{
            marginTop: 24,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 32,
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1, minWidth: 280 }}>
            <span className="sec-tag" style={{ marginBottom: 8 }}>
              task · {task._id.slice(0, 12)}
            </span>
            <h1 className="h1" style={{ fontSize: 32, marginBottom: 16 }}>
              {task.title}
            </h1>
            <div
              style={{
                display: "flex",
                gap: 16,
                fontFamily: "var(--font-space-mono)",
                fontSize: 11,
                color: "var(--d2)",
                marginBottom: 24,
                flexWrap: "wrap",
              }}
            >
              <span>posted by {task.posterName}</span>
              <span>·</span>
              <span style={{ color: flow.color }}>● {flow.label}</span>
              <span>·</span>
              <span>escrow mode: {task.escrowMode}</span>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                fontFamily: "var(--font-space-mono)",
                fontSize: 36,
                fontWeight: 700,
                color: "var(--t)",
                letterSpacing: "-0.02em",
              }}
            >
              ${task.budget.toLocaleString()}
            </div>
            <div
              style={{
                fontFamily: "var(--font-space-mono)",
                fontSize: 10,
                color: "var(--d2)",
                marginTop: 4,
                letterSpacing: "0.08em",
              }}
            >
              {task.currency} · escrow
            </div>
          </div>
        </div>

        <div
          style={{
            border: "1px solid var(--b)",
            padding: 24,
            marginTop: 16,
            background: "var(--s1)",
          }}
        >
          <div style={{ color: "var(--d)", fontSize: 14, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
            {task.description}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 20 }}>
            {task.skillsWanted.map((s) => (
              <span
                key={s}
                style={{
                  fontFamily: "var(--font-space-mono)",
                  fontSize: 10,
                  color: "var(--d)",
                  border: "1px solid var(--b)",
                  padding: "4px 10px",
                }}
              >
                {s}
              </span>
            ))}
            {task.stack.map((s) => (
              <span
                key={s}
                style={{
                  fontFamily: "var(--font-space-mono)",
                  fontSize: 10,
                  color: "var(--d2)",
                  padding: "4px 10px",
                }}
              >
                #{s}
              </span>
            ))}
          </div>
        </div>

        {flow.next && (
          <div style={{ marginTop: 24 }}>
            <button
              onClick={handleAdvance}
              disabled={busy !== null}
              className="btn-solid"
              style={{ cursor: busy ? "wait" : "pointer", opacity: busy ? 0.5 : 1 }}
            >
              {busy
                ? "Working…"
                : task.status === "open"
                  ? `Hold $${task.budget.toLocaleString()} in demo escrow →`
                  : task.status === "in_progress"
                    ? "Submit work for review →"
                    : "Approve & release escrow →"}
            </button>
            <span
              style={{
                marginLeft: 14,
                fontFamily: "var(--font-space-mono)",
                fontSize: 10,
                color: "var(--d2)",
                letterSpacing: "0.08em",
              }}
            >
              demo mode · no real funds move
            </span>
          </div>
        )}

        {toast && (
          <div
            style={{
              marginTop: 16,
              padding: "10px 14px",
              border: "1px solid var(--b)",
              fontFamily: "var(--font-space-mono)",
              fontSize: 11,
              color: toast.startsWith("✓") ? "var(--green)" : "rgba(255,100,100,0.85)",
              background: "var(--s2)",
            }}
          >
            {toast}
          </div>
        )}

        <h2
          style={{
            marginTop: 48,
            fontFamily: "var(--font-space-mono)",
            fontSize: 11,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--d2)",
            marginBottom: 12,
          }}
        >
          Bids ({bids.length})
        </h2>
        {bids.length === 0 ? (
          <div
            style={{
              border: "1px solid var(--b)",
              padding: 24,
              color: "var(--d2)",
              fontSize: 13,
              textAlign: "center",
            }}
          >
            No bids yet. Verified agents see open tasks in their feed.
          </div>
        ) : (
          <div style={{ border: "1px solid var(--b)" }}>
            {bids.map((b, i) => (
              <div
                key={b._id}
                style={{
                  padding: 18,
                  borderTop: i === 0 ? "none" : "1px solid var(--b)",
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 24,
                }}
              >
                <div>
                  <div
                    style={{
                      fontFamily: "var(--font-space-mono)",
                      fontSize: 12,
                      color: "var(--t)",
                      marginBottom: 6,
                    }}
                  >
                    Agent · {b.agentId.slice(0, 12)}
                  </div>
                  <div
                    style={{
                      color: "var(--d)",
                      fontSize: 13,
                      lineHeight: 1.7,
                      maxWidth: 600,
                    }}
                  >
                    {b.message}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div
                    style={{
                      fontFamily: "var(--font-space-mono)",
                      fontSize: 20,
                      fontWeight: 700,
                      color: "var(--t)",
                    }}
                  >
                    ${b.proposedPrice.toLocaleString()}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-space-mono)",
                      fontSize: 9,
                      color: "var(--d2)",
                      marginTop: 4,
                      textTransform: "uppercase",
                    }}
                  >
                    ● {b.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
