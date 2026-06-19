import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "../AdminContext.jsx";
import { api } from "../api.js";
import { leaderScopeLabel } from "../leaderScope.js";
import { SmhLoader } from "../../components/SmhLoader.jsx";

export function RoleDashboard({ setPage }) {
  const { admin } = useAdminAuth();

  if (admin?.role === "data_entry_admin") {
    return (
      <div className="sa-card sa-data-entry-home">
        <div className="sa-card-head">
          <span className="sa-card-title">Data entry</span>
        </div>
        <div className="sa-card-body">
          <div className="sa-de-hero">
            <p className="sa-text-muted sa-text-sm" style={{ lineHeight: 1.6, margin: 0 }}>
              Populate the system with new church locations. Geography comes from the public directory (continent
              through LGA). You type satellite church names. Each proposal is reviewed by a Super Admin or General Admin
              before sites go live.
            </p>
            <div className="sa-de-actions">
              <button type="button" className="sa-btn sa-btn-primary" onClick={() => setPage?.("data-locations")}>
                Propose new location
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (admin?.role === "satellite_church_admin") {
    return <SatellitePastorDashboard setPage={setPage} admin={admin} />;
  }

  return (
    <div className="sa-card">
      <div className="sa-card-head">
        <span className="sa-card-title">Dashboard</span>
      </div>
      <div className="sa-card-body">
        <p className="sa-text-muted sa-text-sm" style={{ maxWidth: 560, lineHeight: 1.55 }}>
          Content for this role will be added here.
        </p>
      </div>
    </div>
  );
}

function SatellitePastorDashboard({ setPage, admin }) {
  const scope = leaderScopeLabel(admin);
  const [stats, setStats] = useState(null);
  const [adminCount, setAdminCount] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.stats({ viewer: admin, trend_days: 365 }).catch(() => null),
      api.admins().then((r) => r?.data || []).catch(() => []),
    ]).then(([s, admins]) => {
      setStats(s);
      const myTeam = admins.filter((a) => {
        const sameCountry = String(a.branch_country || "").toUpperCase() === String(admin.branch_country || "").toUpperCase();
        const sameState = String(a.branch_state || "").toUpperCase() === String(admin.branch_state || "").toUpperCase();
        const sameSat = String(a.satellite_site || "").trim() === String(admin.satellite_site || "").trim();
        return sameCountry && sameState && sameSat &&
          (a.role === "service_unit_leader" || a.role === "sub_unit_leader") &&
          Number(a.is_active) === 1;
      });
      setAdminCount(myTeam.length);
    }).finally(() => setLoading(false));
  }, [admin]);

  useEffect(() => { load(); }, [load]);

  const totals = stats?.totals || {};
  const overdueCount = totals.overdue_count ?? 0;
  const overdueState = overdueCount === 0 ? "zero" : totals.overdue_critical ? "critical" : "amber";

  return (
    <>
      {scope && (
        <p className="sa-text-muted sa-text-sm" style={{ margin: "0 0 16px" }}>
          {scope}
        </p>
      )}

      {loading ? (
        <SmhLoader label="Loading dashboard" />
      ) : (
        <>
          <div className="sa-stat-grid">
            <DashCard
              label="Total Registrations"
              value={totals.registrations ?? 0}
              sub={`+${totals.this_week ?? 0} this week`}
              onClick={() => setPage?.("oversight")}
            />
            <DashCard
              label="Pending Review"
              value={totals.pending ?? 0}
              onClick={() => setPage?.("oversight")}
            />
            <DashCard
              label="Approved"
              value={totals.approved ?? 0}
            />
            <DashCard
              label="Overdue"
              value={overdueCount}
              overdueState={overdueState}
              sub={overdueCount === 0 ? "On track" : "Needs attention"}
              onClick={() => setPage?.("oversight")}
            />
            <DashCard
              label="Team leaders"
              value={adminCount ?? 0}
              sub="Service & sub-unit leaders"
              onClick={() => setPage?.("users")}
            />
          </div>

          <div className="sa-card" style={{ marginTop: 20 }}>
            <div className="sa-card-head">
              <span className="sa-card-title">Quick actions</span>
            </div>
            <div className="sa-card-body">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                <button type="button" className="sa-btn sa-btn-primary" onClick={() => setPage?.("oversight")}>
                  Application Queue
                </button>
                <button type="button" className="sa-btn sa-btn-outline" onClick={() => setPage?.("users")}>
                  Members
                </button>
                <button type="button" className="sa-btn sa-btn-outline" onClick={() => setPage?.("announcements")}>
                  Announcements
                </button>
                <button type="button" className="sa-btn sa-btn-outline" onClick={() => setPage?.("requests")}>
                  My Requests
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function DashCard({ label, value, sub, onClick, overdueState }) {
  const overdueCls =
    overdueState === "zero"
      ? " sa-stat-card--overdue-zero"
      : overdueState === "critical"
        ? " sa-stat-card--overdue-critical"
        : overdueState === "amber"
          ? " sa-stat-card--overdue-amber"
          : "";
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      className={`sa-stat-card${overdueCls}`}
      onClick={onClick}
      type={onClick ? "button" : undefined}
      style={onClick ? { cursor: "pointer", textAlign: "left", border: "1px solid var(--sa-border)" } : undefined}
    >
      <div className="sa-stat-header">
        <span className="sa-stat-label">{label}</span>
      </div>
      <div className={`sa-stat-value${overdueState === "zero" ? " sa-stat-value--overdue-ok" : ""}`}>
        {overdueState === "zero" ? <span className="sa-overdue-check" aria-hidden>&#10003;</span> : null}
        {overdueState === "zero" ? 0 : (value ?? "\u2014")}
      </div>
      {sub ? <div className="sa-stat-trend">{sub}</div> : null}
    </Tag>
  );
}
