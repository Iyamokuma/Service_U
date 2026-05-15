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
import { BranchOversight } from "./pages/BranchOversight.jsx";
import { RoleDashboard } from "./pages/RoleDashboard.jsx";
import { DataEntryLocationForm } from "./pages/DataEntryLocationForm.jsx";
import { SatelliteUnitRequest } from "./pages/SatelliteUnitRequest.jsx";
import { BranchCatalog } from "./pages/BranchCatalog.jsx";
import { Announcements } from "./pages/Announcements.jsx";
import { NotificationBell } from "./components/NotificationBell.jsx";
import { api } from "./api.js";
import { useAdminAuth } from "./AdminContext.jsx";
import { leaderScopeLabel } from "./leaderScope.js";
import { isGlobalAdminRole, canEditBranchCatalog, isServiceUnitLeader } from "./roles.js";

const PAGE_TITLES = {
  overview: "Overview",
  locations: "Locations",
  queue:    "Application Queue",
  units:    "Service Units",
  members:  "Unit Members",
  admins:   "Admin Accounts",
  requests: "Requests",
  activity: "Activity Log",
  settings: "Settings",
  profile: "Profile / Settings",
  oversight: "Branch registrations & filters",
  "role-dashboard": "Custom dashboard",
  announcements: "Announcements",
  "data-locations": "Propose church location",
  "branch-catalog": "Branch directory",
};

export function AdminLayout() {
  const { admin } = useAdminAuth();
  const canPlatformSettings = isGlobalAdminRole(admin?.role);
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("sm_admin_theme") || "light"; } catch { return "light"; }
  });
  const [page, setPage]   = useState("overview");
  const [units, setUnits] = useState(null);
  const [admins, setAdmins] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [openRequestCount, setOpenRequestCount] = useState(0);

  const loadUnits  = useCallback(() => api.units().then(setUnits).catch(() => {}), []);
  const loadAdmins = useCallback(() => api.admins().then(setAdmins).catch(() => {}), []);

  useEffect(() => {
    if (!admin) return;
    api.populateDemoData();
    loadUnits();
    loadAdmins();
  }, [admin, loadUnits, loadAdmins]);

  useEffect(() => {
    if (!admin) return;
    if (admin.role === "country_super_admin") {
      setPage((p) =>
        ["overview", "oversight", "members", "admins", "activity", "announcements", "profile"].includes(p)
          ? p
          : "overview",
      );
    } else if (admin.role === "state_super_admin") {
      setPage((p) => (["oversight", "announcements", "profile"].includes(p) ? p : "oversight"));
    } else if (admin.role === "satellite_church_admin") {
      setPage((p) =>
        [
          "role-dashboard",
          "oversight",
          "admins",
          "unit-request",
          "requests",
          "announcements",
          "profile",
        ].includes(p)
          ? p
          : "role-dashboard",
      );
    } else if (admin.role === "data_entry_admin") {
      setPage((p) =>
        [
          "role-dashboard",
          "data-locations",
          "branch-catalog",
          "overview",
          "queue",
          "members",
          "requests",
          "activity",
          "announcements",
          "profile",
        ].includes(p)
          ? p
          : "role-dashboard",
      );
    } else if (isServiceUnitLeader(admin.role)) {
      setPage((p) =>
        ["overview", "queue", "members", "admins", "announcements", "activity", "profile"].includes(p)
          ? p
          : "overview",
      );
    }
  }, [admin?.id, admin?.role]);

  // Fetch pending count for sidebar badge
  useEffect(() => {
    if (!admin) return;
    api.queue({ status: "new", per_page: 1, viewer: admin })
      .then((r) => setPendingCount(r.pagination?.total ?? 0))
      .catch(() => {});
  }, [page, admin]);

  useEffect(() => {
    if (!admin || !isGlobalAdminRole(admin.role)) {
      setOpenRequestCount(0);
      return;
    }
    api
      .requests({ status: "open", per_page: 1, page: 1 })
      .then((r) => setOpenRequestCount(r.pagination?.total ?? 0))
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
    leaderScope &&
    (admin?.role === "service_unit_leader" ||
      admin?.role === "sub_unit_leader" ||
      admin?.role === "data_entry_admin" ||
      admin?.role === "satellite_church_admin");

  return (
    <div className="sa-root" data-theme={theme}>
      <Sidebar page={page} setPage={setPage} pendingCount={pendingCount} requestOpenCount={openRequestCount} />

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
          {page === "role-dashboard" && <RoleDashboard setPage={setPage} />}
          {page === "data-locations" && admin?.role === "data_entry_admin" && <DataEntryLocationForm />}
          {page === "branch-catalog" && canEditBranchCatalog(admin?.role) && <BranchCatalog />}
          {page === "overview"  && <Overview units={units} setPage={setPage} />}
          {page === "queue"     && <Queue     units={units} />}
          {(page === "units" || page === "locations") && (
            <ServiceUnits data={units} reload={() => { loadUnits(); loadAdmins(); }} />
          )}
          {page === "members"   && <UnitMembers units={units} />}
          {page === "admins"    && <AdminUsers   data={admins} units={units} reload={loadAdmins} />}
          {page === "unit-request" && admin?.role === "satellite_church_admin" && <SatelliteUnitRequest />}
          {page === "requests"  && <Requests />}
          {page === "activity"  && <ActivityLog />}
          {page === "oversight" && <BranchOversight units={units} />}
          {page === "announcements" && <Announcements />}
          {page === "settings"  && canPlatformSettings && <Settings />}
          {page === "profile"   && !canPlatformSettings && <ProfileSettings />}
        </div>
      </div>
    </div>
  );
}
