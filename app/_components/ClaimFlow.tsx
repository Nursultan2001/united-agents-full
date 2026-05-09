"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { signIn, signOut } from "next-auth/react";
import { useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

type Props = {
  configured: boolean;
  session: {
    user?: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      id?: string;
      login?: string;
    };
  } | null;
};

function slugifyClient(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 40);
}

function parseRepoForPreview(input: string): string | null {
  const cleaned = input.trim().replace(/\.git$/, "").replace(/\/$/, "");
  if (!cleaned) return null;
  const m = cleaned.match(/github\.com[/:]([^/\s]+)\/([^/\s]+)/) ?? cleaned.match(/^([^/\s]+)\/([^/\s]+)$/);
  return m ? `${m[1]}/${m[2]}` : null;
}

export function ClaimFlow({ configured, session }: Props) {
  const [busy, setBusy] = useState(false);
  const [pairing, setPairing] = useState(false);
  const [agentName, setAgentName] = useState("");
  const [projectHash, setProjectHash] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [pairResult, setPairResult] = useState<{ ok: boolean; msg: string; username?: string } | null>(null);
  const [niaStatus, setNiaStatus] = useState<string | null>(null);

  const claim = useMutation(api.agents.claim);
  const registerRepo = useAction(api.nia.registerRepo);
  const extractSkills = useAction(api.nia.extractSkills);
  const backfillStats = useAction(api.nia.backfillStatsFromRepo);
  const generateDescription = useAction(api.nia.generateAgentDescription);
  const detectHash = useAction(api.nia.detectProjectHash);
  const [hashAutoFilled, setHashAutoFilled] = useState(false);
  const [hashDetecting, setHashDetecting] = useState(false);
  const [hashDetectError, setHashDetectError] = useState<string | null>(null);
  const [showHashOverride, setShowHashOverride] = useState(false);
  const hasConvex = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);
  const agentSlug = slugifyClient(agentName);
  const repoPreview = parseRepoForPreview(repoUrl);

  // When the user pastes a parseable repo URL, try to auto-detect the project hash
  // by reading .ua-history.json from the repo (works for united-agents-mcp v1.0.18+).
  useEffect(() => {
    if (!repoPreview || !hasConvex) {
      setHashDetecting(false);
      setHashDetectError(null);
      return;
    }
    if (projectHash && !hashAutoFilled) return; // user-typed hash, leave alone
    let cancelled = false;
    setHashDetecting(true);
    setHashDetectError(null);
    const t = setTimeout(() => {
      detectHash({ repoUrl: repoPreview })
        .then((res) => {
          if (cancelled) return;
          if (res.ok && res.projectHash) {
            setProjectHash(res.projectHash);
            setHashAutoFilled(true);
            setHashDetectError(null);
          } else {
            setHashDetectError(res.error ?? "could not detect");
          }
        })
        .finally(() => {
          if (!cancelled) setHashDetecting(false);
        });
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoPreview, hasConvex]);

  async function handleSignIn() {
    setBusy(true);
    try {
      await signIn("github", { redirectTo: "/claim" });
    } finally {
      setBusy(false);
    }
  }

  async function handlePair(e: React.FormEvent) {
    e.preventDefault();
    setPairResult(null);
    if (!agentName || agentSlug.length < 2) {
      setPairResult({ ok: false, msg: "Pick an agent name (min 2 letters/numbers)." });
      return;
    }
    if (!projectHash || projectHash.length < 8) {
      setPairResult({ ok: false, msg: "Project hash must be at least 8 hex characters." });
      return;
    }
    if (!hasConvex) {
      setPairResult({
        ok: false,
        msg: "Convex isn't connected — run `npx convex dev` first.",
      });
      return;
    }
    const githubLogin = session?.user?.login ?? session?.user?.name;
    if (!githubLogin) {
      setPairResult({ ok: false, msg: "GitHub session missing — sign out and back in to refresh." });
      return;
    }

    setPairing(true);
    setNiaStatus(null);
    try {
      const result = await claim({
        githubLogin,
        ownerAvatarUrl: session?.user?.image ?? undefined,
        agentName,
        projectHash,
        repoUrl: repoUrl.trim() || undefined,
      });
      setPairResult({
        ok: true,
        msg: `Created agent @${result.username} — linked to project ${result.projectHash.slice(0, 8)}…`,
        username: result.username,
      });

      // Fire-and-track Nia indexing + stats backfill if a repo URL was provided
      if (repoUrl.trim()) {
        setNiaStatus("📦 Registering repo with Nia…");
        try {
          const reg = await registerRepo({ repoUrl: repoUrl.trim() });
          if (!reg.ok) {
            setNiaStatus(`⚠ Nia register failed: ${reg.error ?? "unknown"}`);
          } else {
            setNiaStatus(
              reg.status === "already_indexed"
                ? "✓ Repo already indexed by Nia. Extracting skills…"
                : `🔄 Nia is indexing ${reg.repository}. Skills will appear in 1-2 min…`,
            );

            const skillStatus: string[] = [];

            // Skills via Nia
            const extract = await extractSkills({
              agentId: result.agentId as never,
              repository: reg.repository ?? repoUrl.trim(),
            });
            if (extract.ok && extract.skills && extract.skills.length > 0) {
              skillStatus.push(`✓ ${extract.skills.length} skills via Nia`);
            } else if (extract.ok) {
              skillStatus.push("🔄 Skills indexing in progress");
            } else {
              skillStatus.push(`⚠ Skills: ${extract.error ?? "queued"}`);
            }

            // Stats from .ua-history.json in the repo
            const back = await backfillStats({
              agentId: result.agentId as never,
              repoUrl: repoUrl.trim(),
            });
            if (back.ok) {
              skillStatus.push(
                `✓ ${back.tasksCompleted} tasks, ${back.loopsStopped} loops stopped backfilled from MCP history`,
              );
            } else {
              skillStatus.push(`⚠ Stats: ${back.error ?? "no .ua-history.json found"}`);
            }

            // Description from README (or Nia fallback)
            const desc = await generateDescription({
              agentId: result.agentId as never,
              repoUrl: repoUrl.trim(),
            });
            if (desc.ok && desc.bio) {
              skillStatus.push(
                `✓ Bio derived from ${desc.source === "readme" ? "README.md" : "Nia summary"}`,
              );
            } else if (!desc.ok) {
              skillStatus.push(`⚠ Bio: ${desc.error ?? "skipped"}`);
            }

            setNiaStatus(skillStatus.join(" · "));
          }
        } catch (niaErr) {
          setNiaStatus(`⚠ Nia error: ${(niaErr as Error).message}`);
        }
      }

      setAgentName("");
      setProjectHash("");
      setRepoUrl("");
    } catch (err) {
      setPairResult({ ok: false, msg: (err as Error).message });
    } finally {
      setPairing(false);
    }
  }

  if (!configured) {
    return (
      <div
        style={{
          border: "1px solid var(--b)",
          padding: 28,
          background: "var(--s1)",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-space-mono)",
            fontSize: 11,
            color: "var(--d2)",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            marginBottom: 12,
          }}
        >
          oauth not configured
        </div>
        <h2 style={{ fontFamily: "var(--font-space-mono)", fontSize: 20, marginBottom: 12 }}>
          Connect GitHub
        </h2>
        <p style={{ color: "var(--d)", lineHeight: 1.7, fontSize: 14, marginBottom: 16 }}>
          GitHub OAuth is wired but disabled until credentials are set. To enable:
        </p>
        <ol
          style={{
            color: "var(--d)",
            fontSize: 13,
            lineHeight: 1.9,
            paddingLeft: 20,
            marginBottom: 16,
          }}
        >
          <li>
            Create an OAuth app at{" "}
            <a
              href="https://github.com/settings/developers"
              target="_blank"
              rel="noreferrer"
              style={{ color: "var(--green)" }}
            >
              github.com/settings/developers
            </a>
          </li>
          <li>
            Set callback URL to{" "}
            <code style={{ color: "var(--green)" }}>
              http://localhost:3000/api/auth/callback/github
            </code>
          </li>
          <li>
            Add to <code style={{ color: "var(--green)" }}>.env.local</code>:
            <pre
              style={{
                background: "#0d0d14",
                border: "1px solid var(--b)",
                padding: 12,
                marginTop: 8,
                fontSize: 12,
                overflowX: "auto",
              }}
            >
{`GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
AUTH_SECRET=$(openssl rand -base64 32)`}
            </pre>
          </li>
          <li>Restart `npm run dev` and refresh.</li>
        </ol>
        <button
          disabled
          style={{
            background: "var(--s2)",
            color: "var(--d2)",
            padding: "12px 22px",
            border: "1px solid var(--b)",
            fontFamily: "var(--font-space-mono)",
            fontSize: 12,
            cursor: "not-allowed",
            width: "100%",
          }}
        >
          ⚙ configure github oauth to enable
        </button>
      </div>
    );
  }

  if (session?.user) {
    return (
      <div style={{ display: "grid", gap: 24 }}>
        <div style={{ border: "1px solid var(--b)", padding: 24, background: "var(--s1)" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              marginBottom: 20,
            }}
          >
            {session.user.image && (
              <img
                src={session.user.image}
                alt=""
                width={48}
                height={48}
                style={{ borderRadius: "50%", border: "1px solid var(--b)" }}
              />
            )}
            <div>
              <div style={{ fontFamily: "var(--font-space-mono)", fontSize: 14, fontWeight: 700 }}>
                ✓ Signed in as @{session.user.name}
              </div>
              <div style={{ color: "var(--d2)", fontSize: 12 }}>{session.user.email}</div>
            </div>
            <button
              onClick={() => signOut({ redirectTo: "/" })}
              style={{
                marginLeft: "auto",
                background: "transparent",
                border: "1px solid var(--b)",
                color: "var(--d2)",
                padding: "6px 12px",
                fontFamily: "var(--font-space-mono)",
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              sign out
            </button>
          </div>
          <form onSubmit={handlePair} style={{ display: "grid", gap: 18 }}>
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
                Agent name
              </label>
              <input
                type="text"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                placeholder="e.g. daily-food-crm-agent"
                style={{
                  width: "100%",
                  background: "var(--bg)",
                  border: "1px solid var(--b)",
                  color: "var(--t)",
                  padding: "10px 12px",
                  fontFamily: "var(--font-space-mono)",
                  fontSize: 13,
                  outline: "none",
                }}
              />
              <div
                style={{
                  marginTop: 6,
                  fontFamily: "var(--font-space-mono)",
                  fontSize: 10,
                  color: "var(--d2)",
                  letterSpacing: "0.04em",
                }}
              >
                {agentSlug
                  ? <>passport URL → <span style={{ color: "var(--green)" }}>/agents/{agentSlug}</span></>
                  : "what should this agent be called? this becomes the public URL."}
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
                GitHub repo <span style={{ color: "var(--green)", textTransform: "none", letterSpacing: "0.04em" }}>(Nia indexes this for skill extraction)</span>
              </label>
              <input
                type="text"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="owner/repo  ·  e.g. Nursultan2001/mcp-history-viewer"
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
              <div
                style={{
                  marginTop: 6,
                  fontFamily: "var(--font-space-mono)",
                  fontSize: 10,
                  color: "var(--d2)",
                  letterSpacing: "0.04em",
                }}
              >
                {repoUrl.trim() === "" ? (
                  <>accepts: <code>owner/repo</code>, <code>github.com/owner/repo</code>, or full <code>https://</code> URL · repo must be public</>
                ) : repoPreview ? (
                  <>will index → <span style={{ color: "var(--green)" }}>github.com/{repoPreview}</span></>
                ) : (
                  <span style={{ color: "rgba(255,160,160,0.95)" }}>✗ couldn&apos;t parse repo — use <code>owner/repo</code> format</span>
                )}
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
                Project hash <span style={{ color: "var(--green)", textTransform: "none", letterSpacing: "0.04em" }}>(auto-detected from your repo)</span>
              </label>

              {/* Status panel — replaces the input as the primary affordance */}
              <div
                style={{
                  border: hashAutoFilled
                    ? "1px solid rgba(100,220,120,0.4)"
                    : hashDetectError
                      ? "1px solid rgba(255,160,160,0.35)"
                      : "1px solid var(--b)",
                  background: hashAutoFilled ? "rgba(100,220,120,0.04)" : "var(--bg)",
                  padding: "12px 14px",
                  fontFamily: "var(--font-space-mono)",
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  minHeight: 40,
                }}
              >
                {!repoPreview ? (
                  <span style={{ color: "var(--d2)" }}>
                    waiting for a valid GitHub repo above…
                  </span>
                ) : hashDetecting ? (
                  <>
                    <span
                      style={{
                        display: "inline-block",
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "var(--green)",
                        animation: "pulse 1.4s ease infinite",
                      }}
                    />
                    <span style={{ color: "var(--d)" }}>reading .ua-history.json from {repoPreview}…</span>
                  </>
                ) : hashAutoFilled && projectHash ? (
                  <>
                    <span style={{ color: "var(--green)", fontWeight: 700 }}>✓</span>
                    <span style={{ color: "var(--t)" }}>{projectHash}</span>
                    <span style={{ color: "var(--d2)", fontSize: 10, marginLeft: "auto" }}>
                      from .ua-history.json · mcp v1.0.18+
                    </span>
                  </>
                ) : (
                  <>
                    <span style={{ color: "rgba(255,180,140,0.95)" }}>⚠</span>
                    <span style={{ color: "var(--d)", fontSize: 11 }}>
                      {hashDetectError ?? "couldn't auto-detect"} —{" "}
                      <button
                        type="button"
                        onClick={() => setShowHashOverride((v) => !v)}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "var(--green)",
                          fontFamily: "inherit",
                          fontSize: 11,
                          cursor: "pointer",
                          padding: 0,
                          textDecoration: "underline",
                        }}
                      >
                        {showHashOverride ? "hide" : "enter manually"}
                      </button>
                    </span>
                  </>
                )}
              </div>

              {(showHashOverride || (!hashAutoFilled && projectHash)) && (
                <input
                  type="text"
                  value={projectHash}
                  onChange={(e) => {
                    setProjectHash(e.target.value.replace(/[^a-fA-F0-9]/g, ""));
                    setHashAutoFilled(false);
                  }}
                  placeholder="run `united-agents-mcp hash` in your project to get this"
                  style={{
                    marginTop: 8,
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
              )}
            </div>

            <button
              type="submit"
              disabled={pairing}
              className="btn-solid"
              style={{
                border: "none",
                cursor: pairing ? "wait" : "pointer",
                opacity: pairing ? 0.5 : 1,
                justifySelf: "start",
              }}
            >
              {pairing ? "Creating agent…" : "Create agent →"}
            </button>
            {pairResult && (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  border: "1px solid var(--b)",
                  background: pairResult.ok ? "rgba(100,220,120,0.05)" : "rgba(255,100,100,0.05)",
                  fontFamily: "var(--font-space-mono)",
                  fontSize: 11,
                  color: pairResult.ok ? "var(--green)" : "rgba(255,160,160,0.95)",
                  lineHeight: 1.7,
                }}
              >
                {pairResult.ok ? "✓ " : "✗ "}
                {pairResult.msg}
                {pairResult.ok && pairResult.username && (
                  <div style={{ marginTop: 8 }}>
                    <Link
                      href={`/agents/${pairResult.username}`}
                      style={{ color: "var(--green)", textDecoration: "underline" }}
                    >
                      View your passport →
                    </Link>
                  </div>
                )}
              </div>
            )}
            {niaStatus && (
              <div
                style={{
                  marginTop: 10,
                  padding: 12,
                  border: "1px solid var(--b2)",
                  background: "rgba(100,220,120,0.04)",
                  fontFamily: "var(--font-space-mono)",
                  fontSize: 11,
                  color: "var(--d)",
                  lineHeight: 1.7,
                }}
              >
                <span style={{ color: "var(--green)", marginRight: 6 }}>nia ▸</span>
                {niaStatus}
              </div>
            )}
          </form>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={handleSignIn}
      disabled={busy}
      style={{
        background: "var(--t)",
        color: "#000",
        padding: "14px 22px",
        border: "none",
        fontFamily: "var(--font-space-mono)",
        fontSize: 13,
        fontWeight: 700,
        cursor: busy ? "wait" : "pointer",
        opacity: busy ? 0.5 : 1,
        width: "100%",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
      }}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" style={{ fill: "currentColor" }}>
        <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.75 1.18 1.75 1.18 1.02 1.74 2.67 1.24 3.32.95.1-.74.4-1.24.72-1.53-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.15 1.18.92-.26 1.9-.39 2.88-.39s1.96.13 2.88.39c2.19-1.49 3.15-1.18 3.15-1.18.62 1.58.23 2.75.11 3.04.74.81 1.18 1.84 1.18 3.1 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.13v3.16c0 .31.21.67.8.56C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5Z" />
      </svg>
      {busy ? "redirecting…" : "Continue with GitHub"}
    </button>
  );
}
