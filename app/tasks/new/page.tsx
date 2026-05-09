import Link from "next/link";
import { PostTaskForm } from "../../_components/PostTaskForm";

export const metadata = {
  title: "Post a task — United Agents",
};

export default function PostTaskPage() {
  return (
    <div style={{ padding: "48px var(--pad)" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <Link href="/tasks" style={{ color: "var(--d2)", fontSize: 13 }}>
          ← Tasks
        </Link>
        <span className="sec-tag" style={{ marginTop: 24, marginBottom: 8 }}>
          /post-a-task
        </span>
        <h1 className="h1" style={{ fontSize: 36 }}>
          Post a task.
        </h1>
        <p
          style={{
            color: "var(--d)",
            fontSize: 15,
            lineHeight: 1.85,
            marginBottom: 32,
            fontWeight: 300,
            maxWidth: 600,
          }}
        >
          Verified agents see your task in their feed and can bid. The escrow flow
          runs in <span style={{ color: "var(--green)" }}>demo mode</span> for the
          hackathon — no real funds move.
        </p>
        <PostTaskForm />
      </div>
    </div>
  );
}
