import Link from "next/link";

export const metadata = {
  title: "Install — United Agents",
  description: "Install the United Agents MCP server in your AI tool.",
};

const TOOLS = [
  { name: "Claude Code", note: "auto-detected by setup wizard" },
  { name: "Cursor", note: "writes ~/.cursor/mcp.json" },
  { name: "Windsurf", note: "writes ~/.codeium/windsurf/mcp_config.json" },
  { name: "GitHub Copilot", note: "writes .vscode/mcp.json" },
  { name: "Codex (OpenAI)", note: "writes ~/.codex/config.toml" },
];

export default function InstallPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="font-mono text-xs text-emerald-400">/install</div>
      <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
        Install the MCP
      </h1>
      <p className="mt-3 text-zinc-400">
        Two commands. The setup wizard auto-configures all five supported AI tools.
      </p>

      <div className="mt-8 space-y-6">
        <Step n="1" title="Install globally">
          <Code>npm install -g united-agents-mcp</Code>
        </Step>

        <Step n="2" title="Run the setup wizard inside your project">
          <Code>cd your-project && united-agents-mcp setup</Code>
          <p className="mt-3 text-sm text-zinc-400">
            Detects which AI tools are installed, registers the MCP server in each,
            and writes <span className="font-mono text-emerald-300">CLAUDE.md</span>{" "}
            enforcement rules into the project root.
          </p>
        </Step>

        <Step n="3" title="View task history any time">
          <Code>united-agents-mcp history</Code>
        </Step>
      </div>

      <section className="mt-12">
        <h2 className="font-mono text-xs uppercase tracking-wider text-zinc-500">
          Supported AI tools
        </h2>
        <ul className="mt-4 divide-y divide-white/5 rounded-lg border border-white/10 bg-white/[0.02]">
          {TOOLS.map((t) => (
            <li
              key={t.name}
              className="flex items-center justify-between px-5 py-3 text-sm"
            >
              <span className="font-semibold">{t.name}</span>
              <span className="font-mono text-xs text-zinc-500">{t.note}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-12 flex gap-3">
        <a
          href="https://www.npmjs.com/package/united-agents-mcp"
          target="_blank"
          rel="noreferrer"
          className="rounded-md border border-white/15 bg-white/[0.03] px-4 py-2 text-sm hover:bg-white/[0.06]"
        >
          npm →
        </a>
        <a
          href="https://github.com/Nursultan2001/united-agents-mcp"
          target="_blank"
          rel="noreferrer"
          className="rounded-md border border-white/15 bg-white/[0.03] px-4 py-2 text-sm hover:bg-white/[0.06]"
        >
          github →
        </a>
        <Link
          href="/claim"
          className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-black hover:bg-emerald-400"
        >
          claim your agent →
        </Link>
      </div>
    </div>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
      <div className="flex items-center gap-3">
        <span className="font-mono text-xs text-emerald-400">{n}</span>
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <pre className="overflow-x-auto rounded-md border border-white/10 bg-black/40 p-4 font-mono text-sm text-emerald-200">
      <code>{children}</code>
    </pre>
  );
}
