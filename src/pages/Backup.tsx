// src/pages/Backup.tsx
import React, { useMemo, useRef, useState } from "react";
import { Card } from "@components/Card";
import { useI18n } from "@i18n";
import { db } from "@db";

type BackupPayload = {
  trades?: any[];
  holdings?: any[];
  meta?: any[];
  _app?: { name: string; version: string; exportedAt: string };
};

function uuid() {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

async function collectAll(): Promise<Required<BackupPayload>> {
  const [trades, holdings, meta] = await Promise.all([
    db.trades.toArray(),
    db.holdings.toArray(),
    db.meta.toArray(),
  ]);
  return { trades, holdings, meta, _app: { name: "TradingJournal", version: "MVP", exportedAt: new Date().toISOString() } };
}

function download(filename: string, text: string) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function BackupPage() {
  const { t } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);

  const [expLoading, setExpLoading] = useState(false);
  const [impLoading, setImpLoading] = useState(false);
  const [lastExportName, setLastExportName] = useState<string>("");

  // Import preview
  const [preview, setPreview] = useState<BackupPayload | null>(null);
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const totalPreview = useMemo(() => ({
    trades: preview?.trades?.length || 0,
    holdings: preview?.holdings?.length || 0,
    meta: preview?.meta?.length || 0,
  }), [preview]);

  async function onExport() {
    try {
      setExpLoading(true);
      const data = await collectAll();
      const fname = `trading-journal-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
      download(fname, JSON.stringify(data, null, 2));
      setLastExportName(fname);
    } catch (e) {
      alert("Export failed: " + (e as any)?.message);
    } finally {
      setExpLoading(false);
    }
  }

  function triggerImportPick() {
    fileRef.current?.click();
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    try {
      const json = JSON.parse(text);
      // Soft validation
      if (!json || (typeof json !== "object")) throw new Error("Invalid JSON");
      if (!("trades" in json) && !("holdings" in json) && !("meta" in json)) {
        throw new Error("Does not look like a Trading Journal backup");
      }
      setPreview({
        trades: Array.isArray(json.trades) ? json.trades : [],
        holdings: Array.isArray(json.holdings) ? json.holdings : [],
        meta: Array.isArray(json.meta) ? json.meta : [],
        _app: json._app,
      });
    } catch (err) {
      alert("Could not parse backup JSON: " + (err as any)?.message);
      setPreview(null);
    } finally {
      // allow re‑selecting the same file later
      e.target.value = "";
    }
  }

  async function importNow() {
    if (!preview) return;
    if (mode === "replace") {
      const ok = confirm("Replace = wipe current data then import. Continue?");
      if (!ok) return;
    }
    setImpLoading(true);
    try {
      if (mode === "replace") {
        await db.trades.clear();
        await db.holdings.clear();
        await db.meta.clear();
      }
      // Upsert trades
      if (preview.trades?.length) {
        const normalized = preview.trades.map((t: any) => ({
          ...t,
          id: t.id || uuid(),
        }));
        await db.trades.bulkPut(normalized);
      }
      // Upsert holdings
      if (preview.holdings?.length) {
        const normalized = preview.holdings.map((h: any) => ({
          ...h,
          id: h.id || uuid(),
        }));
        await db.holdings.bulkPut(normalized);
      }
      // Upsert meta (key/value by key)
      if (preview.meta?.length) {
        // Ensure we have key for meta; drop invalid
        const normalized = preview.meta.filter((m: any) => m && typeof m.key === "string");
        await db.meta.bulkPut(normalized);
      }
      alert("Import complete.");
      setPreview(null);
    } catch (e) {
      alert("Import failed: " + (e as any)?.message);
    } finally {
      setImpLoading(false);
    }
  }

  return (
    <Card title="Backup" subtitle="Export your local data as JSON, or import a previous backup.">
      {/* Export */}
      <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
        <div style={{ fontWeight: 700 }}>Export</div>
        <div style={{ color: "#64748b" }}>
          Includes <b>Trades</b>, <b>Holdings</b>, and <b>Settings</b> (meta). No accounts, no servers—purely local.
        </div>
        <div>
          <button
            onClick={onExport}
            disabled={expLoading}
            style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #111", background: "#111", color: "#fff" }}
          >
            {expLoading ? "Preparing…" : "Export JSON"}
          </button>
          {lastExportName && (
            <span style={{ marginLeft: 12, color: "#64748b" }}>Saved: {lastExportName}</span>
          )}
        </div>
      </div>

      {/* Import */}
      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ fontWeight: 700 }}>Import</div>
        <div style={{ color: "#64748b" }}>
          Choose a previously exported JSON file. You can <b>Merge</b> (upsert) or <b>Replace</b> (wipe current first).
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={triggerImportPick}
            style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff" }}
          >
            Pick JSON…
          </button>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="radio"
              name="mode"
              value="merge"
              checked={mode === "merge"}
              onChange={() => setMode("merge")}
            />
            <span>Merge</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="radio"
              name="mode"
              value="replace"
              checked={mode === "replace"}
              onChange={() => setMode("replace")}
            />
            <span>Replace</span>
          </label>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            onChange={onPickFile}
            style={{ display: "none" }}
          />
        </div>

        {/* Preview */}
        {preview && (
          <div style={{ border: "1px solid #e2e8f0", background: "#f8fafc", borderRadius: 12, padding: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Preview</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              <div><div style={{ color: "#64748b", fontSize: 12 }}>Trades</div><div style={{ fontWeight: 800 }}>{totalPreview.trades}</div></div>
              <div><div style={{ color: "#64748b", fontSize: 12 }}>Holdings</div><div style={{ fontWeight: 800 }}>{totalPreview.holdings}</div></div>
              <div><div style={{ color: "#64748b", fontSize: 12 }}>Meta</div><div style={{ fontWeight: 800 }}>{totalPreview.meta}</div></div>
            </div>
            <div style={{ marginTop: 10 }}>
              <button
                onClick={importNow}
                disabled={impLoading}
                style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #111", background: "#111", color: "#fff" }}
              >
                {impLoading ? "Importing…" : `Import (${mode})`}
              </button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
