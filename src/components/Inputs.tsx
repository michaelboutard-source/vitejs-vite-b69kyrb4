import type { ReactNode, CSSProperties } from "react";

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "#f8fafc", borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 12, color: "#64748b" }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700 }}>{value}</div>
    </div>
  );
}
export function Th({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <th className={className} style={{ textAlign: "left", padding: "10px 8px", fontWeight: 600, ...(style || {}) }}>
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
  style,
  colSpan,
}: {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  colSpan?: number;
}) {
  return (
    <td className={className} style={{ padding: "8px 8px", ...(style || {}) }} colSpan={colSpan}>
      {children}
    </td>
  );
}

export function InputSmall({
  label, type = "text", value, onChange, placeholder, style, multiline,
  error, errorText,
}: {
  label: string; type?: string; value: any; onChange: (v: string) => void;
  placeholder?: string; style?: React.CSSProperties; multiline?: boolean;
  error?: boolean; errorText?: string;
}) {
  const border = error ? "1px solid #ef4444" : "1px solid #cbd5e1";
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, boxSizing: "border-box", ...(style || {}) }}>
      <span style={{ fontSize: 12, color: error ? "#b91c1c" : "#64748b" }}>{label}</span>
      {multiline ? (
        <textarea
          value={value ?? ""}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          style={{ padding: 8, borderRadius: 10, border: border, resize: "vertical", width: "100%", boxSizing: "border-box" }}
        />
      ) : (
        <input
          type={type}
          value={value ?? ""}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          step={type === "number" ? "any" : undefined}
          inputMode={type === "number" ? "decimal" : undefined}
          style={{ padding: 8, borderRadius: 10, border: border, width: "100%", boxSizing: "border-box" }}
        />
      )}
      {error && !!errorText && (
        <small style={{ color: "#b91c1c", marginTop: -2 }}>{errorText}</small>
      )}
    </label>
  );
}

export function SelectSmall({
  label, value, onChange, options, style,
  error, errorText,
}: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
  style?: React.CSSProperties; error?: boolean; errorText?: string;
}) {
  const border = error ? "1px solid #ef4444" : "1px solid #cbd5e1";
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, boxSizing: "border-box", ...(style || {}) }}>
      <span style={{ fontSize: 12, color: error ? "#b91c1c" : "#64748b" }}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ padding: 8, borderRadius: 10, border: border, width: "100%", boxSizing: "border-box" }}
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      {error && !!errorText && (
        <small style={{ color: "#b91c1c", marginTop: -2 }}>{errorText}</small>
      )}
    </label>
  );
}
