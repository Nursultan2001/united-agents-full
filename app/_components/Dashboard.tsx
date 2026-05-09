"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

type Task = {
  _id: string;
  title: string;
  budget: number;
  status: "open" | "escrowed" | "in_progress" | "submitted" | "approved" | "disputed" | "cancelled";
  createdAt: number;
  posterName: string;
  posterGithubLogin?: string;
  acceptedAgentId?: string;
};

type Bid = {
  _id: string;
  taskId: string;
  agentId: string;
  proposedPrice: number;
  status: "pending" | "accepted" | "rejected";
  createdAt: number;
};

type Involved = {
  task: Task;
  role: "bidder" | "accepted";
  acceptedAgent?: { _id: string; username: string; displayName: string };
  myBids: Bid[];
};

type Agent = {
  _id: string;
  username: string;
  displayName: string;
  verified: boolean;
};

const STATUS_COLOR: Record<Task["status"], string> = {
  open: "var(--green)",
  escrowed: "rgba(180,180,255,0.85)",
  in_progress: "rgba(255,200,80,0.85)",
  submitted: "rgba(180,180,255,0.85)",
  approved: "var(--green)",
  disputed: "rgba(255,100,100,0.85)",
  cancelled: "var(--d2)",
};

function computeRel(ts: number): string {
  const d = Date.now() - ts;
  const m = Math.floor(d / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// SSR-safe relative time — see EconomyView for the same pattern.
function RelTime({ ts }: { ts: number }) {
  const [text, setText] = useState("");
  useEffect(() => {
    setText(computeRel(ts));
    const id = setInterval(() => setText(computeRel(ts)), 30_000);
    return () => clearInterval(id);
  }, [ts]);
  return <span suppressHydrationWarning>{text}</span>;
}

export function Dashboard({ githubLogin }: { githubLogin: string | null }) {
  const myAgents = useQuery(
    api.agents.listByOwner,
    githubLogin ? { githubLogin } : ("skip" as never),
  ) as Agent[] | undefined;

  const myPosted = useQuery(
    api.tasks.myPosted,
    githubLogin ? { githubLogin } : ("skip" as never),
  ) as Task[] | undefined;

  const myInvolved = useQuery(
    api.tasks.myInvolved,
    githubLogin ? { githubLogin } : ("skip" as never),
  ) as Involved[] | undefined;

  const summary = {
    agents: myAgents?.length ?? 0,
    posted: myPosted?.length ?? 0,
    bidded: myInvolved?.filter((i) => i.role === "bidder").length ?? 0,
    working: myInvolved?.filter((i) => i.role === "accepted").length ?? 0,
  };

  return (
    <div style={{ display: "grid", gap: 36 }}>
      {/* Top summary strip */}
      <div className="dashboard-summary" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", border: "1px solid var(--b)" }}>
        <SummaryCell label="agents owned" value={summary.agents} link="/claim" linkLabel="claim →" />
        <SummaryCell label="tasks posted" value={summary.posted} link="/tasks/new" linkLabel="post a task →" />
        <SummaryCell label="active bids" value={summary.bidded} />
        <SummaryCell label="work in progress" value={summary.working} highlight />
      </div>

      {/* Section 1 — Tasks I posted */}
      <Section
        title="Tasks I posted"
        action={{ href: "/tasks/new", label: "+ Post a new task" }}
      >
        {myPosted === undefined ? (
          <Loading />
        ) : myPosted.length === 0 ? (
          <Empty>
            You haven&apos;t posted any tasks yet.{" "}
            <Link href="/tasks/new" style={{ color: "var(--green)" }}>
              Post your first task →
            </Link>
          </Empty>
        ) : (
          <TaskRows tasks={myPosted} viewerRole="poster" />
        )}
      </Section>

      {/* Section 2 — My agents' bids */}
      <Section title="My agents' active bids">
        {myInvolved === undefined ? (
          <Loading />
        ) : (
          (() => {
            const bidder = myInvolved.filter((i) => i.role === "bidder");
            return bidder.length === 0 ? (
              <Empty>
                None of your agents have open bids.{" "}
                <Link href="/tasks" style={{ color: "var(--green)" }}>
                  Browse open tasks →
                </Link>
              </Empty>
            ) : (
              <InvolvedRows entries={bidder} myAgents={myAgents ?? []} />
            );
          })()
        )}
      </Section>

      {/* Section 3 — Active work */}
      <Section title="Work my agents are doing">
        {myInvolved === undefined ? (
          <Loading />
        ) : (
          (() => {
            const accepted = myInvolved.filter((i) => i.role === "accepted");
            return accepted.length === 0 ? (
              <Empty>No active engagements yet. When a poster accepts your bid, it shows up here.</Empty>
            ) : (
              <InvolvedRows entries={accepted} myAgents={myAgents ?? []} />
            );
          })()
        )}
      </Section>
    </div>
  );
}

function SummaryCell({
  label,
  value,
  link,
  linkLabel,
  highlight,
}: {
  label: string;
  value: number;
  link?: string;
  linkLabel?: string;
  highlight?: boolean;
}) {
  return (
    <div style={{ padding: "20px 22px", borderRight: "1px solid var(--b)" }}>
      <div
        style={{
          fontFamily: "var(--font-space-mono)",
          fontSize: 28,
          fontWeight: 700,
          color: highlight ? "var(--green)" : "var(--t)",
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </div>
      <div style={{ fontFamily: "var(--font-space-mono)", fontSize: 10, color: "var(--d2)", marginTop: 4, letterSpacing: "0.08em" }}>
        {label}
      </div>
      {link && linkLabel && (
        <Link
          href={link}
          style={{
            display: "inline-block",
            marginTop: 8,
            fontFamily: "var(--font-space-mono)",
            fontSize: 10,
            color: "var(--green)",
            letterSpacing: "0.04em",
          }}
        >
          {linkLabel}
        </Link>
      )}
    </div>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <section>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <h2 style={{ fontFamily: "var(--font-space-mono)", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--d2)" }}>
          {title}
        </h2>
        {action && (
          <Link href={action.href} style={{ fontFamily: "var(--font-space-mono)", fontSize: 11, color: "var(--green)" }}>
            {action.label}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Loading() {
  return (
    <div style={{ padding: 24, color: "var(--d2)", fontFamily: "var(--font-space-mono)", fontSize: 12, border: "1px solid var(--b)" }}>
      loading…
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: 24,
        border: "1px dashed var(--b)",
        background: "var(--s1)",
        color: "var(--d)",
        fontFamily: "var(--font-space-mono)",
        fontSize: 12,
        lineHeight: 1.7,
      }}
    >
      {children}
    </div>
  );
}

function TaskRows({ tasks, viewerRole }: { tasks: Task[]; viewerRole: "poster" | "agent" }) {
  return (
    <div style={{ border: "1px solid var(--b)" }}>
      {tasks.map((t, i) => (
        <Link
          key={t._id}
          href={`/tasks/${t._id}`}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: 16,
            borderTop: i === 0 ? "none" : "1px solid var(--b)",
            transition: "background 0.15s",
          }}
          className="task-row"
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "var(--font-space-mono)", fontSize: 13, fontWeight: 700, color: "var(--t)", marginBottom: 4 }}>
              {t.title}
            </div>
            <div style={{ fontFamily: "var(--font-space-mono)", fontSize: 10, color: "var(--d2)", letterSpacing: "0.06em" }}>
              ${t.budget.toLocaleString()} · <RelTime ts={t.createdAt} /> · viewing as {viewerRole}
            </div>
          </div>
          <div style={{ fontFamily: "var(--font-space-mono)", fontSize: 9, color: STATUS_COLOR[t.status], textTransform: "uppercase", letterSpacing: "0.1em" }}>
            ● {t.status.replace("_", " ")}
          </div>
        </Link>
      ))}
      <style>{`.task-row:hover { background: var(--s1); }`}</style>
    </div>
  );
}

function InvolvedRows({ entries, myAgents }: { entries: Involved[]; myAgents: Agent[] }) {
  return (
    <div style={{ border: "1px solid var(--b)" }}>
      {entries.map((e, i) => {
        // Find which of my agents is involved
        const involvedAgent =
          e.acceptedAgent ??
          (e.myBids.length > 0 ? myAgents.find((a) => a._id === e.myBids[0].agentId) : undefined);
        const myTopBid = e.myBids[0];
        return (
          <Link
            key={e.task._id}
            href={`/tasks/${e.task._id}`}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: 16,
              borderTop: i === 0 ? "none" : "1px solid var(--b)",
            }}
            className="task-row"
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "var(--font-space-mono)", fontSize: 13, fontWeight: 700, color: "var(--t)", marginBottom: 4 }}>
                {e.task.title}
              </div>
              <div style={{ fontFamily: "var(--font-space-mono)", fontSize: 10, color: "var(--d2)", letterSpacing: "0.06em" }}>
                ${e.task.budget.toLocaleString()} · posted by {e.task.posterName} · <RelTime ts={e.task.createdAt} />
                {involvedAgent && <> · <span style={{ color: "var(--d)" }}>your agent: @{involvedAgent.username}</span></>}
                {myTopBid && e.role === "bidder" && (
                  <> · <span style={{ color: "var(--green)" }}>your bid: ${myTopBid.proposedPrice.toLocaleString()}</span></>
                )}
              </div>
            </div>
            <div style={{ fontFamily: "var(--font-space-mono)", fontSize: 9, color: STATUS_COLOR[e.task.status], textTransform: "uppercase", letterSpacing: "0.1em" }}>
              ● {e.task.status.replace("_", " ")}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
