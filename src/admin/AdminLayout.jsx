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
import { CountryWorkforce } from "./pages/CountryWorkforce.jsx";
import { CountryUsers } from "./pages/CountryUsers.jsx";
import { StateWorkforce } from "./pages/StateWorkforce.jsx";
import { StateUsers } from "./pages/StateUsers.jsx";
import { api } from "./api.js";
import { useAdminAuth } from "./AdminContext.jsx";
import { leaderScopeLabel } from "./leaderScope.js";
import { branchCountryLabel, branchStateLabel } from "./branchRegions.js";
import { isGlobalAdminRole, canEditBranchCatalog, isServiceUnitLeader, isCountrySuperAdmin } from "./roles.js";
import {
  effectiveUiRole,
  isActingAsStateAdmin,
  isStateLevelUi,
  normalizePageForViewMode,
  normalizeStateAdminPage,
} from "./adminViewMode.js";

const PAGE_TITLES_DEFAULT = {
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
  oversight: "Application Queue",
  "role-dashboard": "Dashboard",
  announcements: "Announcements",
  "data-locations": "Propose church location",
  "branch-catalog": "Branch directory",
  "unit-request": "Request Service Unit",
  workforce: "Workforce",
  users: "Users",
};

const PAGE_TITLES_BY_ROLE = {
  satellite_church_admin: {
    "role-dashboard": "Dashboard",
    oversight: "Application Queue",
    admins: "Admin Accounts",
    requests: "My Requests",
  },
  country_super_admin: {
    overview: "Country Analytics",
    oversight: "Application Queue",
    workforce: "Workforce",
    users: "Users",
  },
  state_super_admin: {
    overview: "State Analytics",
    oversight: "Application Queue",
    workforce: "Workforce",
    users: "Users",
  },
  data_entry_admin: {
    "role-dashboard": "Home",
  },
};

function getPageTitle(page, role) {
  return PAGE_TITLES_BY_ROLE[role]?.[page] || PAGE_TITLES_DEFAULT[page] || page;
}

export function AdminLayout() {
  const { admin, viewMode } = useAdminAuth();
  const uiRole = effectiveUiRole(admin, viewMode);
  const actingAsState = isActingAsStateAdmin(admin, viewMode);
  const canPlatformSettings = isGlobalAdminRole(admin?.role);
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("sm_admin_theme") || "light"; } catch { return "light"; }
  });
  const [page, setPageRaw] = useState(() => {
    try {
      return sessionStorage.getItem("sm_admin_page") || "overview";
    } catch { return "overview"; }
  });
  const setPage = useCallback((v) => {
    setPageRaw((prev) => {
      const next = typeof v === "function" ? v(prev) : v;
      try { sessionStorage.setItem("sm_admin_page", next); } catch { /* ignore */ }
      return next;
    });
  }, []);
  const [queueTab, setQueueTab] = useState(() => {
    try {
      return sessionStorage.getItem("sm_admin_queue_tab") || "all";
    } catch { return "all"; }
  });

  const navigateToQueue = useCallback((tab = "all") => {
    setQueueTab(tab);
    try { sessionStorage.setItem("sm_admin_queue_tab", tab); } catch { /* ignore */ }
    setPage("queue");
  }, [setPage]);
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
      setPage((p) => normalizePageForViewMode(p, admin, viewMode));
    } else if (admin.role === "state_super_admin") {
      setPage((p) => normalizeStateAdminPage(p));
    } else if (admin.role === "satellite_church_admin") {
      setPage((p) =>
        [
          "role-dashboard",
          "oversight",
          "admins",
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
          "locations",
          "branch-catalog",
          "activity",
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
  }, [admin?.id, admin?.role, admin?.branch_state, viewMode, setPage]);

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
      .requests({ per_page: 500, page: 1 })
      .then((r) => {
        const pending = (r.data || []).filter(
          (req) => req.status === "open" || req.status === "in_review",
        ).length;
        setOpenRequestCount(pending);
      })
      .catch(() => {});
  }, [page, admin]);

  useEffect(() => {
    try { localStorage.setItem("sm_admin_theme", theme); } catch { /* ignore */ }
  }, [theme]);

  const now = new Date().toLocaleString("en-GB", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const leaderScope = leaderScopeLabel(admin, viewMode);
  const showLeaderScope =
    leaderScope &&
    (admin?.role === "service_unit_leader" ||
      admin?.role === "sub_unit_leader" ||
      admin?.role === "data_entry_admin" ||
      admin?.role === "satellite_church_admin" ||
      admin?.role === "country_super_admin" ||
      admin?.role === "state_super_admin");

  return (
    <div className="sa-root" data-theme={theme}>
      <Sidebar page={page} setPage={setPage} pendingCount={pendingCount} requestOpenCount={openRequestCount} />

      <div className="sa-main">
        <div className="sa-topbar">
          <div className="sa-page-title-block">
            <div className="sa-page-title">{getPageTitle(page, uiRole)}</div>
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

        {actingAsState && admin?.branch_state ? (
          <div className="sa-state-view-banner" role="status">
            <span className="sa-state-view-banner-label">State branch dashboard</span>
            <span>
              <strong>{branchStateLabel(admin.branch_country, admin.branch_state)}</strong>
              {branchCountryLabel(admin.branch_country)
                ? ` · ${branchCountryLabel(admin.branch_country)}`
                : ""}
            </span>
            <span className="sa-text-muted sa-text-sm">Country-wide tools are hidden. Toggle off in the sidebar to return to Country Admin.</span>
          </div>
        ) : null}

        <div className="sa-content">
          {page === "role-dashboard" && <RoleDashboard setPage={setPage} />}
          {page === "data-locations" && admin?.role === "data_entry_admin" && <DataEntryLocationForm />}
          {(page === "locations" || page === "branch-catalog") &&
            canEditBranchCatalog(admin?.role) &&
            !(isCountrySuperAdmin(admin?.role) && actingAsState) && (
            <BranchCatalog variant={page === "locations" ? "locations" : "catalog"} />
          )}
          {page === "overview"  && <Overview units={units} setPage={setPage} navigateToQueue={navigateToQueue} />}
          {page === "queue"     && <Queue     units={units} initialTab={queueTab} />}
          {page === "units" && (
            <ServiceUnits data={units} reload={() => { loadUnits(); loadAdmins(); }} />
          )}
          {page === "members"   && <UnitMembers units={units} />}
          {page === "admins"    && <AdminUsers   data={admins} units={units} reload={loadAdmins} />}
          {/* unit-request removed — satellite pastors no longer request service units */}
          {page === "requests"  && <Requests />}
          {page === "activity"  && <ActivityLog />}
          {page === "oversight" && <BranchOversight units={units} />}
          {page === "announcements" && <Announcements />}
          {page === "workforce" && isCountrySuperAdmin(admin?.role) && !actingAsState && (
            <CountryWorkforce admins={admins} reload={loadAdmins} setPage={setPage} />
          )}
          {page === "users" && isCountrySuperAdmin(admin?.role) && !actingAsState && (
            <CountryUsers admins={admins} reload={loadAdmins} />
          )}
          {page === "workforce" && isStateLevelUi(admin, viewMode) && (
            <StateWorkforce admins={admins} reload={loadAdmins} setPage={setPage} />
          )}
          {page === "users" && isStateLevelUi(admin, viewMode) && (
            <StateUsers admins={admins} reload={loadAdmins} />
          )}
          {page === "settings"  && canPlatformSettings && <Settings />}
          {page === "profile"   && !canPlatformSettings && <ProfileSettings />}
        </div>
      </div>
    </div>
  );
}
