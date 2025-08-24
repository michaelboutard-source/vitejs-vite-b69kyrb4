import { useEffect, useState } from "react";
import { Card } from "@components/Card";
import { useI18n } from "@i18n";
import { getAutoRefresh, setAutoRefresh, getBaseCurrency, setBaseCurrency, type BaseCCY } from "@db";
import { ensureRates, getLastUpdated, isStale } from "@lib/rates";

export function SettingsPage() {
  const { t, lang, setLang } = useI18n();
  const [autoRefresh, setAuto] = useState<boolean>(false);
  const [base, setBase] = useState<BaseCCY>("USDT");
  const [last, setLast] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      setAuto(await getAutoRefresh());
      setBase(await getBaseCurrency());
      setLast(await getLastUpdated());
    })();
  }, []);

  async function toggleAuto(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.checked;
    setAuto(v);
    await setAutoRefresh(v);
  }

  async function onChangeBase(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as BaseCCY;
    setBase(next);
    await setBaseCurrency(next);
    setBusy(true);
    try {
      const r = await ensureRates(true);
      setLast(r.fetchedAt);
    } finally {
      setBusy(false);
    }
  }

  async function updateRatesNow() {
    setBusy(true);
    try {
      const r = await ensureRates(true);
      setLast(r.fetchedAt);
    } catch {
      alert("Couldn't update rates, using last saved.");
    } finally {
      setBusy(false);
    }
  }

  const stale = isStale(last ?? undefined);

  return (
    <Card title={t("settings_title")} subtitle="Language, refresh, and currency">
      {/* Language */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 14, color: "#334155" }}>{t("lang_label")}:</label>
        <button onClick={() => setLang("en")} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #cbd5e1", background: lang === "en" ? "#e2e8f0" : "#fff" }}>
          English
        </button>
        <button onClick={() => setLang("zh")} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #cbd5e1", background: lang === "zh" ? "#e2e8f0" : "#fff" }}>
          简体中文
        </button>
      </div>

      {/* Auto refresh */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 12, border: "1px solid #e2e8f0", borderRadius: 12, background: "#f8fafc" }}>
        <input id="autoRefresh" type="checkbox" checked={autoRefresh} onChange={toggleAuto} />
        <label htmlFor="autoRefresh" style={{ fontWeight: 600 }}>Auto-refresh Dashboard</label>
        <span style={{ fontSize: 12, color: "#64748b" }}>(polls every 2s; disable for manual refresh)</span>
      </div>

      {/* Base currency + rates */}
      <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ fontWeight: 600 }}>Base currency:</label>
        <select
          value={base}
          onChange={onChangeBase}
          disabled={busy}
          style={{ padding: 8, borderRadius: 10, border: "1px solid #cbd5e1" }}
        >
          <option value="USDT">USDT</option>
          <option value="BTC">BTC</option>
          <option value="EUR">EUR</option>
          <option value="CNY">CNY</option>
          <option value="CHF">CHF</option>
        </select>

        <button
          onClick={updateRatesNow}
          disabled={busy}
          style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff" }}
        >
          {busy ? "Updating…" : "Update rates now"}
        </button>

        <span style={{ fontSize: 12, color: stale ? "#b91c1c" : "#64748b" }}>
          Last updated: {last ? new Date(last).toLocaleString() : "—"} {stale ? "(stale)" : ""}
        </span>
      </div>
    </Card>
  );
}
