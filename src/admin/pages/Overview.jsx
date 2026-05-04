import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useAdminAuth } from "../AdminContext.jsx";
import { leaderScopeLabel } from "../leaderScope.js";

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtDate(d) {
  const dt = new Date(d);
  return `${MONTHS_SHORT[dt.getMonth()]} ${dt.getDate()}, ${dt.getFullYear()}`;
}
function actionDot(action) {
  if (action.includes("login")) return "login";
  if (action.includes("logout")) return "logout";
  if (action.includes("create")) return "create";
  if (action.includes("update") || action.includes("queue.update")) return "update";
  if (action.includes("delete")) return "delete";
  return "default";
}

const RANGE_PRESETS = [
  { days: 7, label: "7D" },
  { days: 28, label: "28D" },
  { days: 90, label: "90D" },
  { days: 365, label: "365D" },
];

function SubUnitLeaderAnalytics({ trend, rangeDays, onRangeDays, scopeLabel }) {
  const slice = (trend || []).slice(-rangeDays);
  const maxCnt = Math.max(...slice.map((x) => +x.cnt), 1);
  const minCnt = Math.min(...slice.map((x) => +x.cnt), 0);
  const span = Math.max(maxCnt - minCnt, 1);
  const w = 340;
  const h = 160;
  const padL = 36;
  const padR = 12;
  const padT = 12;
  const padB = 28;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const n = slice.length || 1;
  const pts = slice.map((r, i) => {
    const x = padL + (i / Math.max(n - 1, 1)) * plotW;
    const v = +r.cnt;
    const y = padT + plotH - ((v - minCnt) / span) * plotH;
    return [x, y];
  });
  const lineD = pts.length
    ? `M ${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L ")}`
    : "";
  const curSum = slice.reduce((s, x) => s + +x.cnt, 0);
  const prevSlice = (trend || []).slice(-2 * rangeDays, -rangeDays);
  const prevSum = prevSlice.reduce((s, x) => s + +x.cnt, 0);
  const pct = prevSum === 0 ? (curSum > 0 ? 100 : 0) : Math.round(((curSum - prevSum) / prevSum) * 100);
  const pos = pct >= 0;
  const tickIdx = n <= 1 ? [0] : [0, Math.floor((n - 1) / 2), n - 1];
  const uniqTicks = [...new Set(tickIdx)];

  return (
    <div className="sa-analytics-dark">
      <div className="sa-analytics-dark-head">
        <span className="sa-analytics-dark-title">Registrations</span>
      </div>
      <div className="sa-pill-row">
        {RANGE_PRESETS.map(({ days, label }) => (
          <button key={days} type="button" className={`sa-pill ${rangeDays === days ? "sa-pill-active" : ""}`} onClick={() => onRangeDays(days)}>
            {label}
          </button>
        ))}
      </div>
      <div className="sa-analytics-chart-wrap">
        <svg className="sa-analytics-svg" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet">
          {[0, 0.33, 0.66, 1].map((t) => {
            const y = padT + t * plotH;
            return <line key={t} x1={padL} x2={w - padR} y1={y} y2={y} className="sa-analytics-grid" />;
          })}
          {lineD && <path d={lineD} className="sa-analytics-line" fill="none" />}
          {uniqTicks.map((ti) => {
            const r = slice[ti];
            if (!r?.day) return null;
            const d = new Date(r.day + "T12:00:00");
            const lbl = `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
            const x = padL + (ti / Math.max(n - 1, 1)) * plotW;
            return (
              <text key={ti} x={x} y={h - 6} textAnchor="middle" className="sa-analytics-axis-label">
                {lbl}
              </text>
            );
          })}
        </svg>
      </div>
      <div className="sa-analytics-footer">
        <div className="sa-analytics-metric">
          <span className="sa-analytics-dot" />
          <span>Registrations ({rangeDays} days)</span>
        </div>
        <span className="sa-analytics-value">{curSum}</span>
      </div>
      <div className={`sa-analytics-compare ${pos ? "sa-analytics-compare-up" : "sa-analytics-compare-down"}`}>
        {pos ? `${Math.abs(pct)}% more` : `${Math.abs(pct)}% fewer`} than previous {rangeDays} days
      </div>
    </div>
  );
}

export function Overview() {
  const { admin } = useAdminAuth();
  const isServiceLeader = admin?.role === "service_unit_leader";
  const isSubUnitLeader = admin?.role === "sub_unit_leader";
  const scope = leaderScopeLabel(admin);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rangeDays, setRangeDays] = useState(28);

  useEffect(() => {
    setLoading(true);
    const p = { viewer: admin };
    if (isSubUnitLeader) p.trend_days = 365;
    api.stats(p)
      .then(setData)
      .finally(() => setLoading(false));
  }, [admin, isSubUnitLeader]);

  if (loading) return <div className="sa-loading"><div className="sa-spinner" /><span>Loading…</span></div>;
  if (!data) return <div className="sa-empty"><div className="sa-empty-text">Failed to load stats.</div></div>;

  const { totals, by_unit, by_sex, trend, recent_activity } = data;
  const maxUnit = Math.max(...by_unit.map((r) => +r.cnt), 1);
  const maxTrend = Math.max(...trend.map((r) => +r.cnt), 1);
  const sexMap = {};
  by_sex.forEach((r) => {
    sexMap[r.sex || "Unknown"] = +r.cnt;
  });

  const showBarTrendCharts = !isServiceLeader && !isSubUnitLeader;

  return (
    <>
      <div className="sa-stat-grid">
        <StatCard label="Total Registrations" value={totals.registrations} icon={<PeopleIcon />} iconClass="indigo" trend={`+${totals.this_week} this week`} />
        <StatCard label="Pending Review" value={totals.pending} icon={<ClockIcon />} iconClass="amber" />
        <StatCard label="Approved" value={totals.approved} icon={<CheckIcon />} iconClass="green" />
        <StatCard label="Active Units" value={totals.active_units} icon={<LayerIcon />} iconClass="blue" />
      </div>

      {isSubUnitLeader && (
        <div style={{ marginBottom: 24 }}>
          <SubUnitLeaderAnalytics trend={trend} rangeDays={rangeDays} onRangeDays={setRangeDays} scopeLabel={scope} />
        </div>
      )}

      {isServiceLeader && (
        <div className="sa-card" style={{ marginBottom: 24 }}>
          <div className="sa-card-head">
            <span className="sa-card-title">Gender breakdown</span>
          </div>
          <div className="sa-card-body">
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              {Object.entries(sexMap).map(([k, v]) => (
                <div key={k} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>{v}</div>
                  <div className="sa-text-sm sa-text-muted">{k}</div>
                </div>
              ))}
              {Object.keys(sexMap).length === 0 && <div className="sa-text-muted sa-text-sm">No data yet.</div>}
            </div>
          </div>
        </div>
      )}

      {showBarTrendCharts && (
        <div className="sa-chart-grid">
          <div className="sa-card">
            <div className="sa-card-head">
              <span className="sa-card-title">Registrations by Unit</span>
              <span className="sa-text-sm sa-text-muted">Top {by_unit.length}</span>
            </div>
            <div className="sa-card-body">
              <div className="sa-bar-chart">
                {by_unit.map((r) => (
                  <div className="sa-bar-row" key={r.unit_name}>
                    <div className="sa-bar-label">{r.unit_name}</div>
                    <div className="sa-bar-track">
                      <div className="sa-bar-fill" style={{ width: `${(+r.cnt / maxUnit) * 100}%` }} />
                    </div>
                    <div className="sa-bar-count">{r.cnt}</div>
                  </div>
                ))}
                {by_unit.length === 0 && <div className="sa-text-muted sa-text-sm">No data yet.</div>}
              </div>
            </div>
          </div>
          <div className="sa-card">
            <div className="sa-card-head">
              <span className="sa-card-title">14-Day Registration Trend</span>
            </div>
            <div className="sa-card-body">
              <div className="sa-trend-chart">
                {trend.map((r) => {
                  const pct = (+r.cnt / maxTrend) * 100;
                  const d = new Date(r.day + "T12:00:00");
                  const lbl = `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
                  return (
                    <div className="sa-trend-col" key={r.day} title={`${lbl}: ${r.cnt}`}>
                      <div className="sa-trend-bar" style={{ height: `${Math.max(4, pct)}px`, maxHeight: "80px" }} />
                      <div className="sa-trend-day">{lbl}</div>
                    </div>
                  );
                })}
                {trend.length === 0 && <div className="sa-text-muted sa-text-sm">No data yet.</div>}
              </div>
              <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--sa-border)" }}>
                <div className="sa-text-sm sa-fw-600" style={{ marginBottom: 10 }}>
                  Gender Breakdown
                </div>
                <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                  {Object.entries(sexMap).map(([k, v]) => (
                    <div key={k} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 22, fontWeight: 800 }}>{v}</div>
                      <div className="sa-text-sm sa-text-muted">{k}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="sa-card" style={{ marginBottom: 24 }}>
        <div className="sa-card-head">
          <span className="sa-card-title">Status Summary</span>
        </div>
        <div className="sa-card-body">
          <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
            {[
              { label: "Pending", val: totals.pending, cls: "pending" },
              { label: "Approved", val: totals.approved, cls: "approved" },
              { label: "Rejected", val: totals.rejected, cls: "rejected" },
              { label: "Waitlisted", val: totals.waitlisted, cls: "waitlisted" },
            ].map(({ label, val, cls }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className={`sa-badge ${cls}`}>{label}</span>
                <span style={{ fontSize: 20, fontWeight: 700 }}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="sa-card">
        <div className="sa-card-head">
          <span className="sa-card-title">Recent Activity</span>
        </div>
        <div className="sa-card-body" style={{ padding: "8px 22px" }}>
          <ul className="sa-activity-list">
            {recent_activity.length === 0 && (
              <li className="sa-empty">
                <div className="sa-empty-text">No activity yet.</div>
              </li>
            )}
            {recent_activity.map((a) => (
              <li key={a.id} className="sa-activity-item">
                <div className={`sa-activity-dot ${actionDot(a.action)}`}>
                  {actionDot(a.action) === "login" && "→"}
                  {actionDot(a.action) === "logout" && "←"}
                  {actionDot(a.action) === "create" && "+"}
                  {actionDot(a.action) === "update" && "✎"}
                  {actionDot(a.action) === "delete" && "✕"}
                  {actionDot(a.action) === "default" && "·"}
                </div>
                <div className="sa-activity-info">
                  <div className="sa-activity-desc">{a.description || a.action}</div>
                  <div className="sa-activity-meta">
                    {a.admin_name} · {fmtDate(a.created_at)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}

function StatCard({ label, value, icon, iconClass, trend }) {
  return (
    <div className="sa-stat-card">
      <div className="sa-stat-header">
        <span className="sa-stat-label">{label}</span>
        <div className={`sa-stat-icon ${iconClass}`}>{icon}</div>
      </div>
      <div className="sa-stat-value">{value ?? "—"}</div>
      {trend && (
        <div className="sa-stat-trend">
          <strong>{trend}</strong>
        </div>
      )}
    </div>
  );
}
function PeopleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function LayerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}
