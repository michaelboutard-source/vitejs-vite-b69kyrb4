import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "../components/Card";
import { useI18n } from "../i18n";

type Item = { term: string; def: string };
type Section = { title: string; items: Item[] };

// --- tiny helpers ---
const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
function highlight(text: string, q: string) {
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark>{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}
function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem("dict_recent");
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function saveRecent(arr: string[]) {
  try {
    localStorage.setItem("dict_recent", JSON.stringify(arr.slice(0, 12)));
  } catch {}
}

// --- UI bits ---
function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 10px",
        borderRadius: 999,
        border: "1px solid #cbd5e1",
        background: active ? "#e2e8f0" : "#fff",
        fontSize: 12,
      }}
    >
      {label}
    </button>
  );
}
function Accordion({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
      <button
        onClick={onToggle}
        style={{
          width: "100%",
          textAlign: "left",
          padding: "10px 12px",
          background: "#f8fafc",
          border: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
        }}
        aria-expanded={open}
      >
        <span style={{ fontWeight: 700 }}>{title}</span>
        <span aria-hidden="true" style={{ opacity: 0.7 }}>{open ? "▾" : "▸"}</span>
      </button>
      {open && <div style={{ padding: 12, background: "#fff" }}>{children}</div>}
    </div>
  );
}

