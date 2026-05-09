"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

const STACK_OPTIONS = ["typescript", "javascript", "react", "nextjs", "node", "python", "go", "rust", "convex", "supabase"];

export function PostTaskForm() {
  const router = useRouter();
  const post = useMutation(api.tasks.post);
  const hasConvex = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState<string>("");
  const [posterName, setPosterName] = useState("");
  const [stack, setStack] = useState<string[]>([]);
  const [skillsInput, setSkillsInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleStack(s: string) {
    setStack((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!hasConvex) {
      setError("Convex isn't connected. Run `npx convex dev` first to enable posting.");
      return;
    }
    const budgetNum = parseInt(budget, 10);
    if (!title || !description || !budgetNum || !posterName || stack.length === 0) {
      setError("Fill in title, description, budget, your name, and at least one stack tag.");
      return;
    }
    setBusy(true);
    try {
      const skills = skillsInput
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const id = await post({
        title,
        description,
        budget: budgetNum,
        posterName,
        stack,
        skillsWanted: skills,
      });
      router.push(`/tasks/${id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "var(--bg)",
    border: "1px solid var(--b)",
    color: "var(--t)",
    padding: "10px 12px",
    fontFamily: "var(--font-space-mono)",
    fontSize: 13,
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

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 20 }}>
      <div>
        <label style={labelStyle}>Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Add Apple Pay to Stripe checkout flow"
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={6}
          placeholder="Describe the task. Include repo context, test plan, and acceptance criteria."
          style={{ ...inputStyle, lineHeight: 1.7, resize: "vertical" }}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <label style={labelStyle}>Budget (USD)</label>
          <input
            type="number"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder="850"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Your name</label>
          <input
            type="text"
            value={posterName}
            onChange={(e) => setPosterName(e.target.value)}
            placeholder="alice or alice@company.com"
            style={inputStyle}
          />
        </div>
      </div>

      <div>
        <label style={labelStyle}>Stack tags (pick what applies)</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {STACK_OPTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => toggleStack(s)}
              style={{
                fontFamily: "var(--font-space-mono)",
                fontSize: 11,
                padding: "6px 12px",
                border: "1px solid var(--b)",
                background: stack.includes(s) ? "var(--green)" : "transparent",
                color: stack.includes(s) ? "#000" : "var(--d2)",
                cursor: "pointer",
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label style={labelStyle}>Skills wanted (comma-separated)</label>
        <input
          type="text"
          value={skillsInput}
          onChange={(e) => setSkillsInput(e.target.value)}
          placeholder="Stripe, Webhooks, Apple Pay"
          style={inputStyle}
        />
      </div>

      {error && (
        <div
          style={{
            border: "1px solid rgba(255,100,100,0.4)",
            background: "rgba(255,100,100,0.05)",
            padding: 12,
            color: "rgba(255,160,160,0.95)",
            fontFamily: "var(--font-space-mono)",
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button
          type="submit"
          disabled={busy}
          className="btn-solid"
          style={{ cursor: busy ? "wait" : "pointer", opacity: busy ? 0.5 : 1, border: "none" }}
        >
          {busy ? "Posting…" : "Post task →"}
        </button>
        <span
          style={{
            fontFamily: "var(--font-space-mono)",
            fontSize: 10,
            color: "var(--d2)",
            letterSpacing: "0.08em",
          }}
        >
          posts directly to Convex · escrow runs in demo mode
        </span>
      </div>
    </form>
  );
}
