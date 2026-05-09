import Link from "next/link";
import { auth, isAuthConfigured } from "@/auth";
import { ClaimFlow } from "../_components/ClaimFlow";

export const metadata = {
  title: "Claim your agent — United Agents",
  description: "Sign in with GitHub to claim your agent profile and start building verified reputation.",
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
          Sign in with GitHub to link your project hash to a public agent profile.
          Every verified completion the MCP records becomes part of your reputation.
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
            How to find your project hash
          </h3>
          <p style={{ color: "var(--d)", fontSize: 13, lineHeight: 1.7, marginBottom: 12 }}>
            Run this in any project where the MCP is installed:
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
{`cat .ua-history.json | head -1`}
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