export function DictionaryPage() {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const query = q.trim();
  const [recent, setRecent] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // ---- FULL DICTIONARY (EN only for now) ----
  const sections: Section[] = useMemo(() => {
    return [
      {
        title: "Market Basics",
        items: [
          { term: "Asset", def: "Anything you can trade, like Bitcoin, Ethereum, stocks, or commodities." },
          { term: "Market Trend", def: "General direction of prices: up (bullish), down (bearish), or sideways (range)." },
          { term: "Uptrend", def: "Price makes higher highs and higher lows — general upward direction." },
          { term: "Downtrend", def: "Price makes lower highs and lower lows — general downward direction." },
          { term: "Sideways / Range", def: "Price moves mostly between two levels without clear direction." },
          { term: "Liquidity", def: "How easy it is to buy or sell an asset without moving the price much." },
          { term: "Volatility", def: "How much and how fast the price moves up and down." },
          { term: "Bid & Ask", def: "Bid = best buy price; Ask = best sell price. Their difference is the spread." },
          { term: "Spread", def: "The gap between the best bid and ask price." },
          { term: "Order Book", def: "Live list of buy (bids) and sell (asks) orders at different prices." },
        ],
      },
      {
        title: "Orders & Execution (Binance-style)",
        items: [
          { term: "Market Order", def: "Executes immediately at the best available price; fastest but no exact price control." },
          { term: "Limit Order", def: "Executes only at your set price (or better)." },
          { term: "Stop-Loss Order (SL)", def: "Triggers an exit when price hits a level against you." },
          { term: "Take-Profit Order (TP)", def: "Triggers an exit when price hits your profit target." },
          { term: "Stop-Limit Order", def: "When stop price is hit, places a limit order." },
          { term: "Stop-Market Order", def: "When stop price is hit, places a market order immediately." },
          { term: "OCO (One Cancels the Other)", def: "Two linked orders (usually SL and TP); when one fills, the other cancels." },
          { term: "Trailing Stop", def: "A dynamic stop that moves with price to lock in gains." },
          { term: "Post-Only", def: "Limit order that only adds liquidity. If it would match, it’s canceled." },
          { term: "FOK (Fill-or-Kill)", def: "Must fully fill now at your price or cancel." },
          { term: "IOC (Immediate-or-Cancel)", def: "Fill immediately (partial allowed); unfilled part cancels." },
          { term: "GTC (Good-Til-Canceled)", def: "Stays open until filled or canceled (default)." },
          { term: "GTD (Good-Til-Date/Time)", def: "Stays open until a specific date/time." },
          { term: "Iceberg Order", def: "Large order split into smaller visible parts to hide the full size." },
        ],
      },
      {
        title: "Trading Styles",
        items: [
          { term: "Day Trading", def: "Open and close trades within the same day." },
          { term: "Swing Trading", def: "Hold trades for days or weeks to catch medium-term moves." },
          { term: "Scalping", def: "Many very short trades aiming for small, quick profits." },
          { term: "Position Trading", def: "Very long-term trading — weeks, months, or years." },
        ],
      },
      {
        title: "Risk & Leverage",
        items: [
          { term: "Leverage", def: "Borrowing funds to open larger positions than your balance allows." },
          { term: "Margin", def: "Your capital locked as collateral in leveraged trades." },
          { term: "Liquidation", def: "Forced closing of your position when margin is too low to cover losses." },
          { term: "Cross vs. Isolated Margin", def: "Cross uses all margin across positions; Isolated confines margin to one." },
        ],
      },
      {
        title: "Performance & Metrics",
        items: [
          { term: "Profit and Loss (P/L)", def: "How much you gain or lose — per trade or overall." },
          { term: "Win Rate", def: "Percentage of trades that ended in profit." },
          { term: "Consistency", def: "How steady your performance is over time." },
          { term: "Key Performance Indicator (KPI)", def: "A metric for performance, e.g., win rate, avg R:R, max drawdown." },
          { term: "Unrealized P/L", def: "Profit or loss on open trades (not closed yet)." },
          { term: "Realized P/L", def: "Profit or loss after closing the trade." },
          { term: "Drawdown", def: "Largest drop from a peak balance to a low before recovering." },
          { term: "Risk-to-Reward Ratio (R:R)", def: "Risk vs. planned reward. Example: risk $50 to make $150 = 1:3 R:R." },
          { term: "Expectancy", def: "Average profit per trade = (win% × avg win) − (loss% × avg loss)." },
          { term: "Max Drawdown", def: "The worst peak-to-trough drop in equity; key risk KPI." },
          { term: "Sharpe Ratio (simplified)", def: "Risk-adjusted return: average excess return divided by volatility." },
        ],
      },
      {
        title: "Strategy / Setups (Journal Tags)",
        items: [
          { term: "Breakout", def: "Price breaks above resistance or below support." },
          { term: "Pullback", def: "Temporary move against the trend, then continuation." },
          { term: "Range Trade", def: "Buy near support, sell near resistance inside a range." },
          { term: "Reversal", def: "Trading when price changes direction (trend flip)." },
          { term: "Support / Resistance", def: "Areas where price tends to bounce (support) or stall/reject (resistance)." },
          { term: "Supply / Demand Zones", def: "Wider areas of prior aggressive selling/buying." },
          { term: "Break of Structure (BOS)", def: "Price takes out a prior swing — continuation or reversal signal." },
          { term: "Liquidity Sweep (Stop Hunt)", def: "Quick move to grab stops near obvious highs/lows, then reversal." },
          { term: "Retest", def: "Price breaks a level then returns to test it from the other side." },
          { term: "Confluence", def: "Multiple signals align (trend + level + indicator) to strengthen a setup." },
          { term: "R Multiple", def: "Profit/loss measured in units of initial risk; +2R = twice your risk." },
          { term: "Trade Journal", def: "Your record of setups, entries/exits, emotions, outcomes to improve decisions." },
          { term: "Playbook", def: "Your set of repeatable setups with rules, examples, and risk guidelines." },
        ],
      },
      {
        title: "Technical Indicators",
        items: [
          { term: "SMA / EMA", def: "Simple / Exponential Moving Average; EMA weights recent prices more." },
          { term: "RSI (Relative Strength Index)", def: "Momentum oscillator (0–100). Often overbought >70, oversold <30 (context matters)." },
          { term: "MACD", def: "EMA-based trend/momentum indicator (line, signal, histogram)." },
          { term: "ATR (Average True Range)", def: "Measures volatility; useful for sizing stops (e.g., SL = Entry − k×ATR)." },
          { term: "Bollinger Bands", def: "SMA with ± standard deviations; shows volatility expansions/squeezes." },
          { term: "VWAP", def: "Volume-Weighted Average Price; benchmark for fair execution." },
        ],
      },
      {
        title: "Candlestick Essentials",
        items: [
          { term: "Doji", def: "Open ≈ Close; indicates indecision." },
          { term: "Hammer / Inverted Hammer", def: "Small body, long lower (or upper) wick; potential reversal if at extremes." },
          { term: "Shooting Star", def: "Small body, long upper wick at highs; potential bearish reversal." },
          { term: "Engulfing (Bullish/Bearish)", def: "Candle fully engulfs prior candle's body; potential reversal." },
          { term: "Inside Bar", def: "Candle entirely inside prior range; potential breakout setup." },
          { term: "Pin Bar", def: "Long wick rejecting a level; often used for reversals." },
        ],
      },
      {
        title: "Advanced Markets & Derivatives",
        items: [
          { term: "Perpetual Futures (Perps)", def: "Futures without expiry; price stays near index via funding rate." },
          { term: "Funding Rate", def: "Periodic payment between longs and shorts on perps; positive = longs pay shorts." },
          { term: "Index Price", def: "Weighted average of spot prices across exchanges; fair reference price." },
          { term: "Mark Price", def: "Exchange fair price for P/L and liquidation; reduces unfair liquidations." },
          { term: "Contango", def: "Futures price above spot (common in bullish/normal markets)." },
          { term: "Backwardation", def: "Futures price below spot (often during stress/scarcity)." },
          { term: "Basis", def: "Difference between futures and spot price (can be annualized)." },
          { term: "Open Interest (OI)", def: "Total number of open contracts; rising OI with strong moves can confirm trends." },
        ],
      },
      {
        title: "Options (for completeness)",
        items: [
          { term: "Call Option", def: "Right to buy an asset at the strike before/at expiry." },
          { term: "Put Option", def: "Right to sell an asset at the strike before/at expiry." },
          { term: "Strike Price", def: "Price at which the option can be exercised." },
          { term: "Expiration", def: "Date/time when the option contract ends." },
          { term: "Premium", def: "Price paid (buyer) or received (seller) for the option." },
          { term: "Implied Volatility (IV)", def: "Market’s forecast of future volatility; higher IV = pricier options." },
          { term: "Intrinsic vs. Extrinsic Value", def: "Intrinsic = value if exercised now; Extrinsic = time/volatility value." },
          { term: "Greeks (Delta, Gamma, Theta, Vega, Rho)", def: "Sensitivities: price, convexity, time decay, volatility, rates." },
        ],
      },
      {
        title: "Execution & Microstructure",
        items: [
          { term: "Maker / Taker", def: "Maker adds liquidity (resting limit); taker removes it (market/marketable limit)." },
          { term: "Slippage", def: "Execution at a worse price than expected due to fast moves or thin liquidity." },
          { term: "Partial Fill", def: "Order executes in pieces as liquidity becomes available." },
          { term: "Order Book Depth", def: "Liquidity at each price level; deeper = less slippage." },
        ],
      },
      {
        title: "Exchanges & Infrastructure",
        items: [
          { term: "CEX vs. DEX", def: "Centralized exchange vs. decentralized (on-chain, self-custody)." },
          { term: "AMM (Automated Market Maker)", def: "DEX model with liquidity pools and formulas (e.g., x·y=k)." },
          { term: "Cold / Hot Wallet", def: "Cold = offline storage (safer); hot = online (convenient but riskier)." },
        ],
      },
    ];
  }, []);

  // section titles (for chips)
  const sectionTitles = useMemo(() => sections.map((s) => s.title), [sections]);

  // expanded state per section (accordion)
  const [openSet, setOpenSet] = useState<Set<string>>(() => new Set());
  // chip filter (multi-select)
  const [activeChips, setActiveChips] = useState<Set<string>>(() => new Set());

  // load recent on mount
  useEffect(() => {
    setRecent(loadRecent());
  }, []);

  function toggleOpen(title: string) {
    setOpenSet((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  }
  function toggleChip(title: string) {
    setActiveChips((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  }

  function onClickTerm(term: string) {
    setRecent((prev) => {
      const next = [term, ...prev.filter((t) => t !== term)];
      saveRecent(next);
      return next;
    });
    // scroll into view if anchor exists
    const id = "term-" + slug(term);
    const el = document.getElementById(id);
    if (el && containerRef.current) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  // derived lists
  const allFlat = useMemo(
    () =>
      sections.flatMap((sec) =>
        sec.items.map((it) => ({ ...it, section: sec.title }))
      ),
    [sections]
  );

  const filteredFlat = useMemo(() => {
    const s = query.toLowerCase();
    if (!s) return null;
    return allFlat.filter(
      (it) =>
        it.term.toLowerCase().includes(s) ||
        it.def.toLowerCase().includes(s) ||
        it.section.toLowerCase().includes(s)
    );
  }, [allFlat, query]);

  const visibleSections = useMemo(() => {
    if (filteredFlat) return null;
    if (activeChips.size === 0) return sections;
    return sections.filter((sec) => activeChips.has(sec.title));
  }, [filteredFlat, sections, activeChips]);

  return (
    <Card title={t("dictionary_title")} subtitle={t("dictionary_sub")}>
      {/* Sticky search + chips */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 1,
          background: "#fff",
          paddingBottom: 8,
        }}
      >
        <input
          placeholder={t("dictionary_search_placeholder")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{
            width: "100%",
            padding: 10,
            borderRadius: 12,
            border: "1px solid #cbd5e1",
            marginBottom: 8,
          }}
        />
        {/* Chips bar */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {sectionTitles.map((title) => (
            <Chip
              key={title}
              label={title}
              active={activeChips.has(title)}
              onClick={() => toggleChip(title)}
            />
          ))}
          {activeChips.size > 0 && (
            <button
              onClick={() => setActiveChips(new Set())}
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                border: "1px solid #cbd5e1",
                background: "#fff",
                fontSize: 12,
              }}
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Recently viewed */}
        {recent.length > 0 && (
          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "#64748b" }}>Recently viewed:</span>
            {recent.slice(0, 10).map((term) => (
              <button
                key={term}
                onClick={() => onClickTerm(term)}
                style={{
                  padding: "4px 8px",
                  borderRadius: 999,
                  border: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  fontSize: 12,
                }}
                title={term}
              >
                {term}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div ref={containerRef} style={{ display: "grid", gap: 12, marginTop: 12 }}>
        {/* If searching: flat list with highlights */}
        {filteredFlat ? (
          filteredFlat.length ? (
            filteredFlat.map((it) => (
              <div
                key={`${it.section}:${it.term}`}
                id={"term-" + slug(it.term)}
                onClick={() => onClickTerm(it.term)}
                style={{
                  background: "#f8fafc",
                  borderRadius: 12,
                  padding: 12,
                  cursor: "pointer",
                }}
                title="Click to add to Recently viewed"
              >
                <div style={{ fontWeight: 700 }}>
                  {highlight(it.term, query)}
                </div>
                <div style={{ color: "#334155", marginTop: 4 }}>
                  {highlight(it.def, query)}
                </div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>
                  {highlight(it.section, query)}
                </div>
              </div>
            ))
          ) : (
            <div style={{ color: "#64748b" }}>No results.</div>
          )
        ) : (
          // No search: show accordions (filtered by chips if any)
          (visibleSections || []).map((sec) => (
            <Accordion
              key={sec.title}
              title={sec.title}
              open={openSet.has(sec.title)}
              onToggle={() => toggleOpen(sec.title)}
            >
              <div style={{ display: "grid", gap: 10 }}>
                {sec.items.map((it) => (
                  <div
                    key={`${sec.title}:${it.term}`}
                    id={"term-" + slug(it.term)}
                    onClick={() => onClickTerm(it.term)}
                    style={{
                      background: "#f8fafc",
                      borderRadius: 12,
                      padding: 12,
                      cursor: "pointer",
                    }}
                    title="Click to add to Recently viewed"
                  >
                    <div style={{ fontWeight: 700 }}>{it.term}</div>
                    <div style={{ color: "#334155", marginTop: 4 }}>{it.def}</div>
                  </div>
                ))}
              </div>
            </Accordion>
          ))
        )}
      </div>
    </Card>
  );
}
