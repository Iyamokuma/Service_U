import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { useAdminAuth } from "../AdminContext.jsx";
import { leaderScopeLabel } from "../leaderScope.js";
import { isGlobalAdminRole } from "../roles.js";
import { isActingAsStateAdmin } from "../adminViewMode.js";
import { branchStateLabel, branchCountryLabel } from "../branchRegions.js";
import { RegistrationTrendAnalytics } from "../components/RegistrationTrendAnalytics.jsx";
import { SubUnitLeaderAnalytics } from "../components/SubUnitLeaderAnalytics.jsx";
import { StatusDonut } from "../components/StatusDonut.jsx";
import { BRANCH_COUNTRIES, branchStatesForCountry } from "../branchRegions.js";

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

function SuperAdminOverview({ units, setPage, navigateToQueue, admin }) {
  const goOverdueQueue = () => (navigateToQueue ? navigateToQueue("overdue") : setPage?.("queue"));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rangeDays, setRangeDays] = useState(28);
  const [country, setCountry] = useState("");
  const [state, setState] = useState("");
  const [branch, setBranch] = useState("");
  const [unitId, setUnitId] = useState("");
  const [subUnit, setSubUnit] = useState("");
  const [status, setStatus] = useState("all");
  const [sex, setSex] = useState("");
  const [submittedDate, setSubmittedDate] = useState("");

  const unitOpts = units?.data ?? [];
  const stateOpts = country ? branchStatesForCountry(country) : [];
  const selectedUnit = unitOpts.find((u) => String(u.id) === String(unitId));
  const subOpts = selectedUnit?.sub_units ?? [];

  const filterParams = useMemo(
    () => ({
      filter_country: country || undefined,
      filter_state: state || undefined,
      filter_branch: branch || undefined,
      filter_unit_id: unitId || undefined,
      filter_sub_unit: subUnit || undefined,
      filter_status: status === "all" ? undefined : status,
      filter_sex: sex || undefined,
      filter_from: submittedDate || undefined,
    }),
    [country, state, branch, unitId, subUnit, status, sex, submittedDate]
  );

  const load = useCallback(() => {
    setLoading(true);
    api
      .stats({ viewer: admin, trend_days: 365, ...filterParams })
      .then(setData)
      .finally(() => setLoading(false));
  }, [admin, filterParams]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const opts = data?.branch_options ?? [];
    if (branch && opts.length > 0 && !opts.includes(branch)) setBranch("");
  }, [branch, data]);

  const clearFilters = () => {
    setCountry("");
    setState("");
    setBranch("");
    setUnitId("");
    setSubUnit("");
    setStatus("all");
    setSex("");
    setFrom("");
    setTo("");
  };

  if (loading && !data) {
    return (
      <div className="sa-loading">
        <div className="sa-spinner" />
        <span>Loading…</span>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="sa-empty">
        <div className="sa-empty-text">Failed to load stats.</div>
      </div>
    );
  }

  const { totals, by_unit, by_sex, trend, recent_activity } = data;
  const maxUnit = Math.max(...by_unit.map((r) => +r.cnt), 1);
  const sexMap = {};
  by_sex.forEach((r) => {
    sexMap[r.sex || "Unknown"] = +r.cnt;
  });

  const accDelta = (totals.accepted_this_month ?? 0) - (totals.accepted_prev_month ?? 0);
  const rejDelta = (totals.rejected_this_month ?? 0) - (totals.rejected_prev_month ?? 0);
  const thDays = totals.overdue_threshold_days ?? Math.max(1, Math.round((totals.overdue_threshold_hours ?? 72) / 24));
  const overdueCardState =
    (totals.overdue_count ?? 0) === 0 ? "zero" : totals.overdue_critical ? "critical" : "amber";

  const branchOpts = data.branch_options ?? [];

  return (
    <div className="sa-super-overview">
      <div className="sa-dash-filters" role="toolbar" aria-label="Dashboard filters">
        <div className="sa-dash-filter-slot">
          <select
            id="dash-filter-country"
            className="sa-select sa-dash-filter-compact"
            title={country ? (BRANCH_COUNTRIES.find((c) => c.code === country)?.name || "") : ""}
            value={country}
            onChange={(e) => {
              setCountry(e.target.value);
              setState("");
              setBranch("");
            }}
          >
            <option value="">Country</option>
            {BRANCH_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="sa-dash-filter-slot">
          <select
            id="dash-filter-state"
            className="sa-select sa-dash-filter-compact"
            title={state ? (stateOpts.find((s) => s.code === state)?.name || "") : ""}
            value={state}
            disabled={!country}
            onChange={(e) => {
              setState(e.target.value);
              setBranch("");
            }}
          >
            <option value="">State</option>
            {stateOpts.map((s) => (
              <option key={s.code} value={s.code}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="sa-dash-filter-slot">
          <select
            id="dash-filter-branch"
            className="sa-select sa-dash-filter-compact"
            title={branch || ""}
            value={branch}
            disabled={!country}
            onChange={(e) => setBranch(e.target.value)}
          >
            <option value="">Branch</option>
            {branchOpts.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
        <div className="sa-dash-filter-slot">
          <select
            id="dash-filter-unit"
            className="sa-select sa-dash-filter-compact"
            title={unitId ? (unitOpts.find((u) => String(u.id) === String(unitId))?.name || "") : ""}
            value={unitId}
            onChange={(e) => {
              setUnitId(e.target.value);
              setSubUnit("");
            }}
          >
            <option value="">Unit</option>
            {unitOpts.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
        <div className="sa-dash-filter-slot">
          <select
            id="dash-filter-sub"
            className="sa-select sa-dash-filter-compact"
            title={subUnit || ""}
            value={subUnit}
            disabled={!unitId || subOpts.length === 0}
            onChange={(e) => setSubUnit(e.target.value)}
          >
            <option value="">Sub-unit</option>
            {subOpts.map((s) => (
              <option key={s.id} value={s.name}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="sa-dash-filter-slot">
          <select id="dash-filter-status" className="sa-select sa-dash-filter-compact" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">Status</option>
            <option value="active">Active</option>
            <option value="new">New</option>
            <option value="in_progress">In progress</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <div className={`sa-dash-filter-slot sa-dash-filter-slot--date${submittedDate ? " has-value" : ""}`}>
          <span className="sa-dash-filter-date-label" aria-hidden="true">
            Date
          </span>
          <input
            id="dash-filter-date"
            className="sa-input sa-dash-filter-compact"
            type="date"
            aria-label="Date"
            value={submittedDate}
            onChange={(e) => setSubmittedDate(e.target.value)}
          />
        </div>
        <div className="sa-dash-filter-slot">
          <select id="dash-filter-sex" className="sa-select sa-dash-filter-compact" value={sex} onChange={(e) => setSex(e.target.value)}>
            <option value="">Sex</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </div>
        <button type="button" className="sa-btn sa-btn-outline sa-btn-sm sa-dash-filter-reset" onClick={clearFilters}>
          Clear
        </button>
      </div>

      {totals.overdue_count > 0 && (
        <div className="sa-dash-alert">
          <span className="sa-dash-alert-icon" aria-hidden>⚠</span>
          <div className="sa-dash-alert-text">
            <strong>{totals.overdue_count}</strong> overdue application{totals.overdue_count !== 1 ? "s" : ""} across visible scope
            {filterParams.filter_country || filterParams.filter_unit_id ? "" : " — action required"} (threshold: {thDays} day{thDays !== 1 ? "s" : ""} in Settings).
          </div>
          <button type="button" className="sa-btn sa-btn-sm sa-dash-alert-btn" onClick={goOverdueQueue}>
            View queue
          </button>
        </div>
      )}

      <div className="sa-dash-stat-grid">
        <DashStatCard
          label="Total applications"
          value={totals.registrations}
          sub={`${totals.this_week} submitted this week`}
        />
        <DashStatCard
          label="New — unreviewed"
          value={totals.new_unreviewed ?? totals.pending}
          sub={`${totals.new_today ?? 0} submitted today`}
        />
        <DashStatCard
          label="In progress"
          value={totals.in_progress_count ?? totals.waitlisted}
          sub={totals.avg_days_in_progress ? `Avg. ${totals.avg_days_in_progress} days open` : "Awaiting action"}
        />
        <DashStatCard
          label="Overdue"
          value={totals.overdue_count}
          sub={overdueCardState === "zero" ? "On track" : overdueCardState === "critical" ? "Needs urgent action" : "Requires attention"}
          overdueState={overdueCardState}
        />
        <DashStatCard
          label="Accepted this month"
          value={totals.accepted_this_month ?? 0}
          sub={accDelta >= 0 ? `+${accDelta} vs last month` : `${accDelta} vs last month`}
        />
        <DashStatCard
          label="Rejected this month"
          value={totals.rejected_this_month ?? 0}
          sub={rejDelta === 0 ? "Stable" : `${rejDelta >= 0 ? "+" : ""}${rejDelta} vs last month`}
        />
        <DashStatCard
          label="Active members"
          value={totals.active_members ?? totals.approved}
          sub={`Across ${totals.parent_units ?? totals.active_units} units`}
        />
        <DashStatCard
          label="Service units"
          value={`${totals.parent_units ?? 0} / ${totals.sub_units_count ?? 0}`}
          sub={`${totals.parent_units ?? 0} parent · ${totals.sub_units_count ?? 0} sub`}
        />
      </div>

      <div className="sa-dash-panels">
        <div className="sa-card sa-dash-panel">
          <div className="sa-card-head">
            <span className="sa-card-title">Applications by service unit</span>
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
              {by_unit.length === 0 && <div className="sa-text-muted sa-text-sm">No data for filters.</div>}
            </div>
          </div>
        </div>

        <div className="sa-card sa-dash-panel">
          <div className="sa-card-head">
            <span className="sa-card-title">Status distribution</span>
          </div>
          <div className="sa-card-body sa-dash-donut-body">
            <StatusDonut distribution={totals.status_distribution || {}} />
            <div className="sa-dash-overdue-list-wrap">
              <div className="sa-dash-overdue-title">Top overdue (sub-units)</div>
              <ul className="sa-dash-overdue-list">
                {(totals.top_overdue_units || []).length === 0 ? (
                  <li className="sa-text-muted sa-text-sm">None for current filters.</li>
                ) : (
                  (totals.top_overdue_units || []).map((row) => (
                    <li key={row.label}>
                      <span className="sa-dash-overdue-label">{row.label}</span>
                      <span className="sa-dash-overdue-count">{row.count} overdue</span>
                      <button type="button" className="sa-dash-overdue-link" onClick={goOverdueQueue}>
                        View →
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="sa-chart-grid sa-chart-grid--dashboard" style={{ marginTop: 20 }}>
        <RegistrationTrendAnalytics
          trend={trend}
          rangeDays={rangeDays}
          onRangeDays={setRangeDays}
          title="Registration pulse"
          subtitle="Filtered scope · all branches"
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

      <div className="sa-card sa-card--section" style={{ marginTop: 20 }}>
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
    </div>
  );
}

function DashStatCard({ label, value, sub, highlight, overdueState }) {
  const overdueClass =
    overdueState === "zero" ? " is-overdue-zero" : overdueState === "critical" ? " is-overdue-critical" : overdueState === "amber" ? " is-overdue-amber" : "";
  return (
    <div className={`sa-dash-stat${highlight === "danger" ? " is-danger" : ""}${overdueClass}`}>
      <div className="sa-dash-stat-label">{label}</div>
      <div className="sa-dash-stat-value">
        {overdueState === "zero" ? (
          <span className="sa-dash-overdue-zero" aria-hidden>
            ✓
          </span>
        ) : null}
        {overdueState === "zero" ? 0 : (value ?? "—")}
      </div>
      {sub ? <div className="sa-dash-stat-sub">{sub}</div> : null}
    </div>
  );
}

export function Overview({ units, setPage, navigateToQueue }) {
  const { admin, viewMode } = useAdminAuth();
  const actingAsState = isActingAsStateAdmin(admin, viewMode);
  const isServiceLeader = admin?.role === "service_unit_leader";
  const isSubUnitLeader = admin?.role === "sub_unit_leader";
  const scope = leaderScopeLabel(admin, viewMode);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rangeDays, setRangeDays] = useState(28);

  useEffect(() => {
    if (!admin || isGlobalAdminRole(admin.role)) return;
    setLoading(true);
    api
      .stats({ viewer: admin, trend_days: 365 })
      .then(setData)
      .finally(() => setLoading(false));
  }, [admin, viewMode]);

  if (isGlobalAdminRole(admin?.role)) {
    return <SuperAdminOverview units={units} setPage={setPage} navigateToQueue={navigateToQueue} admin={admin} />;
  }

  if (loading) {
    return (
      <div className="sa-loading">
        <div className="sa-spinner" />
        <span>Loading…</span>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="sa-empty">
        <div className="sa-empty-text">Failed to load stats.</div>
      </div>
    );
  }

  const { totals, by_unit, by_sex, trend, recent_activity } = data;
  const maxUnit = Math.max(...by_unit.map((r) => +r.cnt), 1);
  const sexMap = {};
  by_sex.forEach((r) => {
    sexMap[r.sex || "Unknown"] = +r.cnt;
  });

  const showBarAndTrend = !isServiceLeader && !isSubUnitLeader;
  const trendSubtitle =
    actingAsState && admin?.branch_state
      ? `${branchStateLabel(admin.branch_country, admin.branch_state) || admin.branch_state} registrations`
      : scope && scope !== "—"
        ? scope
        : "Your visible registrations";
  const overdueVisual =
    (totals.overdue_count ?? 0) === 0
      ? { state: "zero", sub: "On track" }
      : totals.overdue_critical
        ? { state: "critical", sub: "Needs urgent action" }
        : { state: "amber", sub: "Requires attention" };

  return (
    <>
      <div className="sa-stat-grid">
        <StatCard label="Total Registrations" value={totals.registrations} icon={<PeopleIcon />} iconClass="indigo" trend={`+${totals.this_week} this week`} />
        <StatCard label="Pending Review" value={totals.pending} icon={<ClockIcon />} iconClass="amber" />
        <StatCard label="Approved" value={totals.approved} icon={<CheckIcon />} iconClass="green" />
        <StatCard
          label="Overdue"
          value={totals.overdue_count ?? 0}
          icon={<ClockIcon />}
          iconClass="amber"
          trend={overdueVisual.sub}
          overdueState={overdueVisual.state}
        />
        {!isServiceLeader && (
          <StatCard label="Active Units" value={totals.active_units} icon={<LayerIcon />} iconClass="blue" />
        )}
        {isServiceLeader && (
          <StatCard
            label="In Progress"
            value={totals.in_progress_count ?? totals.waitlisted}
            icon={<ClockIcon />}
            iconClass="amber"
            trend="Across all sub-units"
          />
        )}
      </div>

      {isSubUnitLeader && (
        <div className="sa-overview-analytics-block">
          <SubUnitLeaderAnalytics
            trend={trend}
            totals={totals}
            bySex={by_sex}
            scope={scope}
            rangeDays={rangeDays}
            onRangeDays={setRangeDays}
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

function StatCard({ label, value, icon, iconClass, trend, overdueState }) {
  const overdueCls =
    overdueState === "zero"
      ? " sa-stat-card--overdue-zero"
      : overdueState === "critical"
        ? " sa-stat-card--overdue-critical"
        : overdueState === "amber"
          ? " sa-stat-card--overdue-amber"
          : "";
  return (
    <div className={`sa-stat-card${overdueCls}`}>
      <div className="sa-stat-header">
        <span className="sa-stat-label">{label}</span>
        <div className={`sa-stat-icon ${iconClass}`}>{icon}</div>
      </div>
      <div className={`sa-stat-value${overdueState === "zero" ? " sa-stat-value--overdue-ok" : ""}`}>
        {overdueState === "zero" ? <span className="sa-overdue-check" aria-hidden>✓</span> : null}
        {overdueState === "zero" ? 0 : (value ?? "—")}
      </div>
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
