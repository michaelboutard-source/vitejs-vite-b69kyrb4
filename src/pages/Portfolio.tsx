// src/pages/Portfolio.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Card } from "@components/Card";
import { Th, Td } from "@components/Inputs";
import { PieChart, Legend } from "@components/Chart";
import { useI18n } from "@i18n";
import { db } from "@db";

type TradeStatus = "open" | "closed";
interface Trade {
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
function tradePnlClosed(t: Trade) {
  if (t.status !== "closed" || typeof t.exitPrice !== "number") return 0;
  const dir = t.side === "long" ? 1 : -1;
  const gross = (t.exitPrice - t.entryPrice) * t.quantity * dir;
  return +(gross - (t.fees || 0)).toFixed(2);
}
async function getAllPrices(symbols: string[]): Promise<Record<string, number>> {
  const map: Record<string, number> = {};
  for (const s of symbols) {
    const kv = await db.meta.get({ key: `price:${s}` });
    const v = typeof kv?.value === "number" ? kv.value : NaN;
    if (!Number.isNaN(v)) map[s] = v;
  }
  return map;
}
async function setPrice(symbol: string, price: number) {
  await db.meta.put({ key: `price:${symbol}`, value: price });
}
type SortKey = "symbol" | "market" | "side" | "qty" | "entry" | "price" | "value" | "unreal";
type SortDir = "asc" | "desc";

export function PortfolioPage() {
  const { t } = useI18n();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [fMarket, setFMarket] = useState<"all" | "spot" | "futures">("all");
  const [sortKey, setSortKey] = useState<SortKey>("value");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    (async () => {
      const list = await db.trades.toArray();
      setTrades(list as Trade[]);
      const syms = Array.from(new Set((list as Trade[]).map(x => x.symbol)));
      const pm = await getAllPrices(syms);
      setPrices(pm);
      setLoading(false);
    })();
  }, []);

  async function refresh() {
    setLoading(true);
    const list = await db.trades.toArray();
    setTrades(list as Trade[]);
    const syms = Array.from(new Set((list as Trade[]).map(x => x.symbol)));
    const pm = await getAllPrices(syms);
    setPrices(pm);
    setLoading(false);
  }

  const openTrades = useMemo(() => (trades as Trade[]).filter(t => t.status === "open"), [trades]);

  type PosRow = {
    symbol: string;
    market: "spot" | "futures";
    side: "long" | "short";
    qty: number;
    avgEntry: number;
    price: number | null;
    value: number;
    unreal: number;
    fees: number;
  };

  const positions: PosRow[] = useMemo(() => {
    const key = (t: Trade) => `${t.symbol}|${t.market}|${t.side}`;
    const buckets = new Map<string, { qty: number; cost: number; fees: number; symbol: string; market: "spot" | "futures"; side: "long" | "short" }>();
    for (const t of openTrades) {
      const k = key(t);
      const dir = t.side === "long" ? 1 : -1;
      const prev = buckets.get(k) || { qty: 0, cost: 0, fees: 0, symbol: t.symbol, market: t.market, side: t.side };
      prev.qty += dir * t.quantity;
      prev.cost += t.entryPrice * t.quantity;
      prev.fees += t.fees || 0;
      buckets.set(k, prev);
    }
    const out: PosRow[] = [];
    for (const b of buckets.values()) {
      const p = prices[b.symbol];
      const avgEntry = b.qty === 0 ? 0 : b.cost / Math.abs(b.qty);
      const cur = Number.isFinite(p) ? p : null;
      const value = cur !== null ? b.qty * cur : 0;
      const unreal = cur !== null ? (((cur - avgEntry) * (b.side === "long" ? 1 : -1)) * Math.abs(b.qty) - b.fees) : 0;
      out.push({
        symbol: b.symbol,
        market: b.market,
        side: b.side,
        qty: +b.qty.toFixed(6),
        avgEntry: +avgEntry.toFixed(6),
        price: cur,
        value: +Number(value).toFixed(2),
        unreal: +Number(unreal).toFixed(2),
        fees: +b.fees.toFixed(2),
      });
    }
    return out;
  }, [openTrades, prices]);

  const totalValue = positions.reduce((s, p) => s + p.value, 0);
  const totalUnreal = positions.reduce((s, p) => s + p.unreal, 0);
  const closed = useMemo(() => (trades as Trade[]).filter(t => t.status === "closed" && typeof t.exitPrice === "number"), [trades]);
  const realizedPL = closed.reduce((s, t) => s + tradePnlClosed(t), 0);

  const grossRealized = closed.reduce((s, t) => {
    const dir = t.side === "long" ? 1 : -1;
    const gross = (t.exitPrice! - t.entryPrice) * t.quantity * dir;
    return s + gross;
  }, 0);
  const feesClosed = closed.reduce((s, t) => s + (t.fees || 0), 0);
  const netRealized = grossRealized - feesClosed;

  const allocData = useMemo(() => {
    const bySym = new Map<string, number>();
    for (const p of positions) bySym.set(p.symbol, (bySym.get(p.symbol) || 0) + Math.abs(p.value));
    const arr = Array.from(bySym.entries()).map(([label, value]) => ({ label, value }));
    arr.sort((a, b) => b.value - a.value);
    return arr;
  }, [positions]);

  const unrealBySym = useMemo(() => {
    const bySym = new Map<string, number>();
    for (const p of positions) bySym.set(p.symbol, (bySym.get(p.symbol) || 0) + p.unreal);
    const arr = Array.from(bySym.entries()).map(([label, value]) => ({ label, value }));
    arr.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    return arr;
  }, [positions]);

  function onSort(k: SortKey) {
    setSortKey(prev => {
      if (prev === k) { setSortDir(d => (d === "asc" ? "desc" : "asc")); return prev; }
      setSortDir("asc"); return k;
    });
  }
  const sorted = useMemo(() => {
    const arr = positions.filter(p => {
      if (fMarket !== "all" && p.market !== fMarket) return false;
      if (q && !p.symbol.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
    arr.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortKey) {
        case "symbol": return a.symbol.localeCompare(b.symbol) * dir;
        case "market": return a.market.localeCompare(b.market) * dir;
        case "side":   return a.side.localeCompare(b.side) * dir;
        case "qty":    return (a.qty - b.qty) * dir;
        case "entry":  return (a.avgEntry - b.avgEntry) * dir;
        case "price":  return ((a.price ?? -Infinity) - (b.price ?? -Infinity)) * dir;
        case "value":  return (a.value - b.value) * dir;
        case "unreal": return (a.unreal - b.unreal) * dir;
      }
    });
    return arr;
  }, [positions, fMarket, q, sortKey, sortDir]);

  function onLocalPriceChange(sym: string, v: string) {
    setPrices(prev => ({ ...prev, [sym]: v === "" ? NaN : Number(String(v).replace(",", ".")) }));
  }
  async function onLocalPriceBlur(sym: string) {
    const v = prices[sym];
    if (Number.isFinite(v)) await setPrice(sym, v);
  }

  return (
    <>
      <Card title={t("portfolio_title")} subtitle="Derived from OPEN trades. Enter prices to see value & unrealized P/L.">
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
          <input placeholder="Search symbol…" value={q} onChange={e => setQ(e.target.value)} style={ctl} />
          <select value={fMarket} onChange={e => setFMarket(e.target.value as any)} style={ctl}>
            <option value="all">Market: All</option>
            <option value="spot">Spot</option>
            <option value="futures">Futures</option>
          </select>
          <button onClick={refresh} style={{ ...ctl, background: "#fff" }}>Refresh</button>
          <span style={{ color: "#64748b", fontSize: 12 }}>{loading ? "Loading…" : `${positions.length} position group(s)`}</span>
        </div>

        {/* Summary cards (responsive) */}
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          <Stat label="Total Market Value" value={`${totalValue.toFixed(2)} USDT`} />
          <Stat label="Unrealized P/L" value={`${totalUnreal >= 0 ? "+" : ""}${totalUnreal.toFixed(2)} USDT`} />
          <Stat label="Realized P/L (closed)" value={`${realizedPL >= 0 ? "+" : ""}${realizedPL.toFixed(2)} USDT`} />
          <div style={statBox}>
            <div style={{ fontSize: 12, color: "#64748b" }}>Gains (closed)</div>
            <div style={{ fontSize: 14, marginTop: 6 }}>
              <b>Gross:</b> {grossRealized >= 0 ? "+" : ""}{grossRealized.toFixed(2)} USDT
            </div>
            <div style={{ fontSize: 14 }}>
              <b>Net:</b> {netRealized >= 0 ? "+" : ""}{netRealized.toFixed(2)} USDT
              <span style={{ color: "#94a3b8" }}> (after fees)</span>
            </div>
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: "auto", marginTop: 12 }}>
          <table style={{ width: "100%", minWidth: 640, fontSize: 14 }}>
            <thead>
              <tr style={{ background: "#eef2f7" }}>
                <Th><button onClick={() => onSort("symbol")} style={headBtn}>Symbol</button></Th>
                <Th><button onClick={() => onSort("market")} style={headBtn}>Market</button></Th>
                <Th><button onClick={() => onSort("side")}   style={headBtn}>Side</button></Th>
                <Th><button onClick={() => onSort("qty")}    style={headBtn}>Qty</button></Th>
                <Th><button onClick={() => onSort("entry")}  style={headBtn}>Avg Entry</button></Th>
                <Th><button onClick={() => onSort("price")}  style={headBtn}>Price</button></Th>
                <Th style={{ textAlign: "right" }}><button onClick={() => onSort("value")}  style={headBtn}>Value</button></Th>
                <Th style={{ textAlign: "right" }}><button onClick={() => onSort("unreal")} style={headBtn}>Unrealized P/L</button></Th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => (
                <tr key={`${p.symbol}-${p.market}-${p.side}`} style={{ borderTop: "1px solid #e2e8f0" }}>
                  <Td>{p.symbol}</Td>
                  <Td>{p.market}</Td>
                  <Td style={{ color: p.side === "long" ? "#059669" : "#dc2626" }}>{p.side}</Td>
                  <Td>{p.qty}</Td>
                  <Td>{p.avgEntry}</Td>
                  <Td>
                    <input
                      type="number"
                      step="any"
                      inputMode="decimal"
                      value={Number.isFinite(prices[p.symbol]) ? String(prices[p.symbol]) : ""}
                      onChange={(e) => setPrices(prev => ({ ...prev, [p.symbol]: e.target.value === "" ? NaN : Number(String(e.target.value).replace(",", ".")) }))}
                      onBlur={() => onLocalPriceBlur(p.symbol)}
                      placeholder="Set price"
                      style={{ padding: 6, borderRadius: 8, border: "1px solid #cbd5e1", minWidth: 90 }}
                    />
                  </Td>
                  <Td style={{ textAlign: "right" }}>{p.value.toFixed(2)}</Td>
                  <Td style={{ textAlign: "right", color: p.unreal >= 0 ? "#059669" : "#dc2626" }}>
                    {p.unreal >= 0 ? "+" : ""}{p.unreal.toFixed(2)}
                  </Td>
                </tr>
              ))}
              {!sorted.length && (
                <tr>
                  <td colSpan={8} style={{ padding: 16, textAlign: "center", color: "#64748b" }}>No positions (open trades) match your filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Allocation by Symbol" subtitle="Based on absolute market value (|qty * price|).">
        {allocData.length ? (
          <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 16, alignItems: "center" }}>
            <PieChart data={allocData} size={240} stroke={28} />
            <Legend data={allocData} />
          </div>
        ) : (
          <div style={{ color: "#64748b" }}>Enter prices for your symbols to see allocation.</div>
        )}
      </Card>

      <Card title="Unrealized P/L by Symbol" subtitle="Signed values, chart shows absolute shares.">
        {unrealBySym.length ? (
          <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 16, alignItems: "center" }}>
            <PieChart data={unrealBySym.map(d => ({ label: d.label, value: Math.abs(d.value) }))} size={240} stroke={28} />
            <div>
              <Legend data={unrealBySym.map(d => ({ label: d.label, value: Math.abs(d.value) }))} />
              <div style={{ marginTop: 8, color: "#64748b", fontSize: 12 }}>
                Signed: {unrealBySym.map(d => `${d.label} ${d.value >= 0 ? "+" : ""}${d.value.toFixed(2)}`).join("  ·  ")}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ color: "#64748b" }}>No unrealized P/L yet — add prices for open positions.</div>
        )}
      </Card>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={statBox}>
      <div style={{ fontSize: 12, color: "#64748b" }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700 }}>{value}</div>
    </div>
  );
}
const statBox: React.CSSProperties = { background: "#f8fafc", borderRadius: 12, padding: 16 };
const headBtn: React.CSSProperties = { border: "none", background: "transparent", padding: 6, cursor: "pointer", fontWeight: 600 };
const ctl: React.CSSProperties = { padding: 8, borderRadius: 10, border: "1px solid #cbd5e1" };
