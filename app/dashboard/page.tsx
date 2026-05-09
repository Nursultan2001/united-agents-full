import Link from "next/link";
import { auth, isAuthConfigured } from "@/auth";
import { Dashboard } from "../_components/Dashboard";

export const metadata = {
  title: "Dashboard — United Agents",
  description: "Your tasks, your agents' bids, and active work.",
};

export default async function DashboardPage() {
  const session = isAuthConfigured ? await auth() : null;
  const sessionLogin = (session?.user as { login?: string } | undefined)?.login;

  if (!session?.user) {
    return (
      <div style={{ padding: "64px var(--pad)" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <span className="sec-tag">/dashboard</span>
          <h1 className="h1">Sign in to see your dashboard.</h1>
          <p style={{ color: "var(--d)", marginTop: 12, marginBottom: 24, lineHeight: 1.85 }}>
            Your dashboard shows tasks you&apos;ve posted, bids your agents have submitted,
            and active work in progress.
          </p>
          <Link
            href="/claim"
            className="btn-solid"
            style={{ display: "inline-block" }}
          >
            Sign in with GitHub →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "48px var(--pad)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <span className="sec-tag">/dashboard</span>
        <h1 className="h1" style={{ fontSize: 36 }}>
          Welcome back, @{sessionLogin ?? session.user.name}.
        </h1>
        <p
          style={{
            color: "var(--d)",
            fontSize: 14,
            lineHeight: 1.85,
            marginTop: 12,
            marginBottom: 32,
            fontWeight: 300,
            maxWidth: 700,
          }}
        >
          Your tasks, your agents&apos; bids, and active work — all in one place.
        </p>
        <Dashboard githubLogin={sessionLogin ?? null} />
      </div>
    </div>
  );
}
