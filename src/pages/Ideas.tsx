// src/pages/Ideas.tsx
import React, { useMemo, useState } from "react";
import { Card } from "@components/Card";
import { useI18n } from "@i18n";
import { db, type Trade } from "@db";

/** =========================================
 * Types & constants
 * ========================================= */
type Exchange = "Binance";
type Timeframe = "1h" | "4h" | "1D";
type Strategy = "Momentum" | "Breakout" | "Mean Reversion";
type SizingMode = "invest" | "risk";
type SignalBasis = "Candles" | "24h Ticker";

type Ticker = {
  symbol: string;
  last: number;
  changePct24h: number;
  quoteVol24h: number;
};

type Candle = {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type Idea = {
  symbol: string;
  price: number;
  changePct24h: number;
  quoteVol24h: number;
  score: number;
  reasons: string[];
  whyText: string;
  setups: AnalyzedSetups | null; // when Candle mode used
};

type AnalyzedSetups = {
  trend: "up" | "down" | "sideways";
  ema20: number;
  ema50: number;
  ema200: number;
  atr: number;
  swingHigh: number;
  swingLow: number;
  entryConservative: number;
  slConservative: number;
  tpConservative: number;
  entryModerate: number;
  slModerate: number;
  tpModerate: number;
  entryAggressive: number;
  slAggressive: number;
  tpAggressive: number;
};

const BLOCKED = new Set<string>(["OKBUSDT"]);
const DEFAULT_TOP_USDT: string[] = [
  "BTCUSDT","ETHUSDT","BNBUSDT","SOLUSDT","XRPUSDT","ADAUSDT","DOGEUSDT","TONUSDT","AVAXUSDT",
  "TRXUSDT","LINKUSDT","MATICUSDT","DOTUSDT","NEARUSDT","ATOMUSDT","APTUSDT","ARBUSDT","OPUSDT",
  "SUIUSDT","FILUSDT","ICPUSDT","INJUSDT","AAVEUSDT","RNDRUSDT"
];

/** Risk presets for labels (we now compute SL/TP from candles) */
const RISK_LABELS = {
  conservative: "Conservative",
  moderate:     "Moderate",
  aggressive:   "Aggressive",
} as const;

/** =========================================
 * Utilities: EMA, ATR, swings
 * ========================================= */
function ema(values: number[], period: number): number {
  if (values.length < period) return values[values.length - 1] ?? 0;
  const k = 2 / (period + 1);
  let e = values[0];
  for (let i = 1; i < values.length; i++) {
    e = values[i] * k + e * (1 - k);
  }
  return e;
}
function trueRange(curr: Candle, prev: Candle | null): number {
  if (!prev) return curr.high - curr.low;
  const hl = curr.high - curr.low;
  const hc = Math.abs(curr.high - prev.close);
  const lc = Math.abs(curr.low - prev.close);
  return Math.max(hl, hc, lc);
}
function atr(candles: Candle[], period = 14): number {
  if (!candles.length) return 0;
  const trs: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    trs.push(trueRange(candles[i], i > 0 ? candles[i - 1] : null));
  }
  return ema(trs, period);
}
function swingHigh(candles: Candle[], lookback = 20): number {
  if (!candles.length) return 0;
  const start = Math.max(0, candles.length - lookback);
  let m = -Infinity;
  for (let i = start; i < candles.length; i++) m = Math.max(m, candles[i].high);
  return m === -Infinity ? candles[candles.length - 1].high : m;
}
function swingLow(candles: Candle[], lookback = 20): number {
  if (!candles.length) return 0;
  const start = Math.max(0, candles.length - lookback);
  let m = Infinity;
  for (let i = start; i < candles.length; i++) m = Math.min(m, candles[i].low);
  return m === Infinity ? candles[candles.length - 1].low : m;
}

/** Trend by EMAs */
function detectTrend(ema20: number, ema50: number, ema200: number): "up" | "down" | "sideways" {
  if (ema20 > ema50 && ema50 > ema200) return "up";
  if (ema20 < ema50 && ema50 < ema200) return "down";
  return "sideways";
}

