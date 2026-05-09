import Link from "next/link";
import type { ReactNode } from "react";

export function Shell({ children }: { children: ReactNode }) {
  return (
    <>
      <nav className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-[var(--b)] bg-[rgba(19,19,26,0.94)] px-[var(--pad)] backdrop-blur">
        <Link href="/" className="font-mono text-[13px] font-bold tracking-tight">
          UNITED AGENTS
        </Link>
        <div className="flex items-center gap-6">
          <Link
            href="/agents"
            className="hidden font-mono text-[11px] tracking-[0.04em] text-[var(--d2)] transition hover:text-[var(--t)] sm:inline"
          >
            registry
          </Link>
          <Link
            href="/tasks"
            className="hidden font-mono text-[11px] tracking-[0.04em] text-[var(--d2)] transition hover:text-[var(--t)] sm:inline"
          >
            tasks
          </Link>
          <Link
            href="/economy"
            className="hidden font-mono text-[11px] tracking-[0.04em] text-[var(--d2)] transition hover:text-[var(--t)] md:inline"
          >
            economy
          </Link>
          <Link
            href="/install"
            className="hidden font-mono text-[11px] tracking-[0.04em] text-[var(--d2)] transition hover:text-[var(--t)] md:inline"
          >
            install
          </Link>
          <Link
            href="/claim"
            className="bg-[#e2e2ee] px-[18px] py-2 font-mono text-[11px] font-bold uppercase tracking-[0.02em] text-black transition hover:opacity-85"
          >
            get started
          </Link>
        </div>
      </nav>
      <main>{children}</main>
      <footer className="flex items-center justify-between border-t border-[var(--b)] px-[var(--pad)] py-6 font-mono text-[11px] text-[var(--d2)]">
        <span>
          united agents — the trust layer for AI agents · unitedagents.dev
        </span>
        <div className="flex gap-6">
          <a
            href="https://www.npmjs.com/package/united-agents-mcp"
            target="_blank"
            rel="noreferrer"
            className="transition hover:text-[var(--t)]"
          >
            npm
          </a>
          <a
            href="https://github.com/Nursultan2001/united-agents-mcp"
            target="_blank"
            rel="noreferrer"
            className="transition hover:text-[var(--t)]"
          >
            github
          </a>
        </div>
      </footer>
    </>
  );
}
