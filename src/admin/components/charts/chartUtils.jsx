/** Shared Recharts tooltip styling for admin dashboards. */
export function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="sa-chart-tooltip">
      {label ? <div className="sa-chart-tooltip-label">{label}</div> : null}
      {payload.map((entry) => (
        <div key={entry.name || entry.dataKey} className="sa-chart-tooltip-row">
          <span className="sa-chart-tooltip-dot" style={{ background: entry.color || entry.fill }} />
          <span>{entry.name || entry.dataKey}</span>
          <strong>{entry.value}</strong>
        </div>
      ))}
    </div>
  );
}

export const CHART_COLORS = {
  blue: "#2563eb",
  green: "#16a34a",
  amber: "#d97706",
  red: "#dc2626",
  slate: "#64748b",
  violet: "#7c3aed",
  new: "#3b82f6",
  progress: "#8b5cf6",
  overdue: "#f59e0b",
  accepted: "#22c55e",
  rejected: "#ef4444",
};
