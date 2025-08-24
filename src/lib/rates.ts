// src/lib/rates.ts
// Live rates: fetch from CoinGecko + exchangerate.host, cache via meta KV, and convert between USDT, BTC, EUR, CNY, CHF.

import { getMetaKV, setMetaKV, type BaseCCY } from "../db";

export type Matrix = Record<BaseCCY, Partial<Record<BaseCCY, number>>>;

export type RatesPayload = {
  matrix: Matrix;
  fetchedAt: number; // ms epoch
};

const META_KEY = "rates_matrix_v1";
const STALE_MS = 24 * 60 * 60 * 1000; // 24h

export async function loadRates(): Promise<RatesPayload | null> {
  const rec = await getMetaKV<RatesPayload>(META_KEY);
  return rec ?? null;
}

export async function saveRates(payload: RatesPayload) {
  await setMetaKV(META_KEY, payload);
}

export async function getLastUpdated(): Promise<number | null> {
  const r = await loadRates();
  return r?.fetchedAt ?? null;
}

export function isStale(fetchedAt?: number | null) {
  if (!fetchedAt) return true;
  return Date.now() - fetchedAt > STALE_MS;
}

/** Convert amount using the matrix. Falls back gracefully if a path is missing. */
export function convertAmount(
  amt: number,
  from: BaseCCY,
  to: BaseCCY,
  matrix?: Matrix
): number {
  if (!isFinite(amt)) return 0;
  if (from === to) return amt;
  if (!matrix) return amt;

  // Direct edge
  const direct = matrix[from]?.[to];
  if (isPos(direct)) return amt * (direct as number);

  // Try USDT as bridge
  const viaU = matrix[from]?.USDT;
  const toU = matrix.USDT?.[to];
  if (isPos(viaU) && isPos(toU)) return amt * (viaU as number) * (toU as number);

  // Try BTC as bridge
  const viaB = matrix[from]?.BTC;
  const toB = matrix.BTC?.[to];
  if (isPos(viaB) && isPos(toB)) return amt * (viaB as number) * (toB as number);

  // Last resort: no conversion
  return amt;
}

/** Ensure fresh-enough rates; fetch if stale or forced. */
export async function ensureRates(force = false): Promise<RatesPayload> {
  const existing = await loadRates();
  if (!force && existing && !isStale(existing.fetchedAt)) return existing;

  const matrix = await fetchAndBuildMatrix();
  const payload: RatesPayload = { matrix, fetchedAt: Date.now() };
  await saveRates(payload);
  return payload;
}

/** Build a compact matrix from a few primitives. */
async function fetchAndBuildMatrix(): Promise<Matrix> {
  // 1) CoinGecko: tether (USDT) & bitcoin (BTC) vs usd, eur, chf, cny
  const cg = await fetchJson(
    "https://api.coingecko.com/api/v3/simple/price?ids=tether,bitcoin&vs_currencies=usd,eur,chf,cny"
  );

  // 2) exchangerate.host: EUR base to USD/CHF/CNY
  const fxEUR = await fetchJson(
    "https://api.exchangerate.host/latest?base=EUR&symbols=USD,CHF,CNY"
  );

  const usdt = cg?.tether ?? {};
  const btc = cg?.bitcoin ?? {};

  const EUR_CHF = numOrNaN(fxEUR?.rates?.CHF);
  const EUR_CNY = numOrNaN(fxEUR?.rates?.CNY);

  const USDT_USD = numOrNaN(usdt.usd); // ~1
  const USDT_EUR = numOrNaN(usdt.eur);
  const USDT_CHF = numOrNaN(usdt.chf);
  const USDT_CNY = numOrNaN(usdt.cny);

  const BTC_USD = numOrNaN(btc.usd);
  const BTC_EUR = numOrNaN(btc.eur);
  const BTC_CHF = numOrNaN(btc.chf);
  const BTC_CNY = numOrNaN(btc.cny);

  const matrix: Matrix = {
    USDT: {},
    BTC: {},
    EUR: {},
    CNY: {},
    CHF: {},
  };

  // USDT row
  if (isPos(USDT_EUR)) matrix.USDT.EUR = USDT_EUR;
  if (isPos(USDT_CHF)) matrix.USDT.CHF = USDT_CHF;
  if (isPos(USDT_CNY)) matrix.USDT.CNY = USDT_CNY;
  if (isPos(BTC_USD) && isPos(USDT_USD)) matrix.USDT.BTC = USDT_USD / BTC_USD;

  // BTC row
  if (isPos(BTC_USD) && isPos(USDT_USD)) matrix.BTC.USDT = BTC_USD / USDT_USD;
  if (isPos(BTC_EUR) && isPos(USDT_EUR)) matrix.BTC.EUR = BTC_EUR / USDT_EUR;
  if (isPos(BTC_CHF) && isPos(USDT_CHF)) matrix.BTC.CHF = BTC_CHF / USDT_CHF;
  if (isPos(BTC_CNY) && isPos(USDT_CNY)) matrix.BTC.CNY = BTC_CNY / USDT_CNY;

  // EUR row
  if (isPos(USDT_EUR)) matrix.EUR.USDT = 1 / USDT_EUR;
  if (isPos(EUR_CHF)) matrix.EUR.CHF = EUR_CHF;
  if (isPos(EUR_CNY)) matrix.EUR.CNY = EUR_CNY;
  if (isPos(BTC_EUR)) matrix.EUR.BTC = 1 / BTC_EUR;

  // CHF via EUR
  if (isPos(EUR_CHF)) {
    matrix.CHF.EUR = 1 / EUR_CHF;
    if (isPos(USDT_EUR)) matrix.CHF.USDT = (1 / EUR_CHF) * (1 / USDT_EUR);
    if (isPos(BTC_EUR)) matrix.CHF.BTC = (1 / EUR_CHF) * (1 / BTC_EUR);
    if (isPos(EUR_CNY)) matrix.CHF.CNY = (1 / EUR_CHF) * EUR_CNY;
  }

  // CNY via EUR
  if (isPos(EUR_CNY)) {
    matrix.CNY.EUR = 1 / EUR_CNY;
    if (isPos(USDT_EUR)) matrix.CNY.USDT = (1 / EUR_CNY) * (1 / USDT_EUR);
    if (isPos(BTC_EUR)) matrix.CNY.BTC = (1 / EUR_CNY) * (1 / BTC_EUR);
    if (isPos(EUR_CHF)) matrix.CNY.CHF = (1 / EUR_CNY) * EUR_CHF;
  }

  return matrix;
}

async function fetchJson(url: string) {
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

function numOrNaN(x: any): number {
  const n = Number(x);
  return isFinite(n) ? n : NaN;
}
function isPos(n: any): n is number {
  return typeof n === "number" && isFinite(n) && n > 0;
}
