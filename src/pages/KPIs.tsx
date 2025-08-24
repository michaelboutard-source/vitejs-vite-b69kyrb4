// src/pages/KPIs.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Card } from "@components/Card";
import { Th, Td } from "@components/Inputs";
import { useI18n } from "@i18n";
import { db } from "@db";

/** Types mirrored from Journal */
export type TradeStatus = "open" | "closed";
export interface Trade {
  id: string;
  status: TradeStatus;
  market: "spot" | "futures";
  exchange?: string;
  symbol: string;
  side: "long" | "short";
  entryPrice: number;
  exitPrice?: number;
  quantity: number;
  fees?: number;
  openedAt: string;
  closedAt?: string;
  notes?: string;
}

function tradePnl(t: Trade) {
  if (t.status !== "closed" || typeof t.exitPrice !== "number") return 0;
  const dir = t.side === "long" ? 1 : -1;
  const gross = (t.exitPrice - t.entryPrice) * t.quantity * dir;
  const fees = t.fees || 0;
  return +(gross - fees).toFixed(2);
}

/** Tiny inline sparkline to avoid extra imports */
function Sparkline({
  values,
  width = 220,
  height = 48,
  strokeWidth = 2,
}: {
  values: number[];
  width?: number;
  height?: number;
  strokeWidth?: number;
}) {
  const pad = 4;
  const W = width;
  const H = height;
  if (!values || values.length === 0) {
    return (
      <svg width={W} height={H} role="img" aria-label="sparkline">
        <rect x={0} y={0} width={W} height={H} fill="#f1f5f9" />
      </svg>
    );
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = (W - pad * 2) / Math.max(1, values.length - 1);

  const pts = values.map((v, i) => {
    const x = pad + i * stepX;
    const y = pad + (H - pad * 2) * (1 - (v - min) / span);
    return `${x},${y}`;
  });

  // baseline (zero) if in range
  const hasZero = min <= 0 && max >= 0;
  const zeroY = hasZero
    ? pad + (H - pad * 2) * (1 - (0 - min) / span)
    : null;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="sparkline">
      <rect x={0} y={0} width={W} height={H} fill="#f8fafc" />
      {zeroY !== null && (
        <line x1={0} y1={zeroY} x2={W} y2={zeroY} stroke="#e2e8f0" strokeWidth={1} />
      )}
      <polyline
        fill="none"
        stroke="#111827"
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
        points={pts.join(" ")}
      />
    </svg>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div style={{ background: "#f8fafc", borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 12, color: "#64748b" }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700 }}>{value}</div>
      {hint && <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

export function KPIsPage() {
  const { t } = useI18n();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const list = await db.trades.toArray();
      setTrades(list as Trade[]);
      setLoading(false);
    })();
  }, []);

  const closed = useMemo(
    () => (trades as Trade[])
      .filter((x) => x.status === "closed" && typeof x.exitPrice === "number")
      .sort((a, b) => {
        const da = new Date(a.closedAt || a.openedAt).getTime();
        const dbb = new Date(b.closedAt || b.openedAt).getTime();
        return da - dbb;
      }),
    [trades]
  );

  /** Equity: cumulative realized P/L over time */
  const equity = useMemo(() => {
    let acc = 0;
    const out: number[] = [];
    for (const t of closed) {
      acc += tradePnl(t);
      out.push(+acc.toFixed(2));
    }
    return out;
  }, [closed]);

  const kpis = useMemo(() => {
    const n = closed.length;
    const realized = closed.reduce((s, t) => s + tradePnl(t), 0);
    const wins = closed.filter((t) => tradePnl(t) > 0).length;
    const losses = n - wins;
    const winRate = n ? (wins / n) * 100 : 0;
    const avgPL = n ? realized / n : 0;
    const best = n ? Math.max(...closed.map(tradePnl)) : 0;
    const worst = n ? Math.min(...closed.map(tradePnl)) : 0;

    // average return % per trade (based on entry * qty)
    const returns = closed
      .map((t) => {
        const cost = t.entryPrice * t.quantity;
        if (!cost) return 0;
        return (tradePnl(t) / cost) * 100;
      })
      .filter((x) => Number.isFinite(x));
    const avgRetPct = returns.length ? returns.reduce((s, x) => s + x, 0) / returns.length : 0;

    // average holding time
    const holdsMs = closed
      .map((t) => {
        const open = new Date(t.openedAt).getTime();
        const close = new Date(t.closedAt || t.openedAt).getTime();
        return Math.max(0, close - open);
      })
      .filter((x) => Number.isFinite(x));
    const avgHoldMs = holdsMs.length ? holdsMs.reduce((s, x) => s + x, 0) / holdsMs.length : 0;

    function fmtDuration(ms: number) {
      const d = Math.floor(ms / (24 * 3600e3));
      const h = Math.floor((ms % (24 * 3600e3)) / 3600e3);
      const m = Math.floor((ms % 3600e3) / 60e3);
      if (d > 0) return `${d}d ${h}h`;
      if (h > 0) return `${h}h ${m}m`;
      return `${m}m`;
    }

    return {
      realized: +realized.toFixed(2),
      winRate: +winRate.toFixed(2),
      trades: n,
      avgPL: +avgPL.toFixed(2),
      best: +best.toFixed(2),
      worst: +worst.toFixed(2),
      avgRetPct: +avgRetPct.toFixed(2),
      avgHold: fmtDuration(avgHoldMs),
    };
  }, [closed]);

  /** Per-symbol breakdown */
  const bySymbol = useMemo(() => {
    const map = new Map<
      string,
      { pl: number; n: number; wins: number; avgPL: number; winRate: number }
    >();
    for (const t of closed) {
      const pl = tradePnl(t);
      const prev = map.get(t.symbol) || { pl: 0, n: 0, wins: 0, avgPL: 0, winRate: 0 };
      const next = { ...prev, pl: prev.pl + pl, n: prev.n + 1, wins: prev.wins + (pl > 0 ? 1 : 0) };
      next.avgPL = next.n ? next.pl / next.n : 0;
      next.winRate = next.n ? (next.wins / next.n) * 100 : 0;
      map.set(t.symbol, next);
    }
    const rows = Array.from(map.entries()).map(([symbol, v]) => ({
      symbol,
      pl: +v.pl.toFixed(2),
      n: v.n,
      wins: v.wins,
      winRate: +v.winRate.toFixed(2),
      avgPL: +v.avgPL.toFixed(2),
    }));
    rows.sort((a, b) => Math.abs(b.pl) - Math.abs(a.pl));
    return rows;
  }, [closed]);

  return (
    <>
      <Card title="Key Performance Indicators" subtitle="Closed trades only.">
        {loading ? (
          <div>Loading…</div>
        ) : (
          <>
            {/* KPI tiles */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 12 }}>
              <Stat label="Realized P/L" value={`${kpis.realized >= 0 ? "+" : ""}${kpis.realized} USDT`} />
              <Stat label="Win rate" value={`${kpis.winRate}%`} hint={`${kpis.trades} closed trades`} />
              <Stat label="Avg P/L per trade" value={`${kpis.avgPL >= 0 ? "+" : ""}${kpis.avgPL} USDT`} />
              <Stat label="Avg return %" value={`${kpis.avgRetPct >= 0 ? "+" : ""}${kpis.avgRetPct}%`} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 12 }}>
              <Stat label="Best trade" value={`${kpis.best >= 0 ? "+" : ""}${kpis.best} USDT`} />
              <Stat label="Worst trade" value={`${kpis.worst >= 0 ? "+" : ""}${kpis.worst} USDT`} />
              <Stat label="Avg hold time" value={kpis.avgHold} />
              <Stat label="Equity (last)" value={`${(equity.at(-1) ?? 0).toFixed(2)} USDT`} />
            </div>

            {/* Equity sparkline */}
            <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 16, alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>Equity curve (cumulative realized P/L)</div>
                <Sparkline values={equity} width={240} height={60} />
              </div>
              <div style={{ color: "#64748b" }}>
                Shows cumulative realized P/L across all closed trades in chronological order.
              </div>
            </div>
          </>
        )}
      </Card>

      <Card title="Symbols performance" subtitle="Total P/L, win rate and average P/L per symbol (closed trades).">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "#eef2f7" }}>
                <Th>Symbol</Th>
                <Th>Closed</Th>
                <Th>Wins</Th>
                <Th style={{ textAlign: "right" }}>Total P/L</Th>
                <Th style={{ textAlign: "right" }}>Win rate</Th>
                <Th style={{ textAlign: "right" }}>Avg P/L</Th>
              </tr>
            </thead>
            <tbody>
              {bySymbol.map((r) => (
                <tr key={r.symbol} style={{ borderTop: "1px solid #e2e8f0" }}>
                  <Td>{r.symbol}</Td>
                  <Td>{r.n}</Td>
                  <Td>{r.wins}</Td>
                  <Td style={{ textAlign: "right", color: r.pl >= 0 ? "#059669" : "#dc2626" }}>
                    {r.pl.toFixed(2)}
                  </Td>
                  <Td style={{ textAlign: "right" }}>{r.winRate.toFixed(2)}%</Td>
                  <Td style={{ textAlign: "right", color: r.avgPL >= 0 ? "#059669" : "#dc2626" }}>
                    {r.avgPL.toFixed(2)}
                  </Td>
                </tr>
              ))}
              {!bySymbol.length && (
                <tr>
                  <td colSpan={6} style={{ padding: 16, textAlign: "center", color: "#64748b" }}>
                    No closed trades yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
