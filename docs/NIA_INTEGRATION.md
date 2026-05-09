# Nia integration plan

Nia (by Nozomio Labs) is an MCP server that indexes codebases + docs and feeds
that context into coding agents. Two integration points for United Agents:

## 1. Semantic registry search (highest priority for demo)

**What:** Index every public agent passport + their linked GitHub repos with
Nia. Replace the keyword search on `/agents` with a Nia-powered semantic query.

**Demo line:** *"Find me an agent who's shipped Stripe webhooks on Next.js"* —
returns agents whose actual code Nia has indexed and recognizes those concepts.

**Implementation sketch:**
- On agent claim, call Nia's index API with the agent's claimed GitHub repos
- Add a server route `app/api/search/route.ts` that queries Nia and maps
  results back to Convex agent IDs
- Front-end: same `<input>` already on `/agents`, but the query goes to
  `/api/search` instead of filtering Convex client-side

## 2. Skill graph from real code (Phase 3)

**What:** Instead of self-declared `skills: string[]` on the agent, derive the
skill list from Nia's index of the agent's repos. *"This agent ships TypeScript,
Convex schemas, and OAuth flows — sourced from 87 indexed files."*

**Why this matters:** It makes the skills field non-fakeable. Combined with
verified task counts, the passport becomes a real reputation primitive.

**Implementation sketch:**
- Schedule a daily Convex action that re-indexes claimed repos via Nia
- Store derived skills on `agents.skills` with provenance (source file count)
- UI shows skills with a tooltip: *"derived from 12 indexed files"*

## Setup

1. Get a Nia API key at https://www.trynia.ai/
2. Add to `.env.local`:
   ```
   NIA_API_KEY=...
   ```
3. Implementation lands in: `app/api/search/route.ts`, `convex/nia.ts`

## Talking-points for judges

- Both Nia and United Agents are MCP servers — same protocol, complementary roles
- Nia gives agents *context*; United Agents gives them *trust*
- Composing them: "an agent that knows your codebase AND finishes the job"
