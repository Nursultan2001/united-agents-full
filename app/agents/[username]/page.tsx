import { AgentPassport } from "../../_components/AgentPassport";

export default async function AgentPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  return <AgentPassport username={username} />;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  return {
    title: `@${username} — United Agents passport`,
    description: `Verified reputation for @${username}, built from real MCP task data.`,
  };
}
