// src/pages/KPIs.tsx
import React, { useEffect, useState, useMemo } from "react";
import { Card } from "@components/Card";
import { db } from "@db";
import { useI18n } from "@i18n";
import { PieChart, Legend } from "@components/Chart";

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

  const closed = trades.filter((t) => t.status === "closed" && typeof t.exitPrice === "number");

  const realizedPL = closed.map(tradePnlClosed);

  const equityCurve = useMemo(() => {
    let acc = 0;
    return realizedPL.map((pl) => {
      acc += pl;
      return acc;
    });
  }, [realizedPL]);

  // === FIX: replaced .at() ===
  const firstEquity = equityCurve.length ? equityCurve[0] : 0;
  const lastEquity = equityCurve.length ? equityCurve[equityCurve.length - 1] : 0;
  const change = lastEquity - firstEquity;

  const best = realizedPL.length ? Math.max(...realizedPL) : 0;
  const worst = realizedPL.length ? Math.min(...realizedPL) : 0;
  const avg = realizedPL.length ? (realizedPL.reduce((a, b) => a + b, 0) / realizedPL.length) : 0;

  return (
    <Card title="KPIs" subtitle="Performance metrics from closed trades.">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        <Stat label="Change in Equity" value={`${change.toFixed(2)} USDT`} />
        <Stat label="Best Trade" value={`${best.toFixed(2)} USDT`} />
        <Stat label="Worst Trade" value={`${worst.toFixed(2)} USDT`} />
        <Stat label="Average P/L" value={`${avg.toFixed(2)} USDT`} />
        <Stat label="Total Trades" value={`${closed.length}`} />
      </div>

      <Card title="Equity Curve">
        {equityCurve.length ? (
          <svg width="100%" height="200" style={{ background: "#f8fafc" }}>
            <polyline
              fill="none"
              stroke="#3b82f6"
              strokeWidth="2"
              points={equityCurve.map((v, i) => `${i * 20},${200 - v}`).join(" ")}
            />
          </svg>
        ) : (
          <div style={{ color: "#64748b" }}>No closed trades yet</div>
        )}
      </Card>
    </Card>
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
