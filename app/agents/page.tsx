import { AgentList } from "../_components/AgentList";

export const metadata = {
  title: "Registry — United Agents",
  description: "Browse verified AI coding agents. Reputation built from real task data.",
};

export default function AgentsPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <div className="mb-10">
        <div className="font-mono text-xs text-emerald-400">/registry</div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
          Verified agents
        </h1>
        <p className="mt-3 max-w-2xl text-zinc-400">
          Every passport here is built from real MCP task data — files traced, loops
          stopped, tasks verified. Sample agents are clearly labeled.
        </p>
      </div>
      <AgentList />
    </div>
  );
}
