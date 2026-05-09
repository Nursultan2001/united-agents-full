import Link from "next/link";
import { auth, isAuthConfigured } from "@/auth";
import { ClaimFlow } from "../_components/ClaimFlow";

export const metadata = {
  title: "Claim your agent — United Agents",
  description: "Sign in with GitHub to claim your agent profile and start building verified reputation.",
  openGraph: {
    title: "Claim your AI agent · United Agents",
    description: "Link your GitHub repo to a public agent passport. Verified reputation from real MCP-tracked work.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Claim your AI agent · United Agents",
    description: "Verified reputation for AI coding agents.",
  },
};

export default async function ClaimPage() {
  const session = isAuthConfigured ? await auth() : null;

  return (
    <div style={{ padding: "48px var(--pad)" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <span className="sec-tag">/claim</span>
        <h1 className="h1" style={{ fontSize: 36 }}>
          Claim your agent.
        </h1>
        <p
          style={{
            color: "var(--d)",
            fontSize: 15,
            lineHeight: 1.85,
            marginTop: 12,
            marginBottom: 32,
            fontWeight: 300,
          }}
        >
          Sign in with GitHub, name your agent, paste a public GitHub repo. We
          auto-detect the project hash from your <code style={{ color: "var(--green)" }}>.ua-history.json</code>,
          extract skills via{" "}
          <a href="https://www.trynia.ai/" target="_blank" rel="noreferrer" style={{ color: "var(--green)" }}>
            Nia
          </a>
          , and pull the bio straight from your README — no manual fields beyond name + repo.
        </p>

        <ClaimFlow configured={isAuthConfigured} session={session} />

        <div
          style={{
            marginTop: 24,
            border: "1px solid var(--b)",
            padding: 24,
            background: "var(--s1)",
          }}
        >
          <h3
            style={{
              fontFamily: "var(--font-space-mono)",
              fontSize: 13,
              fontWeight: 700,
              marginBottom: 10,
            }}
          >
            Project hash · auto-detected (no action needed)
          </h3>
          <p style={{ color: "var(--d)", fontSize: 13, lineHeight: 1.7, marginBottom: 12 }}>
            With <code style={{ color: "var(--green)" }}>united-agents-mcp@1.0.18+</code>, every event in your
            project&apos;s <code>.ua-history.json</code> is stamped with the hash. The form above reads it
            straight from your repo on GitHub — you should never have to compute or paste it.
          </p>
          <p style={{ color: "var(--d2)", fontSize: 12, lineHeight: 1.7, marginBottom: 10 }}>
            If auto-detect fails (older MCP, private repo, or missing history file), you can still get the
            hash with one command:
          </p>
          <pre
            style={{
              background: "#0d0d14",
              border: "1px solid var(--b)",
              padding: 14,
              fontFamily: "var(--font-space-mono)",
              fontSize: 12,
              color: "var(--t)",
              overflowX: "auto",
            }}
          >
{`cd your-project && united-agents-mcp hash`}
          </pre>
        </div>

        <div
          style={{
            marginTop: 32,
            display: "flex",
            justifyContent: "space-between",
            fontSize: 13,
            color: "var(--d2)",
          }}
        >
          <Link href="/install" style={{ color: "var(--d2)" }}>
            ← need the MCP first
          </Link>
          <Link href="/agents" style={{ color: "var(--d2)" }}>
            browse the registry →
          </Link>
        </div>
      </div>
    </div>
  );
}
