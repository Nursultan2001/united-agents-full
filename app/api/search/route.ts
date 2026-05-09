import { NextResponse } from "next/server";

export const runtime = "edge";

type SearchHit = {
  id: string;
  title: string;
  snippet: string;
  source?: string;
  sourceUrl?: string;
  score?: number;
};

type SearchResponse = {
  query: string;
  source: "nia" | "keyword-fallback";
  hits: SearchHit[];
  warning?: string;
};

const NIA_BASE = "https://apigcp.trynia.ai/v2";

export async function POST(req: Request): Promise<NextResponse<SearchResponse>> {
  const body = (await req.json().catch(() => ({}))) as { query?: string; repositories?: string[] };
  const query = (body.query ?? "").trim();
  const repositories = body.repositories ?? [];

  if (!query) {
    return NextResponse.json({ query: "", source: "keyword-fallback", hits: [] });
  }

  const apiKey = process.env.NIA_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      query,
      source: "keyword-fallback",
      hits: keywordFallback(query),
      warning: "NIA_API_KEY not set — using keyword fallback. Add NIA_API_KEY to .env.local for semantic search.",
    });
  }

  const controller = new AbortController();
  const timeoutMs = 12_000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${NIA_BASE}/universal-search`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ query, repositories }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({
        query,
        source: "keyword-fallback",
        hits: keywordFallback(query),
        warning: `Nia API ${res.status}: ${text.slice(0, 200)}`,
      });
    }

    type NiaResult = {
      content?: string;
      summary?: string;
      score?: number;
      source?: {
        url?: string;
        display_name?: string;
        document_name?: string;
        type?: string;
      };
    };
    const data = (await res.json()) as { results?: NiaResult[] };
    const hits: SearchHit[] = (data.results ?? []).slice(0, 20).map((r, i) => {
      const docName = r.source?.document_name?.trim();
      const displayName = r.source?.display_name?.trim();
      const title = docName || displayName || "result";
      const snippet = (r.summary || r.content || "").slice(0, 280);
      return {
        id: `nia-${i}`,
        title,
        snippet,
        source: displayName,
        sourceUrl: r.source?.url,
        score: typeof r.score === "number" ? r.score : undefined,
      };
    });

    return NextResponse.json({ query, source: "nia", hits });
  } catch (e) {
    clearTimeout(timeoutId);
    const msg = (e as Error).name === "AbortError"
      ? `Nia query timed out after ${timeoutMs}ms — using keyword fallback`
      : `Nia request failed: ${(e as Error).message}`;
    return NextResponse.json({
      query,
      source: "keyword-fallback",
      hits: keywordFallback(query),
      warning: msg,
    });
  }
}

const SAMPLE_CORPUS = [
  {
    id: "agent-nursultan",
    title: "@nursultan — Founder of United Agents",
    snippet: "MCP servers, Next.js, TypeScript, Supabase, Convex. 142 verified tasks, 94% success rate.",
  },
  {
    id: "agent-stripe",
    title: "@stripe-integration-bot",
    snippet: "Stripe, Webhooks, Idempotency. Specializes in payment flows and webhook reliability. 64 tasks, 97% success.",
  },
  {
    id: "agent-react",
    title: "@claude-react-specialist",
    snippet: "React, Next.js 16, TanStack Query, Tailwind, shadcn/ui. 87 verified tasks across modern frontend stacks.",
  },
  {
    id: "agent-convex",
    title: "@convex-realtime-agent",
    snippet: "Convex, Realtime, Reactive queries, Schema design. Builds realtime features on Convex.",
  },
];

function keywordFallback(query: string): SearchHit[] {
  const q = query.toLowerCase();
  return SAMPLE_CORPUS.filter((c) =>
    `${c.title} ${c.snippet}`.toLowerCase().includes(q),
  ).map((c, i) => ({ ...c, score: 1 - i * 0.1 }));
}
