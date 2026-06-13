import { useId, useMemo, useState } from "react";
import { StatusPieChart } from "./charts/DashboardCharts.jsx";
import { REGISTRATION_RANGE_PRESETS } from "./RegistrationTrendAnalytics.jsx";

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function smoothPath(points, tension = 0.38) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0][0]} ${points[0][1]}`;
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? i : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) * tension;
    const c1y = p1[1] + (p2[1] - p0[1]) * tension;
    const c2x = p2[0] - (p3[0] - p1[0]) * tension;
    const c2y = p2[1] - (p3[1] - p1[1]) * tension;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}

function buildSeries(trend, startIdx, len) {
  const out = Array.from({ length: len }, () => ({ day: "", cnt: 0 }));
  for (let i = 0; i < len; i++) {
    const r = trend?.[startIdx + i];
    if (!r) continue;
    out[i] = { day: r.day, cnt: Number(r.cnt ?? 0) };
  }
  return out;
}

function formatDayLabel(day) {
  if (!day) return "";
  const d = new Date(day + "T12:00:00");
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
}

function formatRangeLabel(startDay, endDay) {
  if (!startDay || !endDay) return "";
  return `${formatDayLabel(startDay)} – ${formatDayLabel(endDay)}`;
}

function GenderBars({ bySex }) {
  const entries = (bySex || [])
    .map((r) => ({ label: String(r.sex || "Unknown"), cnt: Number(r.cnt || 0) }))
    .filter((r) => r.cnt > 0)
    .sort((a, b) => b.cnt - a.cnt);
  const total = entries.reduce((s, e) => s + e.cnt, 0);
  if (!total) {
    return <p className="sa-text-muted sa-text-sm" style={{ margin: 0 }}>No gender data yet.</p>;
  }
  const tone = (label) => {
    const l = label.toLowerCase();
    if (l.startsWith("f")) return "female";
    if (l.startsWith("m")) return "male";
    return "other";
  };
  return (
    <div className="sa-subunit-gender-bars">
      {entries.map((e) => {
        const pct = Math.round((e.cnt / total) * 100);
        return (
          <div className="sa-subunit-gbar" key={e.label}>
            <div className="sa-subunit-gbar-head">
              <span className="sa-subunit-gbar-label">{e.label}</span>
              <span className="sa-subunit-gbar-meta">
                {e.cnt} <span className="sa-subunit-gbar-pct">({pct}%)</span>
              </span>
            </div>
            <div className="sa-subunit-gbar-track">
              <div
                className={`sa-subunit-gbar-fill sa-subunit-gbar-fill--${tone(e.label)}`}
                style={{ width: `${Math.max(pct, 4)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function SubUnitLeaderAnalytics({
  trend,
  totals,
  bySex,
  scope,
  rangeDays,
  onRangeDays,
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [hoverIdx, setHoverIdx] = useState(null);

  const computed = useMemo(() => {
    const t = trend || [];
    const total = t.length;
    const curStart = Math.max(0, total - rangeDays);
    const curSeries = buildSeries(t, curStart, rangeDays);
    const curSum = curSeries.reduce((s, x) => s + (Number(x.cnt) || 0), 0);
    const peak = curSeries.reduce((best, x, i) => (x.cnt > (best?.cnt ?? -1) ? { ...x, i } : best), null);
    const weekSeries = buildSeries(t, Math.max(0, total - 7), 7);
    return { curSeries, curSum, peak, weekSeries, n: Math.max(rangeDays, 1) };
  }, [trend, rangeDays]);

  const { curSeries, curSum, peak, weekSeries, n } = computed;
  const rangeLabel = formatRangeLabel(curSeries[0]?.day, curSeries[n - 1]?.day);
  const weekMax = Math.max(1, ...weekSeries.map((r) => r.cnt));

  const w = 640;
  const h = 200;
  const padL = 8;
  const padR = 8;
  const padT = 12;
  const padB = 28;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const baseY = padT + plotH;

  const maxV = Math.max(1, ...curSeries.map((r) => Number(r.cnt || 0)));
  const yAt = (v) => padT + plotH - (v / maxV) * plotH;
  const xAt = (i) => padL + (i / Math.max(n - 1, 1)) * plotW;

  const pts = curSeries.map((r, i) => [xAt(i), yAt(Number(r.cnt || 0))]);
  const linePath = pts.length ? smoothPath(pts) : "";
  const areaPath = linePath ? `${linePath} L ${xAt(n - 1)} ${baseY} L ${xAt(0)} ${baseY} Z` : "";

  const hi = hoverIdx ?? peak?.i ?? null;
  const hiPoint = hi !== null ? curSeries[hi] : null;

  const dist = totals?.status_distribution || {};

  return (
    <div className="sa-subunit-dash">
      <div className="sa-subunit-dash-grid">
        <div className="sa-analytics-dark sa-analytics-dark--premium sa-subunit-chart-panel">
          <div className="sa-analytics-dark-head sa-subunit-chart-head">
            <div>
              <span className="sa-analytics-eyebrow">Sub-unit pulse</span>
              <h3 className="sa-analytics-dark-title">Registration activity</h3>
              <p className="sa-analytics-scope">{scope || "Your sub-unit"}</p>
            </div>
            <div className="sa-subunit-kpi-strip">
              <div className="sa-subunit-kpi">
                <span className="sa-subunit-kpi-label">Today</span>
                <span className="sa-subunit-kpi-value">{totals?.new_today ?? 0}</span>
              </div>
              <div className="sa-subunit-kpi">
                <span className="sa-subunit-kpi-label">This week</span>
                <span className="sa-subunit-kpi-value">{totals?.this_week ?? 0}</span>
              </div>
              <div className="sa-subunit-kpi sa-subunit-kpi--accent">
                <span className="sa-subunit-kpi-label">{rangeDays}d total</span>
                <span className="sa-subunit-kpi-value">{curSum}</span>
              </div>
            </div>
          </div>

          <div className="sa-pill-row">
            {REGISTRATION_RANGE_PRESETS.map(({ days, label }) => (
              <button
                key={days}
                type="button"
                className={`sa-pill ${rangeDays === days ? "sa-pill-active" : ""}`}
                onClick={() => onRangeDays(days)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="sa-subunit-chart-meta">
            <span className="sa-subunit-chart-range">{rangeLabel}</span>
            {hiPoint ? (
              <span className="sa-subunit-chart-hover">
                <strong>{hiPoint.cnt}</strong> on {formatDayLabel(hiPoint.day)}
              </span>
            ) : null}
          </div>

          <div className="sa-analytics-chart-wrap sa-subunit-main-chart">
            <svg
              className="sa-analytics-svg"
              viewBox={`0 0 ${w} ${h}`}
              preserveAspectRatio="none"
              onMouseLeave={() => setHoverIdx(null)}
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width) * w;
                const idx = Math.round(((x - padL) / Math.max(plotW, 1)) * (n - 1));
                setHoverIdx(Math.min(n - 1, Math.max(0, idx)));
              }}
            >
              <defs>
                <linearGradient id={`${uid}-area`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.55" />
                  <stop offset="55%" stopColor="#818cf8" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
                </linearGradient>
                <linearGradient id={`${uid}-line`} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#a78bfa" />
                  <stop offset="50%" stopColor="#22d3ee" />
                  <stop offset="100%" stopColor="#34d399" />
                </linearGradient>
                <filter id={`${uid}-glow`} x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="2" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {[0.25, 0.5, 0.75, 1].map((frac) => {
                const y = padT + plotH * (1 - frac);
                return (
                  <line
                    key={frac}
                    x1={padL}
                    x2={w - padR}
                    y1={y}
                    y2={y}
                    className="sa-analytics-grid"
                  />
                );
              })}

              {areaPath ? (
                <path d={areaPath} fill={`url(#${uid}-area)`} className="sa-analytics-area" />
              ) : null}
              {linePath ? (
                <path
                  d={linePath}
                  fill="none"
                  stroke={`url(#${uid}-line)`}
                  className="sa-analytics-line sa-analytics-line--premium"
                  filter={`url(#${uid}-glow)`}
                />
              ) : null}

              {hi !== null ? (
                <g>
                  <line
                    x1={xAt(hi)}
                    x2={xAt(hi)}
                    y1={padT}
                    y2={baseY}
                    stroke="rgba(34, 211, 238, 0.35)"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                  />
                  <circle
                    cx={xAt(hi)}
                    cy={yAt(Number(curSeries[hi]?.cnt || 0))}
                    r="6"
                    fill="#22d3ee"
                    stroke="#0a0a0a"
                    strokeWidth="2"
                  />
                </g>
              ) : null}
            </svg>
          </div>

          <div className="sa-subunit-week-bars" aria-label="Last 7 days">
            <span className="sa-subunit-week-title">Last 7 days</span>
            <div className="sa-subunit-week-row">
              {weekSeries.map((r) => {
                const pct = (r.cnt / weekMax) * 100;
                const d = r.day ? new Date(r.day + "T12:00:00") : null;
                const dayLbl = d ? ["S", "M", "T", "W", "T", "F", "S"][d.getDay()] : "";
                return (
                  <div key={r.day || dayLbl} className="sa-subunit-week-col" title={`${formatDayLabel(r.day)}: ${r.cnt}`}>
                    <div className="sa-subunit-week-bar-wrap">
                      <div
                        className="sa-subunit-week-bar"
                        style={{ height: `${Math.max(pct, r.cnt > 0 ? 8 : 4)}%` }}
                      />
                    </div>
                    <span className="sa-subunit-week-count">{r.cnt || ""}</span>
                    <span className="sa-subunit-week-day">{dayLbl}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="sa-analytics-footer sa-subunit-chart-footer">
            <div className="sa-analytics-metric">
              <span className="sa-analytics-dot" />
              <span>
                <span className="sa-analytics-value">{totals?.pending ?? 0}</span>
                <span className="sa-analytics-metric-muted"> pending review</span>
              </span>
            </div>
            <div
              className={`sa-analytics-compare ${
                (totals?.approved ?? 0) >= (totals?.rejected ?? 0)
                  ? "sa-analytics-compare-up"
                  : "sa-analytics-compare-down"
              }`}
            >
              {totals?.approved ?? 0} approved · {totals?.rejected ?? 0} rejected
            </div>
          </div>
        </div>

        <div className="sa-subunit-side">
          <div className="sa-subunit-side-card">
            <div className="sa-subunit-side-head">
              <span className="sa-subunit-side-title">Pipeline</span>
              <span className="sa-subunit-side-sub">Status mix</span>
            </div>
            <StatusPieChart distribution={dist} compact />
          </div>
          <div className="sa-subunit-side-card">
            <div className="sa-subunit-side-head">
              <span className="sa-subunit-side-title">Members</span>
              <span className="sa-subunit-side-sub">Gender split</span>
            </div>
            <GenderBars bySex={bySex} />
          </div>
        </div>
      </div>
    </div>
  );
}
