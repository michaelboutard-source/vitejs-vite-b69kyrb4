// src/components/theme.ts
export const theme = {
  radius: 14,
  shadow: "0 10px 30px rgba(16,24,40,.08)",
  color: {
    // App chrome
    bg: "linear-gradient(180deg, #f7faff 0%, #f6f8fc 60%, #f9fafb 100%)",
    card: "#ffffff",
    text: "#0f172a",
    muted: "#667085",
    line: "#e5e7eb",

    // Accents (happy, readable)
    primary: "#6366f1",   // indigo
    accent:  "#22c55e",   // green
    warning: "#f59e0b",   // amber
    danger:  "#ef4444",   // red
    info:    "#06b6d4",   // cyan
    purple:  "#a78bfa",

    // Chips
    chip: "#eef2ff",
    chipText: "#3730a3",

    // Buttons
    btnText: "#0f172a",
    btnGhostText: "#334155",
  },
};

export const friendlyPalette = [
  "#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4",
  "#a78bfa", "#10b981", "#f97316", "#e11d48", "#14b8a6",
  "#84cc16", "#f43f5e", "#0ea5e9", "#8b5cf6", "#fbbf24"
];
