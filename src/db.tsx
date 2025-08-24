import Dexie, { type Table } from "dexie";

/* ========= Types ========= */
export type TradeStatus = "open" | "closed";

export interface Trade {
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
  tags?: string[]; // optional tags if you’re using them
}

export interface Holding {
  id: string;
  symbol: string;
  quantity: number;
  avgEntry: number;
}

export interface MetaKV {
  key: string;
  value: any;
}

/* ========= Dexie DB ========= */
export class JournalDB extends Dexie {
  trades!: Table<Trade, string>;
  holdings!: Table<Holding, string>;
  meta!: Table<MetaKV, string>;
  constructor() {
    super("journalDB");
    this.version(1).stores({
      trades: "id, symbol, status, openedAt, closedAt",
      holdings: "id, symbol",
      meta: "key",
    });
  }
}
export const db = new JournalDB();

/* ========= PnL helper ========= */
export function tradePnl(t: Trade) {
  if (t.status !== "closed" || typeof t.exitPrice !== "number") return 0;
  const dir = t.side === "long" ? 1 : -1;
  const gross = (t.exitPrice - t.entryPrice) * t.quantity * dir;
  const fees = t.fees || 0;
  return +(gross - fees).toFixed(2);
}

/* ========= Generic Meta KV ========= */
export async function getMetaKV<T = any>(key: string): Promise<T | null> {
  const rec = await db.meta.get({ key });
  return (rec?.value as T) ?? null;
}
export async function setMetaKV(key: string, value: any) {
  await db.meta.put({ key, value });
}

/* ========= App Meta: starting balance, auto refresh ========= */
export async function getStartingBalance(): Promise<number> {
  const v = await getMetaKV<number>("startingBalance");
  return typeof v === "number" ? v : 0;
}
export async function setStartingBalance(n: number) {
  await setMetaKV("startingBalance", n);
}

export async function getAutoRefresh(): Promise<boolean> {
  const v = await getMetaKV<boolean>("autoRefresh");
  return !!v;
}
export async function setAutoRefresh(flag: boolean) {
  await setMetaKV("autoRefresh", !!flag);
}

/* ========= Base currency ========= */
export type BaseCCY = "USDT" | "BTC" | "EUR" | "CNY" | "CHF";

export async function getBaseCurrency(): Promise<BaseCCY> {
  const v = await getMetaKV<BaseCCY>("base_currency_v1");
  return (v ?? "USDT") as BaseCCY;
}
export async function setBaseCurrency(ccy: BaseCCY) {
  await setMetaKV("base_currency_v1", ccy);
}

/* ========= Price cache for Portfolio/Ideas =========
   Stores a simple symbol->price map under a single meta key. */
const PRICE_MAP_KEY = "price_map_v1";

export async function getPriceMap(): Promise<Record<string, number>> {
  const m = await getMetaKV<Record<string, number>>(PRICE_MAP_KEY);
  return m ?? {};
}

/** setPrice: persist one symbol’s price (overwrites that key only). */
export async function setPrice(symbol: string, price: number) {
  const key = String(symbol || "").toUpperCase();
  if (!key) return;
  const map = await getPriceMap();
  map[key] = price;
  await setMetaKV(PRICE_MAP_KEY, map);
}

/* ========= (Optional) export a uuid if you want to import from DB
   You DON’T have to use this if you prefer the local helper in pages. */
export function genUuid(): string {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
}
