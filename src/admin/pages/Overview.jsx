import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useAdminAuth } from "../AdminContext.jsx";
import { leaderScopeLabel } from "../leaderScope.js";
import { RegistrationTrendAnalytics } from "../components/RegistrationTrendAnalytics.jsx";

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

function GenderBreakdown({ sexMap }) {
  const entries = Object.entries(sexMap);
  return (
    <div className="sa-gender-strip">
      {entries.map(([k, v]) => (
        <div key={k} className="sa-gender-item">
          <div className="sa-gender-value">{v}</div>
          <div className="sa-gender-label">{k}</div>
        </div>
      ))}
      {entries.length === 0 && <div className="sa-text-muted sa-text-sm">No data yet.</div>}
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
    api
      .stats({ viewer: admin, trend_days: 365 })
      .then(setData)
      .finally(() => setLoading(false));
  }, [admin]);

  if (loading) return <div className="sa-loading"><div className="sa-spinner" /><span>Loading…</span></div>;
  if (!data) return <div className="sa-empty"><div className="sa-empty-text">Failed to load stats.</div></div>;

  const { totals, by_unit, by_sex, trend, recent_activity } = data;
  const maxUnit = Math.max(...by_unit.map((r) => +r.cnt), 1);
  const sexMap = {};
  by_sex.forEach((r) => {
    sexMap[r.sex || "Unknown"] = +r.cnt;
  });

  const showBarAndTrend = !isServiceLeader && !isSubUnitLeader;
  const trendSubtitle = scope && scope !== "—" ? scope : "Your visible registrations";

  return (
    <>
      <div className="sa-stat-grid">
        <StatCard label="Total Registrations" value={totals.registrations} icon={<PeopleIcon />} iconClass="indigo" trend={`+${totals.this_week} this week`} />
        <StatCard label="Pending Review" value={totals.pending} icon={<ClockIcon />} iconClass="amber" />
        <StatCard label="Approved" value={totals.approved} icon={<CheckIcon />} iconClass="green" />
        <StatCard label="Active Units" value={totals.active_units} icon={<LayerIcon />} iconClass="blue" />
      </div>

      {isSubUnitLeader && (
        <div className="sa-overview-analytics-block">
          <RegistrationTrendAnalytics
            trend={trend}
            rangeDays={rangeDays}
            onRangeDays={setRangeDays}
            title="Registration pulse"
            subtitle={scope}
          />
        </div>
      )}

      {isServiceLeader && (
        <div className="sa-overview-split">
          <RegistrationTrendAnalytics
            trend={trend}
            rangeDays={rangeDays}
            onRangeDays={setRangeDays}
            title="Registration pulse"
            subtitle={scope}
          />
          <div className="sa-card sa-card--gender">
            <div className="sa-card-head">
              <span className="sa-card-title">Gender breakdown</span>
            </div>
            <div className="sa-card-body sa-card-body--gender">
              <GenderBreakdown sexMap={sexMap} />
            </div>
          </div>
        </div>
      )}

      {showBarAndTrend && (
        <>
          <div className="sa-chart-grid sa-chart-grid--dashboard">
            <div className="sa-card">
              <div className="sa-card-head">
                <span className="sa-card-title">Registrations by unit</span>
                <span className="sa-text-sm sa-text-muted">{by_unit.length} units</span>
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
            <RegistrationTrendAnalytics
              trend={trend}
              rangeDays={rangeDays}
              onRangeDays={setRangeDays}
              title="Registration pulse"
              subtitle={trendSubtitle}
            />
          </div>
          <div className="sa-card sa-card--gender-wide">
            <div className="sa-card-head">
              <span className="sa-card-title">Gender breakdown</span>
            </div>
            <div className="sa-card-body sa-card-body--gender-wide">
              <GenderBreakdown sexMap={sexMap} />
            </div>
          </div>
        </>
      )}

      <div className="sa-card sa-card--section">
        <div className="sa-card-head">
          <span className="sa-card-title">Status summary</span>
        </div>
        <div className="sa-card-body">
          <div className="sa-status-chips">
            {[
              { label: "Pending", val: totals.pending, cls: "pending" },
              { label: "Approved", val: totals.approved, cls: "approved" },
              { label: "Rejected", val: totals.rejected, cls: "rejected" },
              { label: "Waitlisted", val: totals.waitlisted, cls: "waitlisted" },
            ].map(({ label, val, cls }) => (
              <div key={label} className="sa-status-chip">
                <span className={`sa-badge ${cls}`}>{label}</span>
                <span className="sa-status-chip-value">{val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="sa-card sa-card--section">
        <div className="sa-card-head">
          <span className="sa-card-title">Recent activity</span>
        </div>
        <div className="sa-card-body sa-card-body--activity">
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
