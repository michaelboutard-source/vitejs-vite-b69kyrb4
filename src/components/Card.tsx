// src/components/Card.tsx
import React from "react";
import { theme } from "./theme";

type Tone = "default" | "success" | "warning" | "info" | "primary";

const toneMap: Record<Tone, string> = {
  default: theme.color.primary,
  primary: theme.color.primary,
  success: theme.color.accent,
  warning: theme.color.warning,
  info: theme.color.info,
};

export function Card({
  title,
  subtitle,
  children,
  tone = "default",
  style,
}: {
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
  tone?: Tone;
  style?: React.CSSProperties;
}) {
  const toneColor = toneMap[tone];

  return (
    <div
      style={{
        background: theme.color.card,
        borderRadius: theme.radius,
        boxShadow: theme.shadow,
        border: `1px solid ${theme.color.line}`,
        padding: 16,
        ...style,
      }}
    >
      {(title || subtitle) && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <span
              aria-hidden
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: toneColor,
                boxShadow: `0 0 0 6px ${toneColor}1a`,
              }}
            />
            <div style={{ fontWeight: 800, color: theme.color.text }}>{title}</div>
          </div>
          {subtitle && <div style={{ color: theme.color.muted, fontSize: 13 }}>{subtitle}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

export function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        background: theme.color.chip,
        color: theme.color.chipText,
        borderRadius: 999,
        padding: "4px 10px",
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {children}
    </span>
  );
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: "#f8fafc",
        borderRadius: 12,
        padding: 12,
        border: `1px solid ${theme.color.line}`,
      }}
    >
      <div style={{ fontSize: 12, color: theme.color.muted }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: theme.color.text }}>{value}</div>
    </div>
  );
}

/** Optional: shared buttons for consistent look */
export const Btn = {
  primary: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #111",
    background: "#111",
    color: "#fff",
  } as React.CSSProperties,
  ghost: {
    padding: "10px 12px",
    borderRadius: 10,
    border: `1px solid ${theme.color.line}`,
    background: "#fff",
    color: theme.color.btnGhostText,
  } as React.CSSProperties,
  danger: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #fecaca",
    background: "#fee2e2",
    color: "#991b1b",
  } as React.CSSProperties,
};
