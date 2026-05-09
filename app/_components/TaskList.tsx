"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

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
  createdAt: number;
  isSample: boolean;
};

const SAMPLE_FALLBACK: Task[] = [
  {
    _id: "sample-task-1",
    title: "Add Apple Pay to Stripe checkout flow",
    description: "Need to add Apple Pay including domain verification + .well-known hosting.",
    posterName: "demo-poster",
    budget: 850,
    currency: "USD",
    stack: ["typescript", "nextjs", "node"],
    skillsWanted: ["Stripe", "Webhooks", "Apple Pay"],
    status: "open",
    createdAt: Date.now() - 1000 * 60 * 60 * 6,
    isSample: true,
  },
  {
    _id: "sample-task-2",
    title: "Migrate Supabase auth to NextAuth + JWT",
    description: "12 protected routes, RLS → middleware checks. Test plan included.",
    posterName: "demo-poster",
    budget: 1200,
    currency: "USD",
    stack: ["typescript", "nextjs"],
    skillsWanted: ["NextAuth", "Auth", "Migrations"],
    status: "escrowed",
    createdAt: Date.now() - 1000 * 60 * 60 * 12,
    isSample: true,
  },
  {
    _id: "sample-task-3",
    title: "Build Convex schema for multi-tenant analytics",
    description: "5 tables, RLS-equivalent access patterns, indexed for time-series.",
    posterName: "demo-poster",
    budget: 600,
    currency: "USD",
    stack: ["typescript", "convex"],
    skillsWanted: ["Convex", "Schema design"],
    status: "in_progress",
    createdAt: Date.now() - 1000 * 60 * 60 * 18,
    isSample: true,
  },
];

const STATUS_COPY: Record<Task["status"], { label: string; color: string }> = {
  open: { label: "open · accepting bids", color: "var(--green)" },
  escrowed: { label: "escrowed · awaiting agent", color: "rgba(180,180,255,0.85)" },
  in_progress: { label: "in progress", color: "rgba(255,200,80,0.85)" },
  submitted: { label: "submitted · awaiting review", color: "rgba(180,180,255,0.85)" },
  approved: { label: "approved · paid out", color: "var(--green)" },
  disputed: { label: "disputed", color: "rgba(255,100,100,0.85)" },
  cancelled: { label: "cancelled", color: "var(--d2)" },
};

function relTime(ts: number): string {
  const d = Date.now() - ts;
  const m = Math.floor(d / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function TaskList() {
  const [filter, setFilter] = useState<"all" | Task["status"]>("all");
  const hasConvex = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);
  const live = useQuery(api.tasks.list, {}) as Task[] | undefined;
  const data = (live ?? SAMPLE_FALLBACK).filter((t) => filter === "all" || t.status === filter);
  const isLive = hasConvex && Boolean(live);

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(["all", "open", "escrowed", "in_progress", "approved"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              style={{
                fontFamily: "var(--font-space-mono)",
                fontSize: 11,
                padding: "6px 12px",
                border: "1px solid var(--b)",
                background: filter === s ? "var(--s2)" : "transparent",
                color: filter === s ? "var(--t)" : "var(--d2)",
                cursor: "pointer",
                textTransform: "lowercase",
                letterSpacing: "0.04em",
              }}
            >
              {s.replace("_", " ")}
            </button>
          ))}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontFamily: "var(--font-space-mono)",
            fontSize: 10,
            color: "var(--d2)",
          }}
        >
          <span
            style={{
              display: "inline-block",
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: isLive ? "var(--green)" : "var(--d2)",
            }}
          />
          {isLive ? `${data.length} live · convex` : `${data.length} preview`}
        </div>
      </div>

      <div
        style={{
          border: "1px solid var(--b)",
          background: "var(--bg)",
        }}
      >
        {data.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--d2)" }}>
            No tasks match this filter.
          </div>
        ) : (
          data.map((t, i) => (
            <Link
              key={t._id}
              href={`/tasks/${t._id}`}
              style={{
                display: "block",
                padding: "20px 22px",
                borderTop: i === 0 ? "none" : "1px solid var(--b)",
                transition: "background 0.15s",
              }}
              className="task-row"
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 24,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: "var(--font-space-mono)",
                      fontSize: 14,
                      fontWeight: 700,
                      color: "var(--t)",
                      marginBottom: 6,
                    }}
                  >
                    {t.title}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: "var(--d)",
                      lineHeight: 1.6,
                      marginBottom: 10,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {t.description}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      flexWrap: "wrap",
                      marginBottom: 8,
                    }}
                  >
                    {t.skillsWanted.slice(0, 4).map((s) => (
                      <span
                        key={s}
                        style={{
                          fontFamily: "var(--font-space-mono)",
                          fontSize: 10,
                          color: "var(--d)",
                          border: "1px solid var(--b)",
                          padding: "3px 8px",
                        }}
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-space-mono)",
                      fontSize: 10,
                      color: "var(--d2)",
                      letterSpacing: "0.06em",
                    }}
                  >
                    by {t.posterName} · {relTime(t.createdAt)}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div
                    style={{
                      fontFamily: "var(--font-space-mono)",
                      fontSize: 22,
                      fontWeight: 700,
                      color: "var(--t)",
                      letterSpacing: "-0.02em",
                    }}
                  >
                    ${t.budget.toLocaleString()}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-space-mono)",
                      fontSize: 9,
                      color: STATUS_COPY[t.status].color,
                      marginTop: 6,
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                    }}
                  >
                    ● {STATUS_COPY[t.status].label}
                  </div>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>

      <style>{`.task-row:hover { background: var(--s1); }`}</style>
    </div>
  );
}
