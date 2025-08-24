import React from "react";
import { friendlyPalette, theme } from "./theme";

/* =========================
   PIE (existing, unchanged)
   ========================= */

export type PieDatum = { label: string; value: number; color?: string };

export function PieChart({
  data,
  size = 240,
  stroke = 24,
}: {
  data: PieDatum[];
  size?: number;
  stroke?: number;
}) {
  const total = Math.max(0, data.reduce((s, d) => s + Math.max(0, d.value), 0));
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - stroke) / 2;
  let acc = 0;

  const segs = data.map((d, i) => {
    const v = Math.max(0, d.value);
    const frac = total > 0 ? v / total : 0;
    const start = acc * 2 * Math.PI;
    const end = (acc + frac) * 2 * Math.PI;
    acc += frac;

    const largeArc = frac > 0.5 ? 1 : 0;
    const x1 = cx + r * Math.cos(start);
    const y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy + r * Math.sin(end);

    const color = d.color || friendlyPalette[i % friendlyPalette.length];

    const dPath = [`M ${x1} ${y1}`, `A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`].join(" ");

    return (
      <path
        key={i}
        d={dPath}
        stroke={color}
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="butt"
      />
    );
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Pie chart">
      {/* background ring */}
      <circle cx={cx} cy={cy} r={r} stroke={theme.color.line} strokeWidth={stroke} fill="none" />
      {segs}
    </svg>
  );
}

export function Legend({
  data,
  showPercent = true,
}: {
  data: PieDatum[];
  showPercent?: boolean;
}) {
  const total = Math.max(0, data.reduce((s, d) => s + Math.max(0, d.value), 0));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {data.map((d, i) => {
        const color = d.color || friendlyPalette[i % friendlyPalette.length];
        const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : "0.0";
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: color,
                boxShadow: `0 0 0 3px ${color}22`,
              }}
            />
            <span style={{ fontWeight: 600 }}>{d.label}</span>
            <span style={{ color: "#64748b", marginLeft: "auto" }}>
              {d.value.toFixed(2)} {showPercent ? ` • ${pct}%` : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* =========================
   DONUT (center label)
   ========================= */

export function Donut({
  parts,
  labels,
  colors,
  size = 140,
  strokeWidth = 16,
  centerLabel,
}: {
  parts: number[]; // e.g., [wins, losses, breakeven]
  labels?: string[]; // optional "W/L/BE"
  colors?: string[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
}) {
  const total = Math.max(1e-9, parts.reduce((a, b) => a + Math.max(0, b), 0));
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  let acc = 0;

  const palette = colors ?? ["#22c55e", "#ef4444", "#94a3b8"];

  return (
    <svg width={size} height={size} role="img" aria-label="Donut chart">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth} />
      {parts.map((v, i) => {
        const frac = Math.max(0, v) / total;
        const start = acc;
        const end = acc + frac;
        acc = end;

        const a0 = 2 * Math.PI * start - Math.PI / 2;
        const a1 = 2 * Math.PI * end - Math.PI / 2;
        const x0 = cx + r * Math.cos(a0);
        const y0 = cy + r * Math.sin(a0);
        const x1 = cx + r * Math.cos(a1);
        const y1 = cy + r * Math.sin(a1);
        const largeArc = end - start > 0.5 ? 1 : 0;

        return (
          <path
            key={i}
            d={`M ${x0} ${y0} A ${r} ${r} 0 ${largeArc} 1 ${x1} ${y1}`}
            stroke={palette[i % palette.length]}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
          />
        );
      })}
      {/* optional center label */}
      {centerLabel && (
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="middle"
          fontWeight={800}
          fontSize={14}
          fill={theme.color.text}
        >
          {centerLabel}
        </text>
      )}
      {/* optional outside labels (small) */}
      {labels && (
        <text
          x={cx}
          y={size - 4}
          textAnchor="middle"
          fontSize={11}
          fill="#64748b"
        >
          {labels.join("/")}
        </text>
      )}
    </svg>
  );
}

/* =========================
   SPARKLINE (line)
   ========================= */

export function Sparkline({
  series,
  width = 360,
  height = 84,
  stroke = theme.color.primary,
}: {
  series: number[];
  width?: number;
  height?: number;
  stroke?: string;
}) {
  if (!series?.length) return <svg width={width} height={height} />;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const pad = 6;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const n = series.length;

  const points = series
    .map((v, i) => {
      const x = pad + (i / Math.max(1, n - 1)) * w;
      const y = pad + (1 - (v - min) / Math.max(1e-9, (max - min) || 1)) * h;
      return `${x},${y}`;
    })
    .join(" ");

  const last = series[series.length - 1];
  const lastY = pad + (1 - (last - min) / Math.max(1e-9, (max - min) || 1)) * h;
  const dirColor = last >= series[0] ? "#22c55e" : "#ef4444";

  return (
    <svg width={width} height={height} role="img" aria-label="Sparkline">
      <polyline fill="none" stroke={stroke} strokeWidth={2} points={points} />
      <circle cx={width - pad} cy={lastY} r={3} fill={dirColor} />
    </svg>
  );
}

/* =========================
   HBAR (horizontal bars)
   ========================= */

export function HBar({
  items,
  max,
  width = 320,
  height = 20,
}: {
  items: { label: string; value: number; color?: string }[];
  max?: number;
  width?: number;
  height?: number; // per-row height
}) {
  const m = max ?? Math.max(...items.map((i) => Math.abs(i.value)), 1);
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {items.map((it, idx) => {
        const pct = Math.min(1, Math.abs(it.value) / Math.max(1e-9, m));
        const barW = Math.max(4, pct * width);
        const color = it.color ?? (it.value >= 0 ? "#22c55e" : "#ef4444");
        return (
          <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width,
                height,
                background: "#e5e7eb",
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              <div style={{ width: barW, height: "100%", background: color }} />
            </div>
            <div style={{ minWidth: 80, fontWeight: 700 }}>{it.label}</div>
            <div style={{ color: "#475569" }}>{it.value.toFixed(2)}</div>
          </div>
        );
      })}
    </div>
  );
}

/* =========================
   HISTOGRAM
   ========================= */

export function Histogram({
  values,
  bins = 10,
  width = 360,
  height = 120,
}: {
  values: number[];
  bins?: number;
  width?: number;
  height?: number;
}) {
  if (!values.length) return <svg width={width} height={height} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1e-9, max - min);
  const step = range / bins;

  const counts = new Array(bins).fill(0);
  for (const v of values) {
    const idx = Math.min(bins - 1, Math.floor((v - min) / step));
    counts[idx]++;
  }
  const maxCount = Math.max(...counts, 1);

  const pad = 8;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const barW = w / bins;

  return (
    <svg width={width} height={height} role="img" aria-label="Histogram">
      {counts.map((c, i) => {
        const barH = (c / maxCount) * h;
        const x = pad + i * barW;
        const y = pad + (h - barH);
        const color = i < bins / 2 ? "#ef4444" : "#22c55e"; // rough left/right split
        return (
          <rect
            key={i}
            x={x + 1}
            y={y}
            width={barW - 2}
            height={barH}
            fill={color}
            rx={4}
          />
        );
      })}
      <line x1={pad} y1={pad + h} x2={pad + w} y2={pad + h} stroke="#cbd5e1" strokeWidth={1} />
    </svg>
  );
}
