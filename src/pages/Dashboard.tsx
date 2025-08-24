import React, { useEffect, useState } from "react";
import { Card, Stat } from "@components/Card";
import { useI18n } from "@i18n";
import { db, type Trade, getStartingBalance, getAutoRefresh } from "@db";

/** helpers */
function tradeGross(t: Trade) {
  if (t.status !== "closed" || typeof t.exitPrice !== "number") return 0;
  const dir = t.side === "long" ? 1 : -1;
  const gross = (t.exitPrice - t.entryPrice) * t.quantity * dir;
  return +gross.toFixed(6);
}
function tradeNet(t: Trade) {
  if (t.status !== "closed" || typeof t.exitPrice !== "number") return 0;
  const gross = tradeGross(t);
  const fees = t.fees || 0;
  return +(gross - fees).toFixed(6);
}

export function DashboardPage() {
  const { t } = useI18n();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [starting, setStarting] = useState<number>(0);
  const [autoRefresh, setAuto] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [list, s, ar] = await Promise.all([
        db.trades.orderBy("openedAt").reverse().toArray(),
        getStartingBalance(),
        getAutoRefresh(),
      ]);
      setTrades(list);
      setStarting(s || 0);
      setAuto(ar);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(async () => {
      const list = await db.trades.orderBy("openedAt").reverse().toArray();
      setTrades(list);
    }, 2000);
    return () => clearInterval(id);
  }, [autoRefresh]);

  const closed = trades.filter((t) => t.status === "closed" && typeof t.exitPrice === "number");

  // NEW metrics
  const grossGains = closed.reduce((s, t) => {
    const g = tradeGross(t);
    return g > 0 ? s + g : s;
  }, 0);
  const netGains = closed.reduce((s, t) => s + tradeNet(t), 0);

  // Existing
  const current = +(starting + netGains).toFixed(2);
  const pctChange = starting > 0 ? +(((current - starting) / starting) * 100).toFixed(2) : 0;

  const totalTrades = trades.length;
  const wins = closed.filter((t) => tradeNet(t) > 0).length;
  const winRate = closed.length ? +((wins / closed.length) * 100).toFixed(2) : 0;

  async function promptStarting() {
    const v = prompt("Enter starting balance (USDT)", starting ? String(starting) : "50");
    if (v === null) return;
    const n = Number(v);
    if (!isFinite(n) || n < 0) return alert("Please enter a valid number");
    const mod = await import("@db");
    await mod.setStartingBalance(n);
    setStarting(n);
  }
  async function refresh() {
    const list = await db.trades.orderBy("openedAt").reverse().toArray();
    setTrades(list);
  }

  return (
    <>
      <Card title={t("dashboard_title")} subtitle={t("dashboard_sub")}>
        <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={promptStarting} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff" }}>
            {starting ? `Starting: ${starting} USDT (change)` : "Set Starting Balance"}
          </button>
          <button
            onClick={refresh}
            disabled={autoRefresh}
            title={autoRefresh ? "Auto-refresh is on" : "Manual refresh"}
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid #cbd5e1",
              background: autoRefresh ? "#f1f5f9" : "#fff",
              opacity: autoRefresh ? 0.6 : 1,
            }}
          >
            Refresh
          </button>
          <span style={{ fontSize: 12, color: "#64748b" }}>{autoRefresh ? "Auto-refresh: ON" : "Auto-refresh: OFF"}</span>
        </div>

        {loading ? (
          <div>Loading…</div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
              <Stat label="Starting Balance" value={`${starting || 0} USDT`} />
              <Stat label="Current Balance" value={`${current} USDT`} />
              <Stat label="% Change" value={`${pctChange}%`} />
              <Stat label="Gross Gains (USDT)" value={`${grossGains.toFixed(2)}`} />
              <Stat label="Net Gains (USDT)" value={`${netGains.toFixed(2)}`} />
            </div>
            <div style={{ color: "#64748b", fontSize: 12, marginTop: 8 }}>
              <div><b>Gross Gains</b>: sum of positive P/L before fees. <b>Net Gains</b>: realized P/L after fees (final).</div>
            </div>
          </>
        )}
      </Card>

      <Card title="KPIs" subtitle="Totals based on CLOSED trades">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          <Stat label="Net P/L" value={`${netGains.toFixed(2)} USDT`} />
          <Stat label="Win Rate" value={`${winRate}%`} />
          <Stat label="Closed Trades" value={`${closed.length}`} />
          <Stat label="All Trades" value={`${totalTrades}`} />
        </div>
      </Card>
    </>
  );
}
