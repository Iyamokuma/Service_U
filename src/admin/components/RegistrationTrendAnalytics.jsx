import { useMemo, useState } from "react";
import { TrendHistogram } from "./charts/DashboardCharts.jsx";

export const REGISTRATION_RANGE_PRESETS = [
  { days: 7, label: "7D" },
  { days: 28, label: "28D" },
  { days: 90, label: "90D" },
  { days: 365, label: "1Y" },
];

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatRangeLabel(startDay, endDay) {
  if (!startDay || !endDay) return "";
  const a = new Date(startDay + "T12:00:00");
  const b = new Date(endDay + "T12:00:00");
  return `${MONTHS_SHORT[a.getMonth()]} ${a.getDate()} \u2013 ${MONTHS_SHORT[b.getMonth()]} ${b.getDate()}`;
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

export function RegistrationTrendAnalytics({ trend, rangeDays, onRangeDays, title = "Visitor statistics", subtitle }) {
  const computed = useMemo(() => {
    const t = trend || [];
    const total = t.length;
    const curStart = Math.max(0, total - rangeDays);
    const prevStart = Math.max(0, total - 2 * rangeDays);
    const curSeries = buildSeries(t, curStart, rangeDays);
    const prevSeries = buildSeries(t, prevStart, rangeDays);
    const curSum = curSeries.reduce((s, x) => s + (Number(x.cnt) || 0), 0);
    const prevSum = prevSeries.reduce((s, x) => s + (Number(x.cnt) || 0), 0);
    const pct = prevSum === 0 ? (curSum > 0 ? 100 : 0) : Math.round(((curSum - prevSum) / prevSum) * 100);
    const pos = pct >= 0;
    return { curSeries, curSum, prevSum, pct, pos };
  }, [trend, rangeDays]);

  const { curSeries, curSum, prevSum, pct, pos } = computed;
  const rangeLabel = formatRangeLabel(curSeries[0]?.day, curSeries[curSeries.length - 1]?.day);
  const leftLegendLabel = rangeDays >= 365 ? "LAST 12 MONTHS" : `LAST ${rangeDays} DAYS`;
  const toCompact = (num) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Number(num || 0));

  return (
    <div className="sa-line-card">
      <div className="sa-line-head">
        <div className="sa-line-left">
          <div className="sa-line-title">{title}</div>
          <div className="sa-line-sub">{rangeLabel || subtitle || ""}</div>
        </div>
        <div className="sa-line-legend">
          <div className="sa-line-legend-item">
            <span className="sa-line-dot sa-line-dot--blue" aria-hidden />
            <span className="sa-line-legend-label">{leftLegendLabel}</span>
            <span className="sa-line-legend-value">{toCompact(curSum)}</span>
          </div>
          <div className="sa-line-legend-item">
            <span className="sa-line-dot sa-line-dot--green" aria-hidden />
            <span className="sa-line-legend-label">PREVIOUS</span>
            <span className="sa-line-legend-value">{toCompact(prevSum)}</span>
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

      <TrendHistogram data={curSeries} height={280} />

      <div className={`sa-line-footer ${pos ? "is-up" : "is-down"}`}>
        <span className="sa-line-footer-arrow">{pos ? "▲" : "▼"}</span>
        <span className="sa-line-footer-text">
          {pos ? `${Math.abs(pct)}% more` : `${Math.abs(pct)}% fewer`}
        </span>
        <span className="sa-line-footer-muted">vs previous period</span>
      </div>
    </div>
  );
}
