import { useId, useMemo, useState } from "react";

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const REGISTRATION_RANGE_PRESETS = [
  { days: 7, label: "7D" },
  { days: 28, label: "28D" },
  { days: 90, label: "90D" },
  { days: 365, label: "1Y" },
];

function smoothPath(points, tension = 0.35) {
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

function formatRangeLabel(startDay, endDay) {
  if (!startDay || !endDay) return "";
  const a = new Date(startDay + "T12:00:00");
  const b = new Date(endDay + "T12:00:00");
  const left = `${MONTHS_SHORT[a.getMonth()]} ${a.getDate()}`;
  const right = `${MONTHS_SHORT[b.getMonth()]} ${b.getDate()}`;
  return `${left} \u2013 ${right}`;
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
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [hoverIdx, setHoverIdx] = useState(null);

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
    return { curSeries, prevSeries, curSum, prevSum, pct, pos };
  }, [trend, rangeDays]);

  const { curSeries, prevSeries, curSum, prevSum, pct, pos } = computed;
  const n = Math.max(rangeDays, 1);

  const w = 720;
  const h = 260;
  const padL = 54;
  const padR = 16;
  const padT = 16;
  const padB = 44;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const baseY = padT + plotH;

  const maxV = Math.max(
    1,
    ...curSeries.map((r) => Number(r.cnt || 0)),
    ...prevSeries.map((r) => Number(r.cnt || 0))
  );

  const steps = 4;
  const rawStep = maxV / steps;
  const step = Math.max(1, Math.ceil(rawStep / 5) * 5);
  const tickVals = Array.from({ length: steps + 1 }, (_, i) => i * step);

  const tickMax = tickVals[tickVals.length - 1] || Math.max(maxV, 1);
  const yAt = (v) => padT + plotH - ((v - 0) / Math.max(tickMax, 1)) * plotH;
  const xAt = (i) => padL + (i / Math.max(n - 1, 1)) * plotW;

  const curPts = curSeries.map((r, i) => [xAt(i), yAt(Number(r.cnt || 0))]);
  const prevPts = prevSeries.map((r, i) => [xAt(i), yAt(Number(r.cnt || 0))]);
  const curPath = curPts.length ? smoothPath(curPts) : "";
  const prevPath = prevPts.length ? smoothPath(prevPts) : "";
  const curArea = curPath ? `${curPath} L ${xAt(n - 1)} ${baseY} L ${xAt(0)} ${baseY} Z` : "";
  const prevArea = prevPath ? `${prevPath} L ${xAt(n - 1)} ${baseY} L ${xAt(0)} ${baseY} Z` : "";

  const labelIdxs = (() => {
    if (n <= 8) return [...Array(n).keys()];
    const count = 7;
    return Array.from({ length: count }, (_, i) => Math.round((i / (count - 1)) * (n - 1)));
  })();

  const rangeLabel = formatRangeLabel(curSeries[0]?.day, curSeries[n - 1]?.day);

  const toCompact = (num) =>
    new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Number(num || 0));

  const leftLegendLabel = rangeDays >= 365 ? "LAST 6 MONTHS" : `LAST ${rangeDays} DAYS`;

  const highlight = hoverIdx !== null ? hoverIdx : null;

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

      <div className="sa-line-chart-wrap">
        <svg
          className="sa-line-chart"
          viewBox={`0 0 ${w} ${h}`}
          preserveAspectRatio="xMidYMid meet"
          onMouseLeave={() => setHoverIdx(null)}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const plotX = ((x / rect.width) * w - padL);
            const idx = Math.round((plotX / Math.max(plotW, 1)) * (n - 1));
            setHoverIdx(Math.min(n - 1, Math.max(0, idx)));
          }}
        >
          <rect x="0" y="0" width={w} height={h} fill="transparent" />

          {/* Horizontal grid + y labels */}
          {tickVals.map((v) => {
            const y = yAt(v);
            return (
              <g key={v}>
                <line x1={padL} x2={w - padR} y1={y} y2={y} className="sa-line-grid-h" />
                <text x={padL - 12} y={y + 4} textAnchor="end" className="sa-line-ylabel">
                  {v}
                </text>
              </g>
            );
          })}

          {/* Vertical dashed guides + x labels */}
          {labelIdxs.map((ti) => {
            const x = xAt(ti);
            const day = curSeries[ti]?.day;
            const d = day ? new Date(day + "T12:00:00") : null;
            const lbl = d ? d.toLocaleString(undefined, { month: "short" }) : "";
            return (
              <g key={`x-${ti}`}>
                <line x1={x} x2={x} y1={padT} y2={baseY} className="sa-line-grid-v" />
                {lbl ? (
                  <text x={x} y={h - 18} textAnchor="middle" className="sa-line-xlabel">
                    {lbl}
                  </text>
                ) : null}
              </g>
            );
          })}

          {/* Areas */}
          {prevArea ? <path d={prevArea} className="sa-line-area sa-line-area--green" /> : null}
          {curArea ? <path d={curArea} className="sa-line-area sa-line-area--blue" /> : null}

          {/* Lines */}
          {prevPath ? <path d={prevPath} className="sa-line-path sa-line-path--green" /> : null}
          {curPath ? <path d={curPath} className="sa-line-path sa-line-path--blue" /> : null}

          {/* Hover marker */}
          {highlight !== null ? (
            <g>
              <line x1={xAt(highlight)} x2={xAt(highlight)} y1={padT} y2={baseY} className="sa-line-hover-v" />
              <circle cx={xAt(highlight)} cy={yAt(Number(curSeries[highlight]?.cnt || 0))} r="4.5" className="sa-line-hover-dot sa-line-hover-dot--blue" />
              <circle cx={xAt(highlight)} cy={yAt(Number(prevSeries[highlight]?.cnt || 0))} r="4.5" className="sa-line-hover-dot sa-line-hover-dot--green" />
            </g>
          ) : null}
        </svg>
      </div>

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
