import { useCallback, useEffect, useState } from "react";
import { Sidebar } from "./components/Sidebar.jsx";
import { Overview } from "./pages/Overview.jsx";
import { Queue } from "./pages/Queue.jsx";
import { ServiceUnits } from "./pages/ServiceUnits.jsx";
import { AdminUsers } from "./pages/AdminUsers.jsx";
import { ActivityLog } from "./pages/ActivityLog.jsx";
import { UnitMembers } from "./pages/UnitMembers.jsx";
import { Requests } from "./pages/Requests.jsx";
import { Settings } from "./pages/Settings.jsx";
import { ProfileSettings } from "./pages/ProfileSettings.jsx";
import { api } from "./api.js";
import { useAdminAuth } from "./AdminContext.jsx";
import { leaderScopeLabel } from "./leaderScope.js";

const PAGE_TITLES = {
  overview: "Dashboard Overview",
  queue:    "Application Queue",
  units:    "Service Units",
  members:  "Unit Members",
  admins:   "Admin Accounts",
  requests: "Requests",
  activity: "Activity Log",
  settings: "Settings",
  profile: "Profile / Settings",
};

export function AdminLayout() {
  const { admin } = useAdminAuth();
  const isSuperAdmin = admin?.role === "super_admin";
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("sm_admin_theme") || "dark"; } catch { return "dark"; }
  });
  const [page, setPage]   = useState("overview");
  const [units, setUnits] = useState(null);
  const [admins, setAdmins] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);

  const loadUnits  = useCallback(() => api.units().then(setUnits).catch(() => {}), []);
  const loadAdmins = useCallback(() => api.admins().then(setAdmins).catch(() => {}), []);

  useEffect(() => {
    api.populateDemoData();
    loadUnits();
    loadAdmins();
  }, [loadUnits, loadAdmins]);

  // Fetch pending count for sidebar badge
  useEffect(() => {
    if (!admin) return;
    api.queue({ status: "pending", per_page: 1, viewer: admin })
      .then((r) => setPendingCount(r.pagination?.total ?? 0))
      .catch(() => {});
  }, [page, admin]);

  useEffect(() => {
    try { localStorage.setItem("sm_admin_theme", theme); } catch { /* ignore */ }
  }, [theme]);

  const now = new Date().toLocaleString("en-GB", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const leaderScope = leaderScopeLabel(admin);
  const showLeaderScope =
    leaderScope && (admin?.role === "service_unit_leader" || admin?.role === "sub_unit_leader");

  return (
    <div className="sa-root" data-theme={theme}>
      <Sidebar page={page} setPage={setPage} pendingCount={pendingCount} />

      <div className="sa-main">
        <div className="sa-topbar">
          <div className="sa-page-title-block">
            <div className="sa-page-title">{PAGE_TITLES[page]}</div>
            {showLeaderScope ? <div className="sa-page-scope">{leaderScope}</div> : null}
          </div>
          <div className="sa-topbar-right">
            <button
              type="button"
              className="sa-theme-toggle"
              onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? "Light" : "Dark"} mode
            </button>
            <span className="sa-topbar-time">{now}</span>
          </div>
        </div>

        <div className="sa-content">
          {page === "overview"  && <Overview />}
          {page === "queue"     && <Queue     units={units} />}
          {page === "units"     && <ServiceUnits data={units}  reload={() => { loadUnits(); loadAdmins(); }} />}
          {page === "members"   && <UnitMembers units={units} />}
          {page === "admins"    && <AdminUsers   data={admins} units={units} reload={loadAdmins} />}
          {page === "requests"  && <Requests />}
          {page === "activity"  && <ActivityLog />}
          {page === "settings"  && isSuperAdmin && <Settings />}
          {page === "profile"   && !isSuperAdmin && <ProfileSettings />}
        </div>
      </div>
    </div>
  );
}
