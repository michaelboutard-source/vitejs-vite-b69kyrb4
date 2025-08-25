// src/pages/Dashboard.tsx
import React, { useEffect, useState } from "react";
import { Card } from "@components/Card";
import { db } from "@db";
import { useI18n } from "@i18n";

type TradeStatus = "open" | "closed";
interface Trade {
  id: string;
  status: TradeStatus;
  market: "spot" | "futures";
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

export function DashboardPage() {
  const { t } = useI18n();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [starting, setStarting] = useState<number>(0);
  const [autoRefresh, setAuto] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const list = await db.trades.orderBy("openedAt").reverse().toArray();
      const kvStart = await db.meta.get({ key: "startingBalance" });
      const kvAuto = await db.meta.get({ key: "autoRefresh" });
      setTrades(list as Trade[]);
      setStarting(typeof kvStart?.value === "number" ? kvStart.value : 0);
      setAuto(!!kvAuto?.value);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(async () => {
      const list = await db.trades.orderBy("openedAt").reverse().toArray();
      setTrades(list as Trade[]);
    }, 2000);
    return () => clearInterval(id);
  }, [autoRefresh]);

  const closed = trades.filter(t => t.status === "closed" && typeof t.exitPrice === "number");
  const totalPL = closed.reduce((s, t) => s + tradePnlClosed(t), 0);
  const current = +(starting + totalPL).toFixed(2);
  const pctChange = starting > 0 ? +(((current - starting) / starting) * 100).toFixed(2) : 0;
  const totalTrades = trades.length;
  const wins = closed.filter(t => tradePnlClosed(t) > 0).length;
  const winRate = closed.length ? +((wins / closed.length) * 100).toFixed(2) : 0;

  const grossRealized = closed.reduce((s, t) => {
    const dir = t.side === "long" ? 1 : -1;
    const gross = (t.exitPrice! - t.entryPrice) * t.quantity * dir;
    return s + gross;
  }, 0);
  const feesClosed = closed.reduce((s, t) => s + (t.fees || 0), 0);
  const netRealized = grossRealized - feesClosed;

  async function promptStarting() {
    const v = prompt("Enter starting balance (USDT)", starting ? String(starting) : "50");
    if (v === null) return;
    const n = Number(String(v).replace(",", "."));
    if (!isFinite(n) || n < 0) return alert("Please enter a valid number");
    await db.meta.put({ key: "startingBalance", value: n });
    setStarting(n);
  }
  async function toggleAuto() {
    const v = !autoRefresh;
    await db.meta.put({ key: "autoRefresh", value: v });
    setAuto(v);
  }
  async function refresh() {
    const list = await db.trades.orderBy("openedAt").reverse().toArray();
    setTrades(list as Trade[]);
  }

  return (
    <>
      <Card title={t("dashboard_title")} subtitle={t("dashboard_sub")}>
        <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={promptStarting} style={btn}>
            {starting ? `Starting: ${starting} USDT (change)` : "Set Starting Balance"}
          </button>
          <button onClick={refresh} disabled={autoRefresh} style={{ ...btn, opacity: autoRefresh ? 0.5 : 1 }}>
            Refresh
          </button>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#64748b" }}>
            <input type="checkbox" checked={autoRefresh} onChange={toggleAuto} />
            Auto-refresh
          </label>
        </div>

        {loading ? (
          <div>Loading…</div>
        ) : (
          <div style={gridWrap}>
            <Stat label="Starting Balance" value={`${starting || 0} USDT`} />
            <Stat label="Current Balance" value={`${current} USDT`} />
            <Stat label="% Change" value={`${pctChange}%`} />
            <Stat label="Gross Gains (closed)" value={`${grossRealized >= 0 ? "+" : ""}${grossRealized.toFixed(2)} USDT`} hint="Before fees" />
            <Stat label="Net Gains (closed)" value={`${netRealized >= 0 ? "+" : ""}${netRealized.toFixed(2)} USDT`} hint="After fees" />
          </div>
        )}
      </Card>

      <Card title="KPIs" subtitle="Totals based on CLOSED trades">
        <div style={gridWrap}>
          <Stat label="Total P/L" value={`${totalPL.toFixed(2)} USDT`} />
          <Stat label="Total Trades" value={`${totalTrades}`} />
          <Stat label="Closed Trades" value={`${closed.length}`} />
          <Stat label="Win Rate" value={`${winRate}%`} />
        </div>
      </Card>
    </>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div style={statBox}>
      <div style={{ fontSize: 12, color: "#64748b" }}>
        {label} {hint && <span style={{ color: "#94a3b8" }}>({hint})</span>}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700 }}>{value}</div>
    </div>
  );
}
const gridWrap: React.CSSProperties = { display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" };
const statBox: React.CSSProperties = { background: "#f8fafc", borderRadius: 12, padding: 16 };
const btn: React.CSSProperties = { padding: "8px 10px", borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff" };
