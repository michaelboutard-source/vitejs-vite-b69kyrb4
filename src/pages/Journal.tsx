// src/pages/Journal.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Card } from "@components/Card";
import { InputSmall, SelectSmall, Th, Td } from "@components/Inputs";
import { useI18n } from "@i18n";
import { db } from "@db";

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
}

function uuid() {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
}
function tradePnl(t: Trade) {
  if (t.status !== "closed" || typeof t.exitPrice !== "number") return 0;
  const dir = t.side === "long" ? 1 : -1;
  const gross = (t.exitPrice - t.entryPrice) * t.quantity * dir;
  const fees = t.fees || 0;
  return +(gross - fees).toFixed(2);
}
const toNum = (x: any) => Number(String(x ?? "").replace(",", "."));

type SortKey =
  | "openedAt" | "symbol" | "side" | "quantity"
  | "entryPrice" | "exitPrice" | "status" | "pnl" | "pnlPct";
type SortDir = "asc" | "desc";

export function JournalPage() {
  const { t } = useI18n();
  const [trades, setTrades] = useState<Trade[]>([]);

  // Filters
  const [qSymbol, setQSymbol] = useState("");
  const [fSide, setFSide] = useState<"all" | "long" | "short">("all");
  const [fStatus, setFStatus] = useState<"all" | TradeStatus>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Form (top create/edit)
  const emptyForm: Partial<Trade> = {
    market: "spot",
    exchange: "Binance",
    symbol: "BTCUSDT",
    side: "long",
    entryPrice: undefined as any,
    exitPrice: undefined as any,
    quantity: undefined as any,
    fees: "" as any,
    openedAt: new Date().toISOString(),
    notes: "",
  };
  const [form, setForm] = useState<Partial<Trade>>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Inline edit (per-row)
  const [rowEditId, setRowEditId] = useState<string | null>(null);
  const [rowDraft, setRowDraft] = useState<{ exitPrice: string; fees: string; notes: string }>({
    exitPrice: "",
    fees: "",
    notes: "",
  });

  // Sorting
  const [sortKey, setSortKey] = useState<SortKey>("openedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  function onSortClick(k: SortKey) {
    setSortKey((prev) => {
      if (prev === k) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return prev;
      }
      setSortDir("asc");
      return k;
    });
  }

  useEffect(() => {
    loadTrades();
  }, []);
  async function loadTrades() {
    const list = await db.trades.orderBy("openedAt").reverse().toArray();
    setTrades(list as Trade[]);
    setSelectedIds(new Set());
    setRowEditId(null);
  }

  // Date helpers
  function toLocal(dtISO?: string) {
    if (!dtISO) return "";
    const d = new Date(dtISO);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function fromLocal(input: string) {
    return input ? new Date(input).toISOString() : undefined;
  }

  // Validation (create/edit form)
  const symbolOk = (s: any) => typeof s === "string" && /^[A-Za-z0-9]+$/.test(s.trim());
  const numGt0 = (n: any) => isFinite(toNum(n)) && toNum(n) > 0;
  const numGe0 = (n: any) => isFinite(toNum(n)) && toNum(n) >= 0;

  function validate(f: Partial<Trade>) {
    const e: Record<string, string> = {};
    if (!f.symbol) e.symbol = "Required";
    else if (!symbolOk(f.symbol)) e.symbol = "Use letters/numbers only (e.g., BTCUSDT)";
    if (f.quantity === undefined || (f.quantity as any) === "") e.quantity = "Required";
    else if (!numGt0(f.quantity)) e.quantity = "Must be a number > 0";
    if (f.entryPrice === undefined || (f.entryPrice as any) === "") e.entryPrice = "Required";
    else if (!numGt0(f.entryPrice)) e.entryPrice = "Must be a number > 0";
    if (f.exitPrice !== undefined && (f.exitPrice as any) !== "" && !numGt0(f.exitPrice)) e.exitPrice = "Must be a number > 0";
    if (f.fees !== undefined && (f.fees as any) !== "" && !numGe0(f.fees)) e.fees = "Must be a number ≥ 0";
    if (!f.openedAt) e.openedAt = "Required";
    if (f.closedAt && f.openedAt && new Date(f.closedAt).getTime() < new Date(f.openedAt).getTime())
      e.closedAt = "Closed time cannot be before Opened time";
    return e;
  }

  // CRUD (top form)
  async function onSubmit() {
    const now = new Date().toISOString();
    const draft: Partial<Trade> = { ...form };
    const errs = validate(draft);
    setErrors(errs);
    if (Object.keys(errs).length) return;

    if (editingId) {
      const prev = trades.find((t) => t.id === editingId)!;
      const updated: Trade = {
        ...prev,
        ...draft,
        symbol: String(draft.symbol).toUpperCase(),
        entryPrice: toNum(draft.entryPrice),
        exitPrice:
          draft.exitPrice !== undefined && (draft.exitPrice as any) !== ""
            ? toNum(draft.exitPrice)
            : undefined,
        quantity: toNum(draft.quantity),
        fees: (draft.fees as any) === "" ? 0 : toNum(draft.fees),
        openedAt: draft.openedAt || prev.openedAt || now,
        closedAt: draft.exitPrice ? (draft.closedAt || now) : undefined,
        status: draft.exitPrice ? "closed" : "open",
      };
      await db.trades.put(updated);
      setEditingId(null);
      setForm(emptyForm);
      setErrors({});
    } else {
      const rec: Trade = {
        id: uuid(),
        status: draft.exitPrice ? "closed" : "open",
        market: (draft.market as any) || "spot",
        exchange: draft.exchange?.trim(),
        symbol: String(draft.symbol).toUpperCase(),
        side: (draft.side as any) || "long",
        entryPrice: toNum(draft.entryPrice),
        exitPrice:
          draft.exitPrice !== undefined && (draft.exitPrice as any) !== ""
            ? toNum(draft.exitPrice)
            : undefined,
        quantity: toNum(draft.quantity),
        fees: (draft.fees as any) === "" ? 0 : toNum(draft.fees),
        openedAt: draft.openedAt || now,
        closedAt: draft.exitPrice ? (draft.closedAt || now) : undefined,
        notes: draft.notes || "",
      };
      await db.trades.add(rec);
      setForm(emptyForm);
      setErrors({});
    }
    await loadTrades();
  }

  async function onEdit(t: Trade) {
    setEditingId(t.id);
    setForm({ ...t });
  }
  async function onClose(trade: Trade) {
    const exitPriceStr = prompt(`Exit price for ${trade.symbol}:`, String(trade.exitPrice ?? trade.entryPrice ?? ""));
    if (!exitPriceStr) return;
    const exit = toNum(exitPriceStr);
    if (!isFinite(exit) || exit <= 0) {
      alert("Must be a number > 0");
      return;
    }
    const updated: Trade = { ...trade, status: "closed", exitPrice: exit, closedAt: new Date().toISOString() };
    await db.trades.put(updated);
    await loadTrades();
  }
  async function onDelete(t: Trade) {
    if (!confirm(`Delete trade ${t.symbol}?`)) return;
    await db.trades.delete(t.id);
    await loadTrades();
  }
  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setErrors({});
  }

  // Filters → list
  const filtered = trades.filter((t) => {
    if (qSymbol && !t.symbol.toLowerCase().includes(qSymbol.toLowerCase())) return false;
    if (fSide !== "all" && t.side !== fSide) return false;
    if (fStatus !== "all" && t.status !== fStatus) return false;
    if (fromDate) {
      const ts = new Date(fromDate + "T00:00:00").getTime();
      if (new Date(t.openedAt).getTime() < ts) return false;
    }
    if (toDate) {
      const te = new Date(toDate + "T23:59:59").getTime();
      if (new Date(t.openedAt).getTime() > te) return false;
    }
    return true;
  });

  // Sort
  const sorted = useMemo(() => {
    const withMetrics = filtered.map((t) => {
      const pnl = tradePnl(t);
      const cost = t.entryPrice * t.quantity;
      const pnlPct = t.status === "closed" && cost ? (pnl / cost) * 100 : 0;
      return { t, pnl, pnlPct };
    });
    withMetrics.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortKey) {
        case "openedAt": return (new Date(a.t.openedAt).getTime() - new Date(b.t.openedAt).getTime()) * dir;
        case "symbol": return a.t.symbol.localeCompare(b.t.symbol) * dir;
        case "side": return a.t.side.localeCompare(b.t.side) * dir;
        case "quantity": return (a.t.quantity - b.t.quantity) * dir;
        case "entryPrice": return (a.t.entryPrice - b.t.entryPrice) * dir;
        case "exitPrice": return ((a.t.exitPrice ?? 0) - (b.t.exitPrice ?? 0)) * dir;
        case "status": return a.t.status.localeCompare(b.t.status) * dir;
        case "pnl": return (a.pnl - b.pnl) * dir;
        case "pnlPct": return (a.pnlPct - b.pnlPct) * dir;
      }
    });
    return withMetrics;
  }, [filtered, sortKey, sortDir]);

  // Bulk helpers
  const allVisibleSelected = sorted.length > 0 && sorted.every(({ t }) => selectedIds.has(t.id));
  function toggleSelectAllVisible() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const { t } of sorted) next.delete(t.id);
      } else {
        for (const { t } of sorted) next.add(t.id);
      }
      return next;
    });
  }
  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  async function bulkDelete() {
    if (selectedIds.size === 0) return;
    const ok = confirm(`Delete ${selectedIds.size} selected trade(s)?`);
    if (!ok) return;
    await db.trades.bulkDelete(Array.from(selectedIds));
    await loadTrades();
  }
  async function bulkCloseWithPrompts() {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      const t = trades.find((x) => x.id === id);
      if (!t || t.status !== "open") continue;
      const exitPriceStr = prompt(`Exit price for ${t.symbol}:`, String(t.exitPrice ?? t.entryPrice ?? ""));
      if (!exitPriceStr) continue;
      const exit = toNum(exitPriceStr);
      if (!isFinite(exit) || exit <= 0) continue;
      const updated: Trade = { ...t, status: "closed", exitPrice: exit, closedAt: new Date().toISOString() };
      await db.trades.put(updated);
    }
    await loadTrades();
  }

  // Inline edit row
  function startRowEdit(x: Trade) {
    setRowEditId(x.id);
    setRowDraft({
      exitPrice: x.exitPrice !== undefined ? String(x.exitPrice) : "",
      fees: x.fees !== undefined ? String(x.fees) : "",
      notes: x.notes ?? "",
    });
  }
  function cancelRowEdit() {
    setRowEditId(null);
  }
  async function saveRowEdit(x: Trade) {
    const exitStr = rowDraft.exitPrice.trim();
    const feesStr = rowDraft.fees.trim();
    const exit = exitStr === "" ? undefined : toNum(exitStr);
    const fees = feesStr === "" ? 0 : toNum(feesStr);
    if (exitStr !== "" && (!isFinite(exit!) || (exit as number) <= 0)) {
      alert("Exit must be a number > 0 (or leave blank).");
      return;
    }
    if (!isFinite(fees) || fees < 0) {
      alert("Fees must be a number ≥ 0.");
      return;
    }
    let status: TradeStatus = x.status;
    let closedAt = x.closedAt;
    if (exit !== undefined) {
      status = "closed";
      closedAt = x.closedAt || new Date().toISOString();
    } else {
      status = "open";
      closedAt = undefined;
    }
    const updated: Trade = { ...x, exitPrice: exit, fees, notes: rowDraft.notes, status, closedAt };
    await db.trades.put(updated);
    setRowEditId(null);
    await loadTrades();
  }

  return (
    <Card title={t("journal_title")} subtitle="Add, edit, close trades. Bulk select, inline edits, and sorting.">
      {/* Top form */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
        {/* Row 1 */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <SelectSmall
            label="Market"
            value={form.market || "spot"}
            onChange={(v) => setForm((f) => ({ ...f, market: v as any }))}
            options={["spot", "futures"]}
            style={{ flex: "0 0 120px", minWidth: 120 }}
          />
          <SelectSmall
            label="Side"
            value={form.side || "long"}
            onChange={(v) => setForm((f) => ({ ...f, side: v as any }))}
            options={["long", "short"]}
            style={{ flex: "0 0 120px", minWidth: 120 }}
          />
          <InputSmall
            label="Symbol"
            value={(form.symbol as any) || ""}
            onChange={(v) => setForm((f) => ({ ...f, symbol: v.toUpperCase() }))}
            placeholder="BTCUSDT"
            style={{ flex: "1 1 120px", minWidth: 120 }}
            error={!!errors.symbol}
            errorText={errors.symbol}
          />
        </div>
        {/* Row 2 */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <InputSmall
            label="Qty"
            type="number"
            value={(form.quantity as any) || ""}
            onChange={(v) => setForm((f) => ({ ...f, quantity: v.replace(",", ".") as any }))}
            style={{ flex: "1 1 90px", minWidth: 90 }}
            error={!!errors.quantity}
            errorText={errors.quantity}
          />
          <InputSmall
            label="Entry"
            type="number"
            value={(form.entryPrice as any) || ""}
            onChange={(v) => setForm((f) => ({ ...f, entryPrice: v.replace(",", ".") as any }))}
            style={{ flex: "1 1 100px", minWidth: 100 }}
            error={!!errors.entryPrice}
            errorText={errors.entryPrice}
          />
          <InputSmall
            label="Exit"
            type="number"
            value={(form.exitPrice as any) || ""}
            onChange={(v) => setForm((f) => ({ ...f, exitPrice: v.replace(",", ".") as any }))}
            style={{ flex: "1 1 100px", minWidth: 100 }}
            error={!!errors.exitPrice}
            errorText={errors.exitPrice}
          />
          <InputSmall
            label="Fees"
            type="number"
            value={(form.fees as any) ?? ""}
            onChange={(v) => setForm((f) => ({ ...f, fees: v.replace(",", ".") as any }))}
            style={{ flex: "1 1 100px", minWidth: 100 }}
            error={!!errors.fees}
            errorText={errors.fees}
          />
        </div>
        {/* Row 3 */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <InputSmall
            label="Opened at"
            type="datetime-local"
            value={toLocal(form.openedAt)}
            onChange={(v) => setForm((f) => ({ ...f, openedAt: fromLocal(v) }))}
            style={{ flex: "1 1 160px", minWidth: 160 }}
            error={!!errors.openedAt}
            errorText={errors.openedAt}
          />
          <InputSmall
            label="Closed at"
            type="datetime-local"
            value={toLocal(form.closedAt)}
            onChange={(v) => setForm((f) => ({ ...f, closedAt: fromLocal(v) }))}
            style={{ flex: "1 1 160px", minWidth: 160 }}
            error={!!errors.closedAt}
            errorText={errors.closedAt}
          />
        </div>
        {/* Row 4 */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
          <InputSmall
            label="Notes"
            value={(form.notes as any) || ""}
            onChange={(v) => setForm((f) => ({ ...f, notes: v }))}
            placeholder=""
            style={{ flex: "1 1 400px", maxWidth: 400 }}
            multiline
          />
          <div style={{ display: "flex", gap: 8, alignItems: "end" }}>
            <button
              onClick={onSubmit}
              style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5e1", background: "#111", color: "#fff" }}
            >
              {editingId ? "Save changes" : "Add trade"}
            </button>
            {editingId && (
              <button
                onClick={resetForm}
                style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff" }}
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "10px 0" }}>
        <input placeholder="Search symbol…" value={qSymbol} onChange={(e) => setQSymbol(e.target.value)} style={{ padding: 8, borderRadius: 10, border: "1px solid #cbd5e1" }} />
        <select value={fSide} onChange={(e) => setFSide(e.target.value as any)} style={{ padding: 8, borderRadius: 10, border: "1px solid #cbd5e1" }}>
          <option value="all">Side: All</option><option value="long">Long</option><option value="short">Short</option>
        </select>
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value as any)} style={{ padding: 8, borderRadius: 10, border: "1px solid #cbd5e1" }}>
          <option value="all">Status: All</option><option value="open">Open</option><option value="closed">Closed</option>
        </select>
        <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={{ padding: 8, borderRadius: 10, border: "1px solid #cbd5e1" }} />
        <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={{ padding: 8, borderRadius: 10, border: "1px solid #cbd5e1" }} />
      </div>

      {/* Bulk actions */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", margin: "8px 0 12px" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAllVisible} />
          <span>Select all visible</span>
        </label>
        <span style={{ color: "#64748b" }}>Selected: {selectedIds.size}</span>
        <button onClick={bulkDelete} disabled={selectedIds.size === 0} style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #fecaca", background: "#fee2e2", color: "#991b1b" }}>
          Delete selected
        </button>
        <button onClick={bulkCloseWithPrompts} disabled={selectedIds.size === 0} title="Prompts exit price per selected OPEN trade" style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff" }}>
          Bulk close (prompts)
        </button>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", fontSize: 14 }}>
          <thead>
            <tr style={{ background: "#eef2f7" }}>
              <Th><input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAllVisible} title="Select all visible" /></Th>
              <Th><button onClick={() => onSortClick("openedAt")} style={btnHead}>Opened {sortKey==="openedAt" ? (sortDir==="asc"?"▲":"▼"):""}</button></Th>
              <Th><button onClick={() => onSortClick("symbol")}   style={btnHead}>Symbol {sortKey==="symbol" ? (sortDir==="asc"?"▲":"▼"):""}</button></Th>
              <Th><button onClick={() => onSortClick("side")}     style={btnHead}>Side {sortKey==="side" ? (sortDir==="asc"?"▲":"▼"):""}</button></Th>
              <Th><button onClick={() => onSortClick("quantity")} style={btnHead}>Qty {sortKey==="quantity" ? (sortDir==="asc"?"▲":"▼"):""}</button></Th>
              <Th><button onClick={() => onSortClick("entryPrice")} style={btnHead}>Entry {sortKey==="entryPrice" ? (sortDir==="asc"?"▲":"▼"):""}</button></Th>
              <Th><button onClick={() => onSortClick("exitPrice")} style={btnHead}>Exit {sortKey==="exitPrice" ? (sortDir==="asc"?"▲":"▼"):""}</button></Th>
              <Th><button onClick={() => onSortClick("status")}   style={btnHead}>Status {sortKey==="status" ? (sortDir==="asc"?"▲":"▼"):""}</button></Th>
              <Th style={{ textAlign: "right" }}><button onClick={() => onSortClick("pnl")}    style={btnHead}>P/L {sortKey==="pnl" ? (sortDir==="asc"?"▲":"▼"):""}</button></Th>
              <Th style={{ textAlign: "right" }}><button onClick={() => onSortClick("pnlPct")} style={btnHead}>P/L % {sortKey==="pnlPct" ? (sortDir==="asc"?"▲":"▼"):""}</button></Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(({ t, pnl, pnlPct }) => {
              const checked = selectedIds.has(t.id);
              const isEditing = rowEditId === t.id;
              return (
                <tr key={t.id} style={{ borderTop: "1px solid #e2e8f0" }}>
                  <Td>
                    <input type="checkbox" checked={checked} onChange={() => toggleRow(t.id)} title="Select row" />
                  </Td>
                  <Td>{new Date(t.openedAt).toLocaleString()}</Td>
                  <Td>{t.symbol}</Td>
                  <Td style={{ color: t.side === "long" ? "#059669" : "#dc2626" }}>{t.side}</Td>
                  <Td>{t.quantity}</Td>
                  <Td>{t.entryPrice}</Td>
                  <Td>
                    {isEditing ? (
                      <input
                        type="number"
                        value={rowDraft.exitPrice}
                        onChange={(e) => setRowDraft((d) => ({ ...d, exitPrice: e.target.value.replace(",", ".") }))}
                        step="any"
                        inputMode="decimal"
                        style={cellInput}
                      />
                    ) : (
                      t.exitPrice ?? "—"
                    )}
                  </Td>
                  <Td>{t.status}</Td>
                  <Td style={{ textAlign: "right", color: pnl >= 0 ? "#059669" : "#dc2626" }}>
                    {t.status === "closed" ? pnl.toFixed(2) : "—"}
                  </Td>
                  <Td style={{ textAlign: "right", color: pnl >= 0 ? "#059669" : "#dc2626" }}>
                    {t.status === "closed" ? `${pnlPct.toFixed(2)}%` : "—"}
                  </Td>
                  <Td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {isEditing ? (
                        <>
                          <button onClick={() => saveRowEdit(t)} style={btnPrimary}>Save</button>
                          <button onClick={cancelRowEdit} style={btnSecondary}>Cancel</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => onEdit(t)} style={btnSecondary}>Edit</button>
                          {t.status === "open" && <button onClick={() => onClose(t)} style={btnPrimary}>Close</button>}
                          <button onClick={() => startRowEdit(t)} style={btnSecondary}>Inline Edit</button>
                          <button onClick={() => onDelete(t)} style={btnDanger}>Delete</button>
                        </>
                      )}
                    </div>
                    {isEditing && (
                      <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                        <input
                          type="number"
                          value={rowDraft.fees}
                          onChange={(e) => setRowDraft((d) => ({ ...d, fees: e.target.value.replace(",", ".") }))}
                          placeholder="Fees"
                          step="any"
                          inputMode="decimal"
                          style={{ ...cellInput, width: 90 }}
                          title="Fees"
                        />
                        <input
                          value={rowDraft.notes}
                          onChange={(e) => setRowDraft((d) => ({ ...d, notes: e.target.value }))}
                          placeholder="Notes"
                          style={{ ...cellInput, width: 240 }}
                          title="Notes"
                        />
                      </div>
                    )}
                  </Td>
                </tr>
              );
            })}
            {!sorted.length && (
              <tr>
                <td colSpan={11} style={{ padding: 16, textAlign: "center", color: "#64748b" }}>
                  No trades found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

const btnPrimary: React.CSSProperties = { padding: "6px 10px", borderRadius: 10, border: "1px solid #111", background: "#111", color: "#fff" };
const btnSecondary: React.CSSProperties = { padding: "6px 10px", borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff" };
const btnDanger: React.CSSProperties = { padding: "6px 10px", borderRadius: 10, border: "1px solid #fecaca", background: "#fee2e2", color: "#991b1b" };
const btnHead: React.CSSProperties = { border: "none", background: "transparent", padding: 6, cursor: "pointer", fontWeight: 600 };

const cellInput: React.CSSProperties = {
  padding: 6,
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  minWidth: 80,
};
