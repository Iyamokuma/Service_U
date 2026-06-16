import { useMemo } from "react";
import { StatusPieChart } from "./charts/DashboardCharts.jsx";
import { TrendHistogram } from "./charts/DashboardCharts.jsx";
import { REGISTRATION_RANGE_PRESETS } from "./RegistrationTrendAnalytics.jsx";

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAY = ["S", "M", "T", "W", "T", "F", "S"];

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
  const computed = useMemo(() => {
    const t = trend || [];
    const total = t.length;
    const curStart = Math.max(0, total - rangeDays);
    const curSeries = buildSeries(t, curStart, rangeDays);
    const curSum = curSeries.reduce((s, x) => s + (Number(x.cnt) || 0), 0);
    const weekSeries = buildSeries(t, Math.max(0, total - 7), 7);
    return { curSeries, curSum, weekSeries, n: Math.max(rangeDays, 1) };
  }, [trend, rangeDays]);

  const { curSeries, curSum, weekSeries } = computed;
  const rangeLabel = formatRangeLabel(curSeries[0]?.day, curSeries[curSeries.length - 1]?.day);
  const weekMax = Math.max(1, ...weekSeries.map((r) => r.cnt));
  const dist = totals?.status_distribution || {};

  return (
    <div className="sa-subunit-dash">
      <div className="sa-subunit-dash-grid">
        <div className="sa-line-card sa-subunit-chart-panel">
          <div className="sa-line-head sa-subunit-chart-head">
            <div className="sa-line-left">
              <div className="sa-subunit-eyebrow">Sub-unit pulse</div>
              <div className="sa-line-title">Registration activity</div>
              <div className="sa-line-sub">{scope || "Your sub-unit"}</div>
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

          <div className="sa-line-pills">
            {REGISTRATION_RANGE_PRESETS.map(({ days, label }) => (
              <button
                key={days}
                type="button"
                className={`sa-line-pill ${rangeDays === days ? "is-active" : ""}`}
                onClick={() => onRangeDays(days)}
              >
                {label}
              </button>
            ))}
          </div>

          {rangeLabel ? (
            <p className="sa-subunit-chart-range">{rangeLabel}</p>
          ) : null}

          <TrendHistogram data={curSeries} height={240} />

          <div className="sa-subunit-week-bars" aria-label="Last 7 days">
            <span className="sa-subunit-week-title">Last 7 days</span>
            <div className="sa-subunit-week-row">
              {weekSeries.map((r) => {
                const pct = (r.cnt / weekMax) * 100;
                const d = r.day ? new Date(r.day + "T12:00:00") : null;
                const dayLbl = d ? WEEKDAY[d.getDay()] : "";
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

          <div className="sa-line-footer sa-subunit-chart-footer">
            <div className="sa-subunit-footer-metric">
              <span className="sa-subunit-footer-dot" aria-hidden />
              <span>
                <strong className="sa-subunit-footer-value">{totals?.pending ?? 0}</strong>
                <span className="sa-subunit-footer-muted"> pending review</span>
              </span>
            </div>
            <div
              className={`sa-subunit-footer-compare ${
                (totals?.approved ?? 0) >= (totals?.rejected ?? 0) ? "is-up" : "is-down"
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
