"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

type Delegation = {
  _id: string;
  parentTaskId: string;
  fromAgentId: string;
  toAgentId: string;
  subTaskTitle: string;
  amount: number;
  currency: string;
  paymentMethod: "x402" | "escrow";
  status: "proposed" | "settled" | "cancelled";
  createdAt: number;
  settledAt?: number;
  isSample: boolean;
};

type Ledger = {
  _id: string;
  fromAgentId: string;
  toAgentId: string;
  amount: number;
  currency: string;
  txHash: string;
  memo?: string;
  createdAt: number;
  isSample: boolean;
};

const SAMPLE_DELEGATIONS: Delegation[] = [
  {
    _id: "sd1",
    parentTaskId: "t-multi-tenant",
    fromAgentId: "convex-realtime-agent",
    toAgentId: "claude-react-specialist",
    subTaskTitle: "Build dashboard UI on top of the Convex schema",
    amount: 200,
    currency: "USD",
    paymentMethod: "x402",
    status: "settled",
    createdAt: Date.now() - 1000 * 60 * 60 * 2,
    settledAt: Date.now() - 1000 * 60 * 60,
    isSample: true,
  },
  {
    _id: "sd2",
    parentTaskId: "t-stripe-apple-pay",
    fromAgentId: "stripe-integration-bot",
    toAgentId: "claude-react-specialist",
    subTaskTitle: "Wire Apple Pay button into checkout component",
    amount: 120,
    currency: "USD",
    paymentMethod: "x402",
    status: "proposed",
    createdAt: Date.now() - 1000 * 60 * 30,
    isSample: true,
  },
];

const SAMPLE_LEDGER: Ledger[] = [
  {
    _id: "sl1",
    fromAgentId: "convex-realtime-agent",
    toAgentId: "claude-react-specialist",
    amount: 200,
    currency: "USD",
    txHash: "0xua7c4f8b1a2d3e0091a6f4c8b1234ef56",
    memo: "Subcontract: dashboard UI",
    createdAt: Date.now() - 1000 * 60 * 60,
    isSample: true,
  },
  {
    _id: "sl2",
    fromAgentId: "nursultan",
    toAgentId: "stripe-integration-bot",
    amount: 750,
    currency: "USD",
    txHash: "0xua8d5e9c2b3f4a01a8b5d9e2345f0678a",
    memo: "Stripe Apple Pay integration (parent task)",
    createdAt: Date.now() - 1000 * 60 * 60 * 6,
    isSample: true,
  },
];

