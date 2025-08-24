// src/lib/markets.ts
// Fetch + cache top-100 market data from CoinGecko (no API key)
// Cache TTL: 60s (in Dexie meta)

import { getMetaKV, setMetaKV } from "@db";

export type MarketRow = {
  id: string;
  symbol: string; // e.g., "ADA"
  name: string;   // e.g., "Cardano"
  price: number;  // in USD
  ch24: number;   // 24h % change
  ch7d: number;   // 7d % change
  volume: number; // 24h USD volume
  marketCap: number;
};

type MarketsCache = {
  rows: MarketRow[];
  fetchedAt: number; // ms epoch
};

const META_KEY = "cg_markets_top100_v1";
const TTL_MS = 60_000;

export async function getMarkets(force = false): Promise<MarketsCache> {
  const cached = await getMetaKV<MarketsCache>(META_KEY);
  if (!force && cached && Date.now() - cached.fetchedAt < TTL_MS) {
    return cached;
  }

  const url =
    "https://api.coingecko.com/api/v3/coins/markets" +
    "?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&price_change_percentage=24h,7d";

  const res = await fetch(url);
  if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
  const arr = await res.json();

  const rows: MarketRow[] = (Array.isArray(arr) ? arr : []).map((r: any) => ({
    id: String(r.id ?? ""),
    symbol: String(r.symbol ?? "").toUpperCase(),
    name: String(r.name ?? ""),
    price: num(r.current_price),
    ch24: num(r.price_change_percentage_24h),
    ch7d: num(r.price_change_percentage_7d_in_currency),
    volume: num(r.total_volume),
    marketCap: num(r.market_cap),
  }));

  const payload: MarketsCache = { rows, fetchedAt: Date.now() };
  await setMetaKV(META_KEY, payload);
  return payload;
}

function num(x: any): number {
  const n = Number(x);
  return isFinite(n) ? n : 0;
}
