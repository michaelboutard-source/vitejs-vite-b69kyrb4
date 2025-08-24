// src/lib/exchanges.ts
// Fetch + cache Binance USDT symbols (no API key). Cache ~12h.

import { getMetaKV, setMetaKV } from "@db";

type BinanceCache = {
  fetchedAt: number;       // ms epoch
  symbols: string[];       // e.g., ["BTCUSDT", "ADAUSDT", ...]
};

const META_KEY = "binance_usdt_symbols_v1";
const TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

export async function getBinanceUsdtSymbols(force = false): Promise<Set<string>> {
  const cached = await getMetaKV<BinanceCache>(META_KEY);
  const fresh = cached && Date.now() - cached.fetchedAt < TTL_MS;

  if (!force && fresh) {
    return new Set(cached!.symbols);
  }

  // Public endpoint, no API key needed
  const url = "https://api.binance.com/api/v3/exchangeInfo";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance HTTP ${res.status}`);

  const data = await res.json();
  const symbols: string[] = (data?.symbols ?? [])
    .filter((s: any) => s?.status === "TRADING" && s?.quoteAsset === "USDT")
    .map((s: any) => String(s?.symbol ?? "").toUpperCase())
    .filter(Boolean);

  const payload: BinanceCache = { fetchedAt: Date.now(), symbols };
  await setMetaKV(META_KEY, payload);

  return new Set(symbols);
}