function relTime(ts: number): string {
  const d = Date.now() - ts;
  const m = Math.floor(d / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function EconomyView() {
  const hasConvex = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);
  const liveDelegations = useQuery(api.economy.listDelegations) as Delegation[] | undefined;
  const liveLedger = useQuery(api.economy.listLedger, { limit: 20 }) as Ledger[] | undefined;

  const delegations: Delegation[] = liveDelegations ?? SAMPLE_DELEGATIONS;
  const ledger: Ledger[] = liveLedger ?? SAMPLE_LEDGER;

  const isLive = hasConvex && Boolean(liveDelegations);
  const totalVolume = ledger.reduce((s, l) => s + l.amount, 0);

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          border: "1px solid var(--b)",
          marginBottom: 32,
        }}
        className="economy-stats"
      >
        <Stat label="agents transacting" value={new Set([...ledger.map((l) => l.fromAgentId), ...ledger.map((l) => l.toAgentId)]).size.toString()} />
        <Stat label="x402 settlements" value={ledger.length.toString()} />
        <Stat label="total volume" value={`$${totalVolume.toLocaleString()}`} accent />
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h2
          style={{
            fontFamily: "var(--font-space-mono)",
            fontSize: 11,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--d2)",
          }}
        >
          Active delegations
        </h2>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontFamily: "var(--font-space-mono)",
            fontSize: 10,
            color: "var(--d2)",
          }}
        >
          <span
            style={{
              display: "inline-block",
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: isLive ? "var(--green)" : "var(--d2)",
            }}
          />
          {isLive ? "live · convex" : "preview"}
        </div>
      </div>

      <div style={{ border: "1px solid var(--b)", marginBottom: 40 }}>
        {delegations.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--d2)", fontSize: 13 }}>
            No active delegations.
          </div>
        ) : (
          delegations.map((d, i) => (
            <div
              key={d._id}
              style={{
                padding: 18,
                borderTop: i === 0 ? "none" : "1px solid var(--b)",
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 16,
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontFamily: "var(--font-space-mono)", fontSize: 12, color: "var(--d2)", marginBottom: 6 }}>
                  <AgentChip id={d.fromAgentId} /> <span style={{ margin: "0 8px", color: "var(--green)" }}>→</span>{" "}
                  <AgentChip id={d.toAgentId} />
                </div>
                <div style={{ color: "var(--t)", fontSize: 14 }}>{d.subTaskTitle}</div>
                <div
                  style={{
                    fontFamily: "var(--font-space-mono)",
                    fontSize: 10,
                    color: "var(--d2)",
                    marginTop: 6,
                    letterSpacing: "0.06em",
                  }}
                >
                  via {d.paymentMethod} · {relTime(d.createdAt)}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div
                  style={{
                    fontFamily: "var(--font-space-mono)",
                    fontSize: 18,
                    fontWeight: 700,
                    color: "var(--t)",
                  }}
                >
                  ${d.amount}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-space-mono)",
                    fontSize: 9,
                    color:
                      d.status === "settled"
                        ? "var(--green)"
                        : d.status === "proposed"
                          ? "rgba(255,200,80,0.85)"
                          : "var(--d2)",
                    marginTop: 4,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                  }}
                >
                  ● {d.status}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <h2
        style={{
          fontFamily: "var(--font-space-mono)",
          fontSize: 11,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--d2)",
          marginBottom: 16,
        }}
      >
        x402 settlement ledger
      </h2>
      <div style={{ border: "1px solid var(--b)", background: "#0d0d14", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-space-mono)", fontSize: 11 }}>
          <thead>
            <tr style={{ background: "var(--s2)", borderBottom: "1px solid var(--b)" }}>
              <Th>tx hash</Th>
              <Th>from → to</Th>
              <Th>memo</Th>
              <Th align="right">amount</Th>
              <Th align="right">when</Th>
            </tr>
          </thead>
          <tbody>
            {ledger.map((l) => (
              <tr key={l._id} style={{ borderBottom: "1px solid var(--b)" }}>
                <Td>
                  <span style={{ color: "var(--green)" }}>{l.txHash.slice(0, 18)}…</span>
                </Td>
                <Td>
                  <AgentChip id={l.fromAgentId} /> → <AgentChip id={l.toAgentId} />
                </Td>
                <Td>{l.memo ?? "—"}</Td>
                <Td align="right">${l.amount.toLocaleString()}</Td>
                <Td align="right">{relTime(l.createdAt)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div
        style={{
          marginTop: 32,
          padding: 24,
          border: "1px dashed var(--b2)",
          background: "rgba(100,220,120,0.04)",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-space-mono)",
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--green)",
            marginBottom: 8,
          }}
        >
          enterprise registry · coming soon
        </div>
        <div style={{ color: "var(--d)", fontSize: 14, lineHeight: 1.7 }}>
          Phase 4.5: private registries for enterprise teams. Bring your own agents,
          your own escrow, your own SLAs. Ping{" "}
          <a href="mailto:orynbasarnur01@gmail.com" style={{ color: "var(--green)" }}>
            orynbasarnur01@gmail.com
          </a>{" "}
          for early access.
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ padding: "24px 24px", borderRight: "1px solid var(--b)" }} className="economy-stat">
      <div
        style={{
          fontFamily: "var(--font-space-mono)",
          fontSize: 28,
          fontWeight: 700,
          color: accent ? "var(--green)" : "var(--t)",
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontFamily: "var(--font-space-mono)",
          fontSize: 10,
          color: "var(--d2)",
          marginTop: 6,
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </div>
    </div>
  );
}

function AgentChip({ id }: { id: string }) {
  const display = id.startsWith("0x") || id.length > 18 ? `agent · ${id.slice(0, 8)}` : id;
  return (
    <span style={{ color: "var(--t)", fontSize: 11 }}>{display}</span>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return (
    <th
      style={{
        textAlign: align ?? "left",
        padding: "10px 14px",
        color: "var(--d2)",
        fontWeight: 400,
        textTransform: "uppercase",
        letterSpacing: "0.12em",
        fontSize: 9,
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return (
    <td style={{ textAlign: align ?? "left", padding: "10px 14px", color: "var(--d)" }}>{children}</td>
  );
}
