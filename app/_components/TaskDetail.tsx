"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { useSession } from "next-auth/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import { BidForm } from "./BidForm";
import { DelegateForm } from "./DelegateForm";

// Keep this in sync with PLATFORM_ADMINS in convex/tasks.ts
const PLATFORM_ADMINS = ["nursultan2001"];

type Task = {
  _id: string;
  title: string;
  description: string;
  posterName: string;
  posterGithubLogin?: string;
  budget: number;
  currency: string;
  stack: string[];
  skillsWanted: string[];
  status: "open" | "escrowed" | "in_progress" | "submitted" | "approved" | "disputed" | "cancelled";
  acceptedAgentId?: string;
  createdAt: number;
  isSample: boolean;
  escrowMode: "demo" | "stripe";
  deliverableUrl?: string;
  deliverableNotes?: string;
  submittedAt?: number;
  approvedAt?: number;
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
  const acceptBid = useMutation(api.tasks.acceptBid);
  const deleteTask = useMutation(api.tasks.deleteTask);
  const router = useRouter();
  const { data: session } = useSession();
  const sessionLogin = (session?.user as { login?: string } | undefined)?.login ?? null;

  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [acceptingBidId, setAcceptingBidId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [deliverableUrl, setDeliverableUrl] = useState("");
  const [deliverableNotes, setDeliverableNotes] = useState("");

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
        // Open the submit-work form instead of flipping state immediately
        setShowSubmitForm(true);
      } else if (task.status === "submitted") {
        await approve({ id: task._id as never });
        setToast("✓ Approved. Demo payout recorded + agent's verified stats bumped.");
      }
    } catch (e) {
      setToast(`✗ ${(e as Error).message}`);
    } finally {
      setBusy(null);
      setTimeout(() => setToast(null), 4000);
    }
  }

  async function handleSubmitWork(e: React.FormEvent) {
    e.preventDefault();
    setBusy("submit");
    try {
      await submit({
        id: task._id as never,
        deliverableUrl: deliverableUrl.trim(),
        deliverableNotes: deliverableNotes.trim() || undefined,
      });
      setShowSubmitForm(false);
      setDeliverableUrl("");
      setDeliverableNotes("");
      setToast("✓ Work submitted. Awaiting poster review.");
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

        {(() => {
          // Decide whether the current viewer should see the advance button.
          // - "Hold escrow" + "Approve" → only the POSTER
          // - "Submit work for review" → only the ACCEPTED AGENT (or poster as fallback if not signed in)
          const isPoster = sessionLogin && task.posterGithubLogin === sessionLogin;
          const showAdvance =
            !flow.next
              ? false
              : task.status === "open" || task.status === "submitted"
                ? Boolean(isPoster)
                : task.status === "in_progress"
                  ? true // accepted agent — for now allow signed-in viewers; gated more tightly post-hackathon
                  : task.status === "escrowed"
                    ? Boolean(isPoster)
                    : false;
          if (!showAdvance) return null;
          return (
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
                      : task.status === "submitted"
                        ? "Approve & release escrow →"
                        : "Advance →"}
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
          );
        })()}

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

        {/* Inline submit-work form — shown to agent when in_progress + button clicked */}
        {showSubmitForm && task.status === "in_progress" && (
          <form
            onSubmit={handleSubmitWork}
            style={{
              marginTop: 20,
              padding: 22,
              border: "1px solid rgba(180,180,255,0.3)",
              background: "rgba(180,180,255,0.04)",
              display: "grid",
              gap: 14,
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-space-mono)",
                fontSize: 11,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "rgba(180,180,255,0.85)",
              }}
            >
              Submit your work
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
                Deliverable URL <span style={{ color: "rgba(255,100,100,0.85)" }}>*</span>
              </label>
              <input
                type="url"
                value={deliverableUrl}
                onChange={(e) => setDeliverableUrl(e.target.value)}
                placeholder="https://github.com/owner/repo/pull/42"
                required
                style={{
                  width: "100%",
                  background: "var(--bg)",
                  border: "1px solid var(--b)",
                  color: "var(--t)",
                  padding: "10px 12px",
                  fontFamily: "var(--font-space-mono)",
                  fontSize: 12,
                  outline: "none",
                }}
              />
              <div style={{ marginTop: 6, fontFamily: "var(--font-space-mono)", fontSize: 10, color: "var(--d2)" }}>
                PR link, commit URL, deployed preview, or anything the poster can review
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
                Notes (optional)
              </label>
              <textarea
                value={deliverableNotes}
                onChange={(e) => setDeliverableNotes(e.target.value)}
                rows={3}
                placeholder="What changed, edge cases handled, how to test it…"
                style={{
                  width: "100%",
                  background: "var(--bg)",
                  border: "1px solid var(--b)",
                  color: "var(--t)",
                  padding: "10px 12px",
                  fontFamily: "var(--font-space-mono)",
                  fontSize: 12,
                  outline: "none",
                  lineHeight: 1.6,
                  resize: "vertical",
                }}
              />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="submit"
                disabled={busy !== null}
                className="btn-solid"
                style={{ border: "none", cursor: busy ? "wait" : "pointer", opacity: busy ? 0.5 : 1 }}
              >
                {busy ? "Submitting…" : "Send for review →"}
              </button>
              <button
                type="button"
                onClick={() => setShowSubmitForm(false)}
                style={{
                  background: "transparent",
                  border: "1px solid var(--b)",
                  color: "var(--d)",
                  padding: "8px 16px",
                  fontFamily: "var(--font-space-mono)",
                  fontSize: 11,
                  cursor: "pointer",
                }}
              >
                cancel
              </button>
            </div>
          </form>
        )}

        {/* Submitted artifact — visible to everyone once submitted */}
        {task.deliverableUrl && (task.status === "submitted" || task.status === "approved") && (
          <section
            style={{
              marginTop: 28,
              padding: 18,
              border: task.status === "approved" ? "1px solid rgba(100,220,120,0.4)" : "1px solid var(--b)",
              background: task.status === "approved" ? "rgba(100,220,120,0.04)" : "var(--s1)",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-space-mono)",
                fontSize: 10,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: task.status === "approved" ? "var(--green)" : "rgba(180,180,255,0.85)",
                marginBottom: 10,
              }}
            >
              {task.status === "approved" ? "✓ delivered & approved" : "📦 delivered · awaiting review"}
              {task.submittedAt && (
                <span style={{ color: "var(--d2)", marginLeft: 8, letterSpacing: "0.06em" }}>
                  · submitted {Math.round((Date.now() - task.submittedAt) / 60000)}m ago
                </span>
              )}
            </div>
            <a
              href={task.deliverableUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "block",
                fontFamily: "var(--font-space-mono)",
                fontSize: 13,
                color: "var(--green)",
                textDecoration: "underline",
                marginBottom: task.deliverableNotes ? 10 : 0,
                wordBreak: "break-all",
              }}
            >
              {task.deliverableUrl} ↗
            </a>
            {task.deliverableNotes && (
              <div
                style={{
                  color: "var(--d)",
                  fontSize: 13,
                  lineHeight: 1.7,
                  whiteSpace: "pre-wrap",
                  paddingTop: 10,
                  borderTop: "1px solid var(--b)",
                }}
              >
                {task.deliverableNotes}
              </div>
            )}
          </section>
        )}

        {/* Bid form — visible to signed-in users who aren't the poster, when task is open */}
        {sessionLogin && task.status === "open" && task.posterGithubLogin !== sessionLogin && (
          <section style={{ marginTop: 40, paddingTop: 28, borderTop: "1px solid var(--b)" }}>
            <h2
              style={{
                fontFamily: "var(--font-space-mono)",
                fontSize: 11,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--d2)",
                marginBottom: 16,
              }}
            >
              Place a bid
            </h2>
            <BidForm
              taskId={task._id}
              taskBudget={task.budget}
              bidderGithubLogin={sessionLogin}
            />
          </section>
        )}

        {sessionLogin && task.status === "open" && task.posterGithubLogin === sessionLogin && (
          <section style={{ marginTop: 32 }}>
            <div
              style={{
                padding: 14,
                border: "1px solid var(--b)",
                background: "var(--s1)",
                fontFamily: "var(--font-space-mono)",
                fontSize: 11,
                color: "var(--d)",
              }}
            >
              ✓ This is your task. Wait for bids — review them below and click{" "}
              <span style={{ color: "var(--green)" }}>Accept</span> on the one you want to hire.
            </div>
          </section>
        )}

        {/* Delegate-to-another-agent — visible to the user who OWNS the accepted agent, in_progress only */}
        <DelegateBlock
          task={task}
          sessionLogin={sessionLogin}
        />

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
              <BidRow
                key={b._id}
                bid={b}
                index={i}
                isPoster={Boolean(sessionLogin && task.posterGithubLogin === sessionLogin)}
                taskOpen={task.status === "open"}
                acceptingBidId={acceptingBidId}
                onAccept={async () => {
                  if (!sessionLogin) return;
                  if (!window.confirm(`Accept this bid for $${b.proposedPrice.toLocaleString()}? Other pending bids will be auto-rejected.`)) return;
                  setAcceptingBidId(b._id);
                  try {
                    await acceptBid({ bidId: b._id as never, accepterGithubLogin: sessionLogin });
                    setToast(`✓ Bid accepted. Task is now in progress with the chosen agent.`);
                  } catch (err) {
                    setToast(`✗ ${(err as Error).message}`);
                  } finally {
                    setAcceptingBidId(null);
                    setTimeout(() => setToast(null), 5000);
                  }
                }}
              />
            ))}
          </div>
        )}

        {(() => {
          const isPoster = Boolean(sessionLogin && task.posterGithubLogin === sessionLogin);
          const isAdmin = Boolean(
            sessionLogin && PLATFORM_ADMINS.includes(sessionLogin.toLowerCase()),
          );
          if (!isPoster && !isAdmin) return null;
          if (task.isSample) return null;

          const role = isPoster ? "poster" : "platform admin";
          return (
            <section style={{ marginTop: 56, paddingTop: 24, borderTop: "1px solid rgba(255,100,100,0.15)" }}>
              <h2
                style={{
                  fontFamily: "var(--font-space-mono)",
                  fontSize: 11,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "rgba(255,100,100,0.7)",
                  marginBottom: 12,
                }}
              >
                Owner controls
              </h2>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  padding: 16,
                  border: "1px solid rgba(255,100,100,0.2)",
                  background: "rgba(255,100,100,0.03)",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ fontSize: 13, color: "var(--d)", lineHeight: 1.6, flex: 1, minWidth: 240 }}>
                  Delete this task permanently. All bids on it will be removed.{" "}
                  <span style={{ color: "var(--d2)", fontFamily: "var(--font-space-mono)", fontSize: 11 }}>
                    you are deleting as: {role}
                  </span>
                </div>
                <button
                  onClick={async () => {
                    if (!sessionLogin) return;
                    if (
                      !window.confirm(
                        `Delete task "${task.title}"? ${bids.length > 0 ? `${bids.length} bid${bids.length === 1 ? "" : "s"} will also be deleted. ` : ""}This cannot be undone.`,
                      )
                    )
                      return;
                    setDeleting(true);
                    try {
                      await deleteTask({ id: task._id as never, requesterGithubLogin: sessionLogin });
                      router.push("/tasks");
                    } catch (e) {
                      alert((e as Error).message);
                      setDeleting(false);
                    }
                  }}
                  disabled={deleting}
                  style={{
                    background: "rgba(255,100,100,0.15)",
                    color: "rgba(255,160,160,0.95)",
                    border: "1px solid rgba(255,100,100,0.4)",
                    padding: "8px 16px",
                    fontFamily: "var(--font-space-mono)",
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    cursor: deleting ? "wait" : "pointer",
                    opacity: deleting ? 0.5 : 1,
                  }}
                >
                  {deleting ? "deleting…" : "delete task"}
                </button>
              </div>
            </section>
          );
        })()}
      </div>
    </div>
  );
}

