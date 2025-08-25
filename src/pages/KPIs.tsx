// src/pages/KPIs.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Card } from "@components/Card";
import { db } from "@db";
import { useI18n } from "@i18n";

type TradeStatus = "open" | "closed";
interface Trade {
  id: string;
  status: TradeStatus;
  symbol: string;
  side: "long" | "short";
  entryPrice: number;
  exitPrice?: number;
  quantity: number;
  fees?: number;
  openedAt: string;
  closedAt?: string;
}

function tradePnlClosed(t: Trade) {
  if (t.status !== "closed" || typeof t.exitPrice !== "number") return 0;
  const dir = t.side === "long" ? 1 : -1;
  const gross = (t.exitPrice - t.entryPrice) * t.quantity * dir;
  return +(gross - (t.fees || 0)).toFixed(2);
}

export function KPIsPage() {
  const { t } = useI18n();
  const [trades, setTrades] = useState<Trade[]>([]);

  useEffect(() => {
    (async () => {
      const list = await db.trades.toArray();
      setTrades(list as Trade[]);
    })();
  }, []);

  const closed = useMemo(() => trades.filter(t => t.status === "closed" && typeof t.exitPrice === "number"), [trades]);
  const realizedPL = useMemo(() => closed.map(tradePnlClosed), [closed]);

  const equityCurve = useMemo(() => {
    let acc = 0;
    return realizedPL.map((pl) => (acc += pl));
  }, [realizedPL]);

  const first = equityCurve.length ? equityCurve[0] : 0;
  const last = equityCurve.length ? equityCurve[equityCurve.length - 1] : 0;
  const change = last - first;

  const best = realizedPL.length ? Math.max(...realizedPL) : 0;
  const worst = realizedPL.length ? Math.min(...realizedPL) : 0;
  const avg = realizedPL.length ? (realizedPL.reduce((a, b) => a + b, 0) / realizedPL.length) : 0;

  // simple svg scaling
  const height = 200;
  const width = Math.max(320, equityCurve.length * 24);
  const minY = Math.min(0, ...equityCurve);
  const maxY = Math.max(0, ...equityCurve);
  const span = Math.max(1, maxY - minY);
  const points = equityCurve.map((v, i) => {
    const x = (i / Math.max(1, equityCurve.length - 1)) * (width - 20) + 10;
    const y = height - ((v - minY) / span) * (height - 20) - 10;
    return `${x},${y}`;
  }).join(" ");

  return (
    <>
      <Card title="KPIs" subtitle="Performance metrics from closed trades.">
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          <Stat label="Change in Equity" value={`${change.toFixed(2)} USDT`} />
          <Stat label="Best Trade" value={`${best.toFixed(2)} USDT`} />
          <Stat label="Worst Trade" value={`${worst.toFixed(2)} USDT`} />
          <Stat label="Average P/L" value={`${avg.toFixed(2)} USDT`} />
          <Stat label="Closed Trades" value={`${closed.length}`} />
        </div>
      </Card>

      <Card title="Equity Curve" subtitle="Cumulative realized P/L over time">
        {equityCurve.length ? (
          <div style={{ overflowX: "auto" }}>
            <svg width={width} height={height} style={{ background: "#f8fafc", borderRadius: 8 }}>
              <polyline fill="none" stroke="#3b82f6" strokeWidth="2" points={points} />
            </svg>
          </div>
        ) : (
          <div style={{ color: "#64748b" }}>No closed trades yet</div>
        )}
      </Card>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "#f8fafc", borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 12, color: "#64748b" }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700 }}>{value}</div>
    </div>
  );
}
