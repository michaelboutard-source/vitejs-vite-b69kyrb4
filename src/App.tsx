// src/App.tsx
import React, { useEffect, useState } from "react";
import { useI18n } from "@i18n";
import { Card } from "@components/Card";
import { db } from "@db";

import { DashboardPage } from "@pages/Dashboard";
import { JournalPage } from "@pages/Journal";
import { PortfolioPage } from "@pages/Portfolio";
import { IdeasPage } from "@pages/Ideas";
import { KPIsPage } from "@pages/KPIs";        // <-- NEW
import { BackupPage } from "@pages/Backup";
import { SettingsPage } from "@pages/Settings";
import { DictionaryPage } from "@pages/Dictionary";

/** ====== Tiny hash router (no external deps) ====== */
type Route =
  | "dashboard"
  | "journal"
  | "portfolio"
  | "kpis"       // <-- NEW
  | "ideas"
  | "backup"
  | "settings"
  | "dictionary";

const ROUTES: Route[] = [
  "dashboard",
  "journal",
  "portfolio",
  "kpis",       // <-- NEW
  "ideas",
  "backup",
  "settings",
  "dictionary",
];

function useHashRoute(): [Route, (r: Route) => void] {
  const getRoute = (): Route => {
    const raw = (window.location.hash.replace(/^#\/?/, "") || "dashboard") as Route;
    return ROUTES.includes(raw) ? raw : "dashboard";
  };
  const [route, setRoute] = useState<Route>(getRoute);
  useEffect(() => {
    const onHash = () => setRoute(getRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const navigate = (r: Route) => {
    if (r !== route) window.location.hash = `/${r}`;
  };
  return [route, navigate];
}

/** ====== Simple layout bits ====== */
function Container({ children }: { children: React.ReactNode }) {
  return <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>{children}</div>;
}
function NavItem({ active, label, route }: { active: boolean; label: string; route: Route }) {
  return (
    <a
      href={`#/${route}`}
      style={{
        padding: "10px 12px",
        borderRadius: 12,
        textDecoration: "none",
        color: active ? "#111" : "#475569",
        background: active ? "#e2e8f0" : "transparent",
        fontWeight: 500,
      }}
    >
      {label}
    </a>
  );
}
function TopBar() {
  const { t, lang, setLang } = useI18n();
  return (
    <div style={{ background: "#111827", color: "#fff", padding: "12px 16px" }}>
      <Container>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 700 }}>{t("app_title")}</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <small style={{ opacity: 0.8 }}>{t("lang_label")}:</small>
            <button
              onClick={() => setLang("en")}
              style={{
                padding: "6px 10px",
                borderRadius: 10,
                border: "1px solid #334155",
                background: lang === "en" ? "#e2e8f0" : "transparent",
                color: lang === "en" ? "#111" : "#fff",
              }}
            >
              EN
            </button>
            <button
              onClick={() => setLang("zh")}
              style={{
                padding: "6px 10px",
                borderRadius: 10,
                border: "1px solid #334155",
                background: lang === "zh" ? "#e2e8f0" : "transparent",
                color: lang === "zh" ? "#111" : "#fff",
              }}
            >
              中文
            </button>
          </div>
        </div>
      </Container>
    </div>
  );
}

/** ====== App Shell (Provider is in main.tsx) ====== */
export default function App() {
  const { t } = useI18n();
  const [route] = useHashRoute();
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    db.open()
      .then(() => setDbReady(true))
      .catch(() => setDbReady(false));
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9" }}>
      <TopBar />
      <Container>
        {/* Nav */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
          <NavItem active={route === "dashboard"} label={t("nav_dashboard")} route="dashboard" />
          <NavItem active={route === "journal"} label={t("nav_journal")} route="journal" />
          <NavItem active={route === "portfolio"} label={t("nav_portfolio")} route="portfolio" />
          <NavItem active={route === "kpis"} label="KPIs" route="kpis" /> {/* NEW */}
          <NavItem active={route === "ideas"} label={t("nav_ideas")} route="ideas" />
          <NavItem active={route === "backup"} label="Backup" route="backup" />
          <NavItem active={route === "settings"} label={t("nav_settings")} route="settings" />
          <NavItem active={route === "dictionary"} label={t("nav_dictionary")} route="dictionary" />
        </div>

        {/* DB status */}
        {!dbReady ? <Card title={t("status_db_loading")} /> : <Card title={t("status_db_ready")} />}

        {/* Routes */}
        {route === "dashboard" && <DashboardPage />}
        {route === "journal" && <JournalPage />}
        {route === "portfolio" && <PortfolioPage />}
        {route === "kpis" && <KPIsPage />}{/* NEW */}
        {route === "ideas" && <IdeasPage />}
        {route === "backup" && <BackupPage />}
        {route === "settings" && <SettingsPage />}
        {route === "dictionary" && <DictionaryPage />}

        <div style={{ color: "#64748b", fontSize: 12, marginTop: 20, textAlign: "center" }}>
          i18n at root • offline storage ready • hash routing • KPIs enabled
        </div>
      </Container>
    </div>
  );
}
