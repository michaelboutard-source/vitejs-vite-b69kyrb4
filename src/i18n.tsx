import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type Lang = "en" | "zh";
type Dict = Record<string, string>;

const dicts: Record<Lang, Dict> = {
  en: {
    app_title: "Trading Journal",
    nav_dashboard: "Dashboard",
    nav_journal: "Journal",
    nav_portfolio: "Portfolio",
    nav_kpis: "KPIs",
    nav_ideas: "Ideas",
    nav_settings: "Settings",
    nav_dictionary: "Dictionary",

    status_db_ready: "Local storage ready (offline)",
    status_db_loading: "Preparing local storage…",

    dashboard_title: "Dashboard",
    dashboard_sub: "At-a-glance stats and balances.",

    journal_title: "Journal",
    journal_sub: "Add, edit, and close trades.",

    portfolio_title: "Portfolio",
    portfolio_sub: "Holdings, allocation, unrealized P/L.",

    ideas_title: "Ideas",
    ideas_sub: "Live market scan with your preferences.",

    settings_title: "Settings",
    settings_sub: "Language & dashboard refresh.",

    dictionary_title: "Dictionary",
    dictionary_sub: "Beginner-friendly trading terms.",

    lang_label: "Language",
  },
  zh: {
    app_title: "交易日志",
    nav_dashboard: "仪表盘",
    nav_journal: "交易日志",
    nav_portfolio: "投资组合",
    nav_kpis: "KPI",
    nav_ideas: "交易建议",
    nav_settings: "设置",
    nav_dictionary: "术语解释",

    status_db_ready: "本地存储已就绪（可离线使用）",
    status_db_loading: "正在初始化本地存储…",

    dashboard_title: "仪表盘",
    dashboard_sub: "总览统计与余额。",

    journal_title: "交易日志",
    journal_sub: "新增、编辑与平仓。",

    portfolio_title: "投资组合",
    portfolio_sub: "持仓、占比、未实现盈亏。",

    ideas_title: "交易建议",
    ideas_sub: "按你的偏好实时扫描市场。",

    settings_title: "设置",
    settings_sub: "语言与仪表盘刷新。",

    dictionary_title: "术语解释",
    dictionary_sub: "面向新手的清晰解释。",

    lang_label: "语言",
  },
};

const I18nCtx = createContext({
  lang: "en" as Lang,
  t: (k: string) => k,
  setLang: ((v: Lang) => { void v; }) as (l: Lang) => void,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem("lang") as Lang) || "en");
  useEffect(() => localStorage.setItem("lang", lang), [lang]);
  const t = (k: string) => dicts[lang][k] || k;
  const value = useMemo(() => ({ lang, t, setLang }), [lang]);
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}
export const useI18n = () => useContext(I18nCtx);