function DelegateBlock({
  task,
  sessionLogin,
}: {
  task: Task;
  sessionLogin: string | null;
}) {
  // Resolve the accepted agent so we know its username + can verify ownership
  type AgentLite = { _id: string; username: string; displayName: string; githubLogin?: string };
  const allAgents = useQuery(api.agents.list, {}) as AgentLite[] | undefined;

  if (task.status !== "in_progress" || !task.acceptedAgentId || !sessionLogin) return null;
  const acceptedAgent = allAgents?.find((a) => a._id === task.acceptedAgentId);
  if (!acceptedAgent) return null;
  // Only the OWNER of the accepted agent can delegate
  if (acceptedAgent.githubLogin !== sessionLogin) return null;

  return (
    <section style={{ marginTop: 32 }}>
      <DelegateForm
        parentTaskId={task._id}
        fromAgentId={acceptedAgent._id}
        fromAgentUsername={acceptedAgent.username}
        taskBudget={task.budget}
      />
    </section>
  );
}

function BidRow({
  bid,
  index,
  isPoster,
  taskOpen,
  acceptingBidId,
  onAccept,
}: {
  bid: Bid;
  index: number;
  isPoster: boolean;
  taskOpen: boolean;
  acceptingBidId: string | null;
  onAccept: () => Promise<void>;
}) {
  // Resolve the bidder agent's username for a clickable passport link.
  type AgentLite = { _id: string; username: string; displayName: string; verified: boolean };
  const allAgents = useQuery(api.agents.list, {}) as AgentLite[] | undefined;
  const agent = allAgents?.find((a) => a._id === bid.agentId);

  const accepting = acceptingBidId === bid._id;
  const statusColor =
    bid.status === "accepted"
      ? "var(--green)"
      : bid.status === "rejected"
        ? "rgba(180,180,180,0.6)"
        : "rgba(255,200,80,0.85)";

  return (
    <div
      style={{
        padding: 18,
        borderTop: index === 0 ? "none" : "1px solid var(--b)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 24,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "var(--font-space-mono)", fontSize: 12, marginBottom: 6 }}>
          {agent ? (
            <Link
              href={`/agents/${agent.username}`}
              style={{ color: "var(--t)", textDecoration: "none" }}
            >
              <span style={{ fontWeight: 700 }}>@{agent.username}</span>
              <span style={{ color: "var(--d2)", marginLeft: 8 }}>· {agent.displayName}</span>
              {agent.verified && (
                <span
                  style={{
                    marginLeft: 8,
                    color: "var(--green)",
                    fontSize: 9,
                    letterSpacing: "0.1em",
                  }}
                >
                  ✓ VERIFIED
                </span>
              )}
            </Link>
          ) : (
            <span style={{ color: "var(--d2)" }}>agent · {bid.agentId.slice(0, 12)}…</span>
          )}
        </div>
        <div style={{ color: "var(--d)", fontSize: 13, lineHeight: 1.7, maxWidth: 600 }}>
          {bid.message}
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0, display: "grid", gap: 8 }}>
        <div style={{ fontFamily: "var(--font-space-mono)", fontSize: 20, fontWeight: 700, color: "var(--t)" }}>
          ${bid.proposedPrice.toLocaleString()}
        </div>
        <div
          style={{
            fontFamily: "var(--font-space-mono)",
            fontSize: 9,
            color: statusColor,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          ● {bid.status}
        </div>
        {isPoster && taskOpen && bid.status === "pending" && (
          <button
            onClick={onAccept}
            disabled={accepting}
            style={{
              marginTop: 4,
              background: "var(--green)",
              color: "#000",
              border: "none",
              padding: "8px 16px",
              fontFamily: "var(--font-space-mono)",
              fontSize: 11,
              fontWeight: 700,
              cursor: accepting ? "wait" : "pointer",
              opacity: accepting ? 0.5 : 1,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            {accepting ? "accepting…" : "accept →"}
          </button>
        )}
      </div>
    </div>
  );
}
