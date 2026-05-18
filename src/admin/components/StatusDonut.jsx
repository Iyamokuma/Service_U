/** Status breakdown ring for leader dashboards. */
export function StatusDonut({ distribution, compact }) {
  const entries = [
    { key: "new", label: "New", color: "var(--sa-donut-new)" },
    { key: "in_progress", label: "In progress", color: "var(--sa-donut-progress)" },
    { key: "overdue", label: "Overdue", color: "var(--sa-donut-overdue)" },
    { key: "accepted", label: "Accepted", color: "var(--sa-donut-accepted)" },
    { key: "rejected", label: "Rejected", color: "var(--sa-donut-rejected)" },
  ];
  const total = entries.reduce((s, e) => s + (distribution[e.key] || 0), 0);
  if (!total) {
    return <div className="sa-donut-empty sa-text-muted sa-text-sm">No registrations in scope yet.</div>;
  }
  const C = 100;
  let dashOffset = 0;
  const segs = entries
    .map((e) => {
      const v = distribution[e.key] || 0;
      if (!v) return null;
      const dash = (v / total) * C;
      const seg = { ...e, v, dash, off: dashOffset };
      dashOffset += dash;
      return seg;
    })
    .filter(Boolean);

  return (
    <div className={`sa-donut-row${compact ? " sa-donut-row--compact" : ""}`}>
      <svg className="sa-donut-svg" viewBox="0 0 36 36" aria-hidden>
        <circle r="15.9155" cx="18" cy="18" fill="none" stroke="rgba(148,163,184,0.15)" strokeWidth="3.6" />
        <g transform="rotate(-90 18 18)">
          {segs.map((s) => (
            <circle
              key={s.key}
              r="15.9155"
              cx="18"
              cy="18"
              fill="none"
              stroke={s.color}
              strokeWidth="3.6"
              strokeDasharray={`${s.dash} ${C - s.dash}`}
              strokeDashoffset={-s.off}
              strokeLinecap="round"
            />
          ))}
        </g>
        <text x="18" y="17.5" textAnchor="middle" className="sa-donut-center-num">
          {total}
        </text>
        <text x="18" y="22" textAnchor="middle" className="sa-donut-center-label">
          total
        </text>
      </svg>
      <ul className="sa-donut-legend">
        {entries.map((e) => (
          <li key={e.key}>
            <span className="sa-donut-dot" style={{ background: e.color }} />
            <span>{e.label}</span>
            <strong>{distribution[e.key] ?? 0}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