/** =========================================
 * Fetchers
 * ========================================= */
/** 24h tickers, used for fallback/filters/sorting */
async function fetchBinanceTickersChunked(symbols: string[], chunkSize = 20): Promise<Ticker[]> {
  const chunks: string[][] = [];
  for (let i = 0; i < symbols.length; i += chunkSize) chunks.push(symbols.slice(i, i + chunkSize));
  const results: Ticker[] = [];
  for (const group of chunks) {
    const url = "https://api.binance.com/api/v3/ticker/24hr?symbols=" + encodeURIComponent(JSON.stringify(group));
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Binance error (${res.status}): ${text || res.statusText}`);
    }
    const arr = await res.json();
    for (const r of arr) {
      results.push({
        symbol: r.symbol,
        last: Number(r.lastPrice),
        changePct24h: Number(r.priceChangePercent),
        quoteVol24h: Number(r.quoteVolume),
      });
    }
  }
  return results;
}

/** Historical candles for deeper analysis */
async function fetchKlines(symbol: string, interval: Timeframe, limit = 300): Promise<Candle[]> {
  const map: Record<Timeframe, string> = { "1h": "1h", "4h": "4h", "1D": "1d" };
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${map[interval]}&limit=${limit}`;
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Klines error for ${symbol} (${res.status}): ${text || res.statusText}`);
  }
  const raw = await res.json();
  return raw.map((r: any) => ({
    openTime: r[0],
    open: +r[1],
    high: +r[2],
    low: +r[3],
    close: +r[4],
    volume: +r[7],
  })) as Candle[];
}

/** =========================================
 * Idea scoring & explanation
 * ========================================= */
function scoreIdea(t: Ticker): number {
  const volScore = Math.log10(Math.max(1, t.quoteVol24h));
  return t.changePct24h * 1.2 + volScore * 2;
}

function explainIdeaFromCandles(
  symbol: string,
  tf: Timeframe,
  trend: "up" | "down" | "sideways",
  ema20v: number, ema50v: number, ema200v: number,
  atrv: number, swingH: number, swingL: number
): { reasons: string[]; whyText: string } {
  const reasons: string[] = [];
  if (trend === "up") reasons.push("Uptrend (EMA 20 > 50 > 200)");
  if (trend === "down") reasons.push("Downtrend (EMA 20 < 50 < 200)");
  if (trend === "sideways") reasons.push("Sideways trend (EMAs mixed)");

  reasons.push(`Volatility (ATR): ~${atrv.toFixed(4)}`);
  reasons.push(`Structure: swing H ${swingH.toFixed(4)} / swing L ${swingL.toFixed(4)}`);
  reasons.push(`TF: ${tf}`);

  const why = reasons.map(r => `• ${r}`).join("\n");
  return { reasons, whyText: why };
}

/** =========================================
 * Setups from candle analysis
 * ========================================= */
function buildSetupsFromCandles(candles: Candle[]): AnalyzedSetups | null {
  if (!candles.length) return null;
  const closes = candles.map(c => c.close);
  const last = closes[closes.length - 1];

  const ema20v = ema(closes, 20);
  const ema50v = ema(closes, 50);
  const ema200v = ema(closes, 200);
  const atrv = atr(candles, 14);
  const swingH = swingHigh(candles, 40);
  const swingL = swingLow(candles, 40);
  const trend = detectTrend(ema20v, ema50v, ema200v);

  // Entries (examples):
  // Conservative: pullback to EMA50 (trend up) or breakout retest (sideways)
  // Moderate: pullback to EMA20 (trend up) or break above swing high
  // Aggressive: market-with-buffer toward breakout (or mean reversion bounce)
  let entryCons = last, slCons = last - 1.2 * atrv, tpCons = last + 2 * atrv;
  let entryMod  = last, slMod  = last - 1.5 * atrv, tpMod  = last + 2.5 * atrv;
  let entryAgg  = last, slAgg  = last - 2.0 * atrv, tpAgg  = last + 3.0 * atrv;

  if (trend === "up") {
    entryCons = ema50v; slCons = Math.min(ema50v - 1.5 * atrv, swingL - 0.5 * atrv); tpCons = entryCons + 2.0 * atrv;
    entryMod  = ema20v; slMod  = Math.min(ema20v - 1.2 * atrv, swingL - 0.5 * atrv); tpMod  = entryMod + 2.5 * atrv;
    entryAgg  = last;   slAgg  = last - 2.0 * atrv;                                  tpAgg  = last + 3.0 * atrv;
  } else if (trend === "sideways") {
    // Range trade: buy near swing low, TP mid to high
    entryCons = (swingL + ema50v) / 2; slCons = swingL - 1.0 * atrv; tpCons = ema50v + 1.5 * atrv;
    entryMod  = ema50v;                slMod  = swingL - 1.2 * atrv; tpMod  = swingH - 0.5 * atrv;
    entryAgg  = last;                   slAgg  = swingL - 1.5 * atrv; tpAgg  = swingH;
  } else {
    // Downtrend long = risky; still propose mean-reversion bounce
    entryCons = ema20v; slCons = swingL - 1.2 * atrv; tpCons = ema50v;
    entryMod  = (ema20v + ema50v) / 2; slMod = swingL - 1.5 * atrv; tpMod = ema50v + 1.5 * atrv;
    entryAgg  = last; slAgg = swingL - 2.0 * atrv; tpAgg = ema50v + 2.0 * atrv;
  }

  // Ensure SL below Entry & TP above Entry
  function fix(entry: number, sl: number, tp: number) {
    let e = entry, s = sl, t = tp;
    if (s >= e) s = e - 0.5 * atrv;
    if (t <= e) t = e + 1.0 * atrv;
    return [e, s, t] as const;
  }
  [entryCons, slCons, tpCons] = fix(entryCons, slCons, tpCons);
  [entryMod,  slMod,  tpMod ] = fix(entryMod,  slMod,  tpMod );
  [entryAgg,  slAgg,  tpAgg ] = fix(entryAgg,  slAgg,  tpAgg );

  return {
    trend,
    ema20: ema20v, ema50: ema50v, ema200: ema200v,
    atr: atrv,
    swingHigh: swingH,
    swingLow: swingL,
    entryConservative: entryCons,
    slConservative: slCons,
    tpConservative: tpCons,
    entryModerate: entryMod,
    slModerate: slMod,
    tpModerate: tpMod,
    entryAggressive: entryAgg,
    slAggressive: slAgg,
    tpAggressive: tpAgg,
  };
}

/** =========================================
 * Journal creation
 * ========================================= */
async function addToJournal(symbol: string, entry: number, sl: number, tp: number, qty: number, notes: string) {
  const id = (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
  const rec: Trade = {
    id,
    status: "open",
    market: "spot",
    exchange: "Binance",
    symbol,
    side: "long",
    entryPrice: Number(entry),
    quantity: Number(qty),
    fees: 0,
    openedAt: new Date().toISOString(),
    notes,
  };
  await db.trades.add(rec);
}

/** =========================================
 * UI styles
 * ========================================= */
const sel: React.CSSProperties = { padding: 8, borderRadius: 10, border: "1px solid #cbd5e1", minWidth: 180 };
const inp: React.CSSProperties = { padding: 8, borderRadius: 10, border: "1px solid #cbd5e1", minWidth: 160 };
const btnPrimary: React.CSSProperties = { padding: "8px 12px", borderRadius: 10, border: "1px solid #111", background: "#111", color: "#fff" };
const btnSecondary: React.CSSProperties = { padding: "8px 12px", borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff" };
const chip: React.CSSProperties = { fontSize: 12, background: "#eef2ff", color: "#3730a3", borderRadius: 999, padding: "4px 10px" };
const smallLabel: React.CSSProperties = { fontSize: 11, color: "#64748b" };
const bigNum: React.CSSProperties = { fontWeight: 800 };

function setupCardStyle(kind: "conservative" | "moderate" | "aggressive"): React.CSSProperties {
  const base: React.CSSProperties = {
    borderRadius: 12,
    padding: 12,
    border: "1px solid #e2e8f0",
    display: "grid",
    gap: 6,
  };
  if (kind === "conservative") return { ...base, background: "#ecfdf5", borderColor: "#bbf7d0" };
  if (kind === "moderate")     return { ...base, background: "#fffbeb", borderColor: "#fde68a" };
  return                         { ...base, background: "#fff1f2", borderColor: "#fecdd3" };
}

/** =========================================
 * Page
 * ========================================= */
export function IdeasPage() {
  const { t } = useI18n();

  /** Controls */
  const [exchange, setExchange] = useState<Exchange>("Binance");
  const [universe, setUniverse] = useState<"Watchlist" | "Top 50" | "Custom">("Top 50");
  const [customSymbols, setCustomSymbols] = useState<string>("");

  const [timeframe, setTimeframe] = useState<Timeframe>("4h");
  const [strategy, setStrategy] = useState<Strategy>("Momentum");
  const [basis, setBasis] = useState<SignalBasis>("Candles"); // NEW

  const [minVol, setMinVol] = useState<string>("10000000");
  const [minPrice, setMinPrice] = useState<string>("0.05");
  const [excludeStables, setExcludeStables] = useState<boolean>(true);

  // Sizing
  const [sizingMode, setSizingMode] = useState<SizingMode>("invest");
  const [userUSDT, setUserUSDT] = useState<string>("50");

  /** Results */
  const [loading, setLoading] = useState(false);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [lastScan, setLastScan] = useState<string>("—");
  const [errorMsg, setErrorMsg] = useState<string>("");

  /** Symbol list */
  const selectedSymbols = useMemo(() => {
    let syms: string[] = [];
    if (universe === "Top 50") syms = DEFAULT_TOP_USDT.slice();
    else if (universe === "Custom") {
      syms = customSymbols
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
        .map((s) => (s.endsWith("USDT") ? s : `${s}USDT`));
    } else {
      syms = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "ADAUSDT", "XRPUSDT", "LINKUSDT"];
    }
    syms = syms.filter((s) => !BLOCKED.has(s));
    syms = syms.filter((s) => !/^(USDT|USDC|FDUSD|BUSD)[A-Z]+$/.test(s));
    return syms;
  }, [universe, customSymbols]);

  /** Core: Scan */
  async function onScan() {
    setLoading(true);
    setErrorMsg("");
    setIdeas([]);
    try {
      if (exchange !== "Binance") throw new Error("Only Binance supported for now");
      if (!selectedSymbols.length) throw new Error("No symbols selected. Check Universe/Custom.");

      const minV = Number(minVol.replace(",", "."));
      const minP = Number(minPrice.replace(",", "."));
      if (!Number.isFinite(minV) || !Number.isFinite(minP)) throw new Error("Min Volume/Price must be numbers.");

      // 1) Base tickers to filter liquidity/price and for display
      const tickers = await fetchBinanceTickersChunked(selectedSymbols, 20);
      let filtered = tickers
        .filter((r) => Number.isFinite(r.last) && r.last >= minP)
        .filter((r) => Number.isFinite(r.quoteVol24h) && r.quoteVol24h >= minV);

      if (!filtered.length) throw new Error("No results passed your filters. Try relaxing them.");

      // Leave top 12 by score for speed
      filtered.sort((a, b) => scoreIdea(b) - scoreIdea(a));
      filtered = filtered.slice(0, 12);

      // 2) If Candles basis, analyze candles per symbol
      const tf = timeframe;
      const enriched: Idea[] = [];
      for (const t of filtered) {
        let setups: AnalyzedSetups | null = null;
        let reasons: string[] = [];
        let whyText = "";

        if (basis === "Candles") {
          const kl = await fetchKlines(t.symbol, tf, 300);
          if (kl.length >= 50) {
            setups = buildSetupsFromCandles(kl);
            if (setups) {
              const exp = explainIdeaFromCandles(
                t.symbol, tf, setups.trend,
                setups.ema20, setups.ema50, setups.ema200,
                setups.atr, setups.swingHigh, setups.swingLow
              );
              reasons = exp.reasons;
              whyText = exp.whyText;
            }
          }
        }

        if (basis === "24h Ticker" || !setups) {
          // fallback generic explanation
          const volScore = Math.log10(Math.max(1, t.quoteVol24h));
          reasons.push(t.changePct24h >= 2 ? "Positive 24h momentum" : "Meets liquidity filters");
          reasons.push(`High liquidity score: ${volScore.toFixed(2)}`);
          whyText = reasons.map(r => `• ${r}`).join("\n");
        }

        enriched.push({
          symbol: t.symbol,
          price: t.last,
          changePct24h: t.changePct24h,
          quoteVol24h: t.quoteVol24h,
          score: scoreIdea(t),
          reasons,
          whyText,
          setups,
        });
      }

      // sort by score then trend priority (up > sideways > down)
      const trendRank = (i: Idea) => (i.setups?.trend === "up" ? 2 : i.setups?.trend === "sideways" ? 1 : 0);
      enriched.sort((a, b) => trendRank(b) - trendRank(a) || b.score - a.score);

      setIdeas(enriched);
      setLastScan(new Date().toLocaleString());
    } catch (e: any) {
      setErrorMsg(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  function clearAll() {
    setIdeas([]);
    setLastScan("—");
    setErrorMsg("");
  }

  async function quickTest() {
    setUniverse("Custom");
    setCustomSymbols("BTC,ETH,ADA");
    setMinVol("1000000");
    setMinPrice("0.05");
    await onScan();
  }

  /** Sizing calc */
  function positionFromSizing(entry: number, sl: number) {
    const amt = Number(userUSDT.replace(",", ".") || "0");
    const perUnitRisk = Math.max(1e-9, entry - sl);
    const qty = sizingMode === "invest" ? amt / Math.max(1e-9, entry) : amt / perUnitRisk;
    const riskUsd = (entry - sl) * qty;
    return { qty, riskUsd };
  }
  const rrLabel = (entry: number, sl: number, tp: number) =>
    `1:${((tp - entry) / Math.max(1e-9, entry - sl)).toFixed(2)}`;

  return (
    <Card title={t("ideas_title")} subtitle="Candle‑based analysis (EMA/ATR) to propose Entry, SL, TP on longer timeframes.">
      {/* Error banner */}
      {errorMsg && (
        <div style={{ background: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b", padding: 10, borderRadius: 10, marginBottom: 10 }}>
          <b>Scan error:</b> {errorMsg}
        </div>
      )}

      {/* Controls */}
      <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
        {/* Row 1 */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 12, color: "#64748b" }}>Exchange</span>
            <select value={exchange} onChange={(e) => setExchange(e.target.value as Exchange)} style={sel}>
              <option value="Binance">Binance</option>
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 12, color: "#64748b" }}>Universe</span>
            <select value={universe} onChange={(e) => setUniverse(e.target.value as any)} style={sel}>
              <option value="Watchlist">My Watchlist</option>
              <option value="Top 50">Top 50 (USDT)</option>
              <option value="Custom">Custom…</option>
            </select>
          </label>
          {universe === "Custom" && (
            <label style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 320 }}>
              <span style={{ fontSize: 12, color: "#64748b" }}>Custom symbols (comma, e.g. BTC,ETH,ADA)</span>
              <input value={customSymbols} onChange={(e) => setCustomSymbols(e.target.value)} placeholder="BTC,ETH,ADA" style={inp} />
            </label>
          )}
        </div>

        {/* Row 2 */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 12, color: "#64748b" }}>Timeframe</span>
            <select value={timeframe} onChange={(e) => setTimeframe(e.target.value as Timeframe)} style={sel}>
              <option value="1h">1h</option>
              <option value="4h">4h</option>
              <option value="1D">1D</option>
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 12, color: "#64748b" }}>Strategy</span>
            <select value={strategy} onChange={(e) => setStrategy(e.target.value as Strategy)} style={sel}>
              <option value="Momentum">Momentum</option>
              <option value="Breakout">Breakout</option>
              <option value="Mean Reversion">Mean Reversion</option>
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 12, color: "#64748b" }}>Signal basis</span>
            <select value={basis} onChange={(e) => setBasis(e.target.value as SignalBasis)} style={sel}>
              <option value="Candles">Candles (recommended)</option>
              <option value="24h Ticker">24h Ticker (legacy)</option>
            </select>
          </label>
        </div>

        {/* Row 3 */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 12, color: "#64748b" }}>Min 24h Quote Volume (USDT)</span>
            <input value={minVol} onChange={(e) => setMinVol(e.target.value)} type="number" inputMode="decimal" step="any" style={inp} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 12, color: "#64748b" }}>Min Price</span>
            <input value={minPrice} onChange={(e) => setMinPrice(e.target.value)} type="number" inputMode="decimal" step="any" style={inp} />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
            <input type="checkbox" checked={excludeStables} onChange={(e) => setExcludeStables(e.target.checked)} />
            <span style={{ fontSize: 13 }}>Exclude stables</span>
          </label>

          {/* Sizing mode */}
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 12, color: "#64748b" }}>Sizing mode</span>
            <select value={sizingMode} onChange={(e) => setSizingMode(e.target.value as SizingMode)} style={sel}>
              <option value="invest">Invest Amount</option>
              <option value="risk">Risk Amount</option>
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 12, color: "#64748b" }}>
              {sizingMode === "invest" ? "Amount to invest (USDT)" : "Risk per trade (USDT)"}
            </span>
            <input value={userUSDT} onChange={(e) => setUserUSDT(e.target.value)} type="number" inputMode="decimal" step="any" style={inp} />
          </label>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onScan} disabled={loading} style={btnPrimary}>{loading ? "Scanning…" : "Scan"}</button>
            <button onClick={clearAll} style={btnSecondary}>Clear</button>
            <button onClick={quickTest} disabled={loading} style={{ ...btnSecondary, borderColor: "#86efac", background: "#ecfdf5" }}>
              Quick test (BTC,ETH,ADA)
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {!ideas.length ? (
        <div style={{ color: "#64748b" }}>
          No ideas yet. Choose your options and click <b>Scan</b>.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {ideas.map((id) => {
            const setups = id.setups;
            return (
              <div key={id.symbol} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, background: "#fff" }}>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>{id.symbol}</div>
                  <div style={{ fontWeight: 700 }}>{id.price}</div>
                  <span style={{ color: id.changePct24h >= 0 ? "#16a34a" : "#b91c1c" }}>
                    {id.changePct24h.toFixed(2)}%
                  </span>
                  <span style={{ color: "#64748b" }}>Vol24h: {Math.round(id.quoteVol24h).toLocaleString()} USDT</span>
                  <span style={{ marginLeft: "auto", color: "#64748b" }}>Score: {id.score.toFixed(1)}</span>
                </div>

                {/* Reason chips */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                  {id.reasons.map((r, i) => (
                    <span key={i} style={chip}>{r}</span>
                  ))}
                </div>

                {/* Why text */}
                <div style={{ whiteSpace: "pre-wrap", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 10, marginTop: 8, color: "#334155" }}>
                  <b>Why this could work</b>{"\n"}{id.whyText}
                </div>

                {/* Candle analysis summary (if available) */}
                {setups && (
                  <div style={{ marginTop: 8, display: "grid", gap: 6, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                    <div><div style={smallLabel}>Trend</div><div style={bigNum}>{setups.trend}</div></div>
                    <div><div style={smallLabel}>EMA20 / EMA50 / EMA200</div><div style={bigNum}>{setups.ema20.toFixed(4)} / {setups.ema50.toFixed(4)} / {setups.ema200.toFixed(4)}</div></div>
                    <div><div style={smallLabel}>ATR(14)</div><div style={bigNum}>{setups.atr.toFixed(6)}</div></div>
                    <div><div style={smallLabel}>Swing H / L</div><div style={bigNum}>{setups.swingHigh.toFixed(4)} / {setups.swingLow.toFixed(4)}</div></div>
                  </div>
                )}

                {/* Setups as colorful cards */}
                <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", marginTop: 10 }}>
                  {["conservative","moderate","aggressive"].map((kind) => {
                    // pick prices
                    let entry = id.price, sl = id.price * 0.98, tp = id.price * 1.02;
                    if (setups) {
                      if (kind === "conservative") { entry = setups.entryConservative; sl = setups.slConservative; tp = setups.tpConservative; }
                      if (kind === "moderate")     { entry = setups.entryModerate;     sl = setups.slModerate;     tp = setups.tpModerate; }
                      if (kind === "aggressive")   { entry = setups.entryAggressive;   sl = setups.slAggressive;   tp = setups.tpAggressive; }
                    }
                    const { qty, riskUsd } = positionFromSizing(entry, sl);
                    const gainUsd = (tp - entry) * qty;

                    return (
                      <div key={kind} style={setupCardStyle(kind as any)}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ fontWeight: 900 }}>{RISK_LABELS[kind as keyof typeof RISK_LABELS]}</div>
                          <div style={{ fontSize: 12, color: "#334155" }}>R:R <b>{rrLabel(entry, sl, tp)}</b></div>
                        </div>
                        <div>
                          <div style={smallLabel}>Entry</div>
                          <div style={bigNum}>{entry.toFixed(6)}</div>
                        </div>
                        <div>
                          <div style={smallLabel}>Stop (SL)</div>
                          <div style={bigNum}>
                            {sl.toFixed(6)} <span style={{ color: "#64748b" }}>({((1 - sl / entry) * 100).toFixed(2)}%)</span>
                          </div>
                        </div>
                        <div>
                          <div style={smallLabel}>Take Profit (TP)</div>
                          <div style={bigNum}>{tp.toFixed(6)}</div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginTop: 6 }}>
                          <div>
                            <div style={smallLabel}>Qty</div>
                            <div style={bigNum}>{qty.toFixed(6)}</div>
                          </div>
                          <div>
                            <div style={smallLabel}>{sizingMode === "invest" ? "Risk (USDT)" : "Risk (USDT) (target)"}</div>
                            <div style={bigNum}>{riskUsd.toFixed(2)}</div>
                          </div>
                          <div>
                            <div style={smallLabel}>Potential Gain</div>
                            <div style={bigNum}>{gainUsd.toFixed(2)}</div>
                          </div>
                        </div>

                        <button
                          style={{ ...btnPrimary, marginTop: 8 }}
                          onClick={async () => {
                            const notes = `Ideas (candles) • ${strategy} • ${timeframe} • ${RISK_LABELS[kind as keyof typeof RISK_LABELS]} • Mode:${sizingMode}`;
                            await addToJournal(id.symbol, entry, sl, tp, qty, notes);
                            alert(`Added ${id.symbol} (${RISK_LABELS[kind as keyof typeof RISK_LABELS]}) to Journal.`);
                          }}
                        >
                          Add to Journal
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div style={{ color: "#64748b", fontSize: 12, marginTop: 6 }}>
                  Tip: verify on chart; adjust entry (limit), SL/TP to structure if needed.
                </div>
              </div>
            );
          })}
          <div style={{ color: "#64748b", fontSize: 12 }}>Last scan: {lastScan}</div>
        </div>
      )}
    </Card>
  );
}
