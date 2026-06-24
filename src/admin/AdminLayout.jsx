import { useCallback, useEffect, useMemo, useState } from "react";
import { Sidebar } from "./components/Sidebar.jsx";
import { AdminBrandLogo } from "./components/AdminBrandLogo.jsx";
import { GlobalAdminGeoFilterBar } from "./components/GlobalAdminGeoFilterBar.jsx";
import { AdminGeoFilterProvider } from "./AdminGeoFilterContext.jsx";
import { AdminViewModeFloat } from "./components/AdminViewModeFloat.jsx";
import { NotificationBell } from "./components/NotificationBell.jsx";
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
import { BranchCatalog } from "./pages/BranchCatalog.jsx";
import { Announcements } from "./pages/Announcements.jsx";
import { Notifications } from "./pages/Notifications.jsx";
import { CountryUsers } from "./pages/CountryUsers.jsx";
import { StateUsers } from "./pages/StateUsers.jsx";
import { SatelliteUsers } from "./pages/SatelliteUsers.jsx";
import { api, mergeAdminListPayload } from "./api.js";
import { useAdminAuth } from "./AdminContext.jsx";
import { leaderScopeLabel } from "./leaderScope.js";
import { branchCountryLabel, branchStateLabel } from "./branchRegions.js";
import { ADMIN_REQUESTS_CHANGED, setFocusRequestId } from "./adminLiveRefresh.js";
import { isGlobalAdminRole, canEditBranchCatalog, isCountrySuperAdmin } from "./roles.js";
import {
  effectiveUiRole,
  isActingAsStateAdmin,
  isStateLevelUi,
  normalizePageForViewMode,
  normalizeGlobalAdminPage,
  normalizeStateAdminPage,
  normalizeSatelliteAdminPage,
  normalizeServiceUnitLeaderPage,
  normalizeSubUnitLeaderPage,
  normalizeDataEntryAdminPage,
} from "./adminViewMode.js";
import { ServiceUnitUsers } from "./pages/ServiceUnitUsers.jsx";
import { SubUnitUsers } from "./pages/SubUnitUsers.jsx";
import { countryAdminHomeState } from "./roles.js";
import { writeUsersSectionTab } from "./usersSectionTab.js";
import { useAdminNotifications } from "./useAdminNotifications.js";
import { AdminErrorBoundary } from "./components/AdminErrorBoundary.jsx";
import { TotpEnrollmentGate } from "./components/TotpEnrollmentGate.jsx";

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
  notifications: "Notifications",
  "data-locations": "Propose church location",
  "branch-catalog": "Branch directory",
  "unit-request": "Request Service Unit",
  workforce: "Workforce",
  users: "Members",
};

const PAGE_TITLES_BY_ROLE = {
  satellite_church_admin: {
    "role-dashboard": "Dashboard",
    oversight: "Application Queue",
    users: "Members",
    requests: "My Requests",
  },
  country_super_admin: {
    overview: "Country Analytics",
    oversight: "Application Queue",
    workforce: "Workforce",
    users: "Members",
  },
  state_super_admin: {
    overview: "State Analytics",
    oversight: "Application Queue",
    workforce: "Workforce",
    users: "Members",
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
  const { unread: notificationUnread } = useAdminNotifications({ perPage: 1 });
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

  /** Avoid a blank main area when country ↔ state view changes leave an invalid page id. */
  const contentPage = useMemo(() => {
    if (!admin) return page;
    if (isCountrySuperAdmin(admin.role)) {
      return normalizePageForViewMode(page, admin, viewMode);
    }
    if (admin.role === "state_super_admin") {
      return normalizeStateAdminPage(page);
    }
    if (admin.role === "satellite_church_admin") {
      return normalizeSatelliteAdminPage(page);
    }
    if (admin.role === "service_unit_leader") {
      return normalizeServiceUnitLeaderPage(page);
    }
    if (admin.role === "sub_unit_leader") {
      return normalizeSubUnitLeaderPage(page);
    }
    if (admin.role === "data_entry_admin") {
      return normalizeDataEntryAdminPage(page);
    }
    if (isGlobalAdminRole(admin.role)) {
      return normalizeGlobalAdminPage(page);
    }
    return page;
  }, [page, admin, viewMode]);

  useEffect(() => {
    if (!admin || contentPage === page) return;
    setPage(contentPage);
  }, [admin, contentPage, page, setPage]);

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

  const navigateToRequest = useCallback((requestId) => {
    setFocusRequestId(requestId);
    setPage("requests");
  }, [setPage]);
  const [units, setUnits] = useState(null);
  const [admins, setAdmins] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [openRequestCount, setOpenRequestCount] = useState(0);

  const loadUnits = useCallback(() => api.units().then(setUnits).catch(() => {}), []);

  const loadAdmins = useCallback(async () => {
    try {
      const res = await api.admins();
      setAdmins(res);
      return res;
    } catch {
      return null;
    }
  }, []);

  const upsertAdminInList = useCallback((row) => {
    if (!row?.id) return;
    setAdmins((prev) => mergeAdminListPayload(prev, row));
  }, []);

  const removeAdminFromList = useCallback((id) => {
    if (!id) return;
    setAdmins((prev) => ({
      data: (prev?.data ?? []).filter((a) => Number(a.id) !== Number(id)),
    }));
  }, []);

  useEffect(() => {
    if (!admin) return;
    loadUnits();
    loadAdmins();
  }, [admin, loadUnits, loadAdmins]);

  /** Email deep links: /admin?page=queue&tab=new */
  useEffect(() => {
    if (!admin) return;
    try {
      const params = new URLSearchParams(window.location.search);
      const pageParam = params.get("page");
      const tabParam = params.get("tab");
      if (!pageParam) return;
      setPage(pageParam);
      if (tabParam && (pageParam === "queue" || pageParam === "oversight")) {
        setQueueTab(tabParam);
        try {
          sessionStorage.setItem("sm_admin_queue_tab", tabParam);
        } catch {
          /* ignore */
        }
      }
      const url = new URL(window.location.href);
      url.searchParams.delete("page");
      url.searchParams.delete("tab");
      const cleaned = `${url.pathname}${url.search}${url.hash}`;
      window.history.replaceState({}, "", cleaned);
    } catch {
      /* ignore */
    }
  }, [admin?.id, setPage]);

  useEffect(() => {
    if (!admin) return;
    if (admin.role === "country_super_admin") {
      setPage((p) => {
        if (p === "members") writeUsersSectionTab("members");
        return normalizePageForViewMode(p, admin, viewMode);
      });
    } else if (admin.role === "state_super_admin") {
      setPage((p) => {
        if (p === "members") writeUsersSectionTab("members");
        return normalizeStateAdminPage(p);
      });
    } else if (admin.role === "satellite_church_admin") {
      setPage((p) => normalizeSatelliteAdminPage(p));
    } else if (admin.role === "service_unit_leader") {
      setPage((p) => normalizeServiceUnitLeaderPage(p));
    } else if (admin.role === "sub_unit_leader") {
      setPage((p) => normalizeSubUnitLeaderPage(p));
    } else if (isGlobalAdminRole(admin.role)) {
      setPage((p) => normalizeGlobalAdminPage(p));
    } else if (admin.role === "data_entry_admin") {
      setPage((p) => normalizeDataEntryAdminPage(p));
    }
  }, [admin?.id, admin?.role, admin?.branch_state, viewMode, setPage]);

  // Sidebar badges — refresh on login and when returning to queue/requests pages
  useEffect(() => {
    if (!admin) return;
    api.queue({ status: "new", per_page: 1, viewer: admin })
      .then((r) => setPendingCount(r.pagination?.total ?? 0))
      .catch(() => {});
  }, [admin?.id, contentPage]);

  useEffect(() => {
    if (!admin) {
      setOpenRequestCount(0);
      return undefined;
    }
    const loadApproverQueue =
      isGlobalAdminRole(admin.role) ||
      (isCountrySuperAdmin(admin.role) && !actingAsState);
    if (!loadApproverQueue) {
      setOpenRequestCount(0);
      return undefined;
    }
    const refreshOpenCount = () => {
      api
        .requestOpenCount()
        .then((r) => setOpenRequestCount(r.open ?? 0))
        .catch(() => {});
    };
    refreshOpenCount();
    window.addEventListener(ADMIN_REQUESTS_CHANGED, refreshOpenCount);
    return () => window.removeEventListener(ADMIN_REQUESTS_CHANGED, refreshOpenCount);
  }, [admin?.id, actingAsState, contentPage]);

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
    <AdminGeoFilterProvider admin={admin}>
    <div className="sa-root" data-theme={theme}>
      <Sidebar
        page={contentPage}
        setPage={setPage}
        pendingCount={pendingCount}
        requestOpenCount={openRequestCount}
        notificationUnreadCount={notificationUnread}
      />

      <div className="sa-main">
        <div className="sa-topbar">
          <div className="sa-topbar-left">
            <AdminBrandLogo variant="topbar" className="sa-topbar-logo-mobile" />
            <div className="sa-page-title-block">
              <div className="sa-page-title">{getPageTitle(contentPage, uiRole)}</div>
              {showLeaderScope ? <div className="sa-page-scope">{leaderScope}</div> : null}
            </div>
          </div>
          <div className="sa-topbar-right">
            <NotificationBell
              onNavigateQueue={(tab) => navigateToQueue(tab || "new")}
              onNavigateAnnouncements={() => setPage("announcements")}
              onOpenInbox={() => setPage("notifications")}
              onNavigateRequests={navigateToRequest}
            />
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

        <GlobalAdminGeoFilterBar />

        <AdminViewModeFloat page={page} setPage={setPage} />

        {actingAsState && countryAdminHomeState(admin) ? (
          <div className="sa-state-view-banner" role="status">
            <span className="sa-state-view-banner-label">State branch dashboard</span>
            <span>
              <strong>{branchStateLabel(admin.branch_country, countryAdminHomeState(admin))}</strong>
              {branchCountryLabel(admin.branch_country)
                ? ` · ${branchCountryLabel(admin.branch_country)}`
                : ""}
            </span>
            <span className="sa-text-muted sa-text-sm">
              Country-wide queue is view-only here. Switch to Country Admin to update application status.
            </span>
          </div>
        ) : null}

        <div className="sa-content">
          <AdminErrorBoundary>
          <TotpEnrollmentGate page={contentPage}>
          {contentPage === "role-dashboard" && <RoleDashboard setPage={setPage} />}
          {contentPage === "data-locations" && admin?.role === "data_entry_admin" && <DataEntryLocationForm />}
          {contentPage === "locations" && canEditBranchCatalog(admin?.role) && (
            <BranchCatalog variant="locations" />
          )}
          {contentPage === "overview"  && <Overview units={units} setPage={setPage} navigateToQueue={navigateToQueue} />}
          {contentPage === "queue"     && <Queue     units={units} initialTab={queueTab} />}
          {contentPage === "units" && (
            <ServiceUnits data={units} reload={() => { loadUnits(); loadAdmins(); }} />
          )}
          {contentPage === "members" &&
            !isStateLevelUi(admin, viewMode) &&
            admin?.role !== "service_unit_leader" &&
            admin?.role !== "sub_unit_leader" &&
            admin?.role !== "satellite_church_admin" && <UnitMembers units={units} />}
          {contentPage === "admins"    && admin?.role !== "satellite_church_admin" && (
            <AdminUsers
              data={admins}
              units={units}
              reload={loadAdmins}
              upsertAdminInList={upsertAdminInList}
              removeAdminFromList={removeAdminFromList}
            />
          )}
          {/* unit-request removed — satellite pastors no longer request service units */}
          {contentPage === "requests"  && <Requests />}
          {contentPage === "activity"  && <ActivityLog />}
          {contentPage === "oversight" && <BranchOversight units={units} />}
          {contentPage === "announcements" && <Announcements />}
          {contentPage === "notifications" && (
            <Notifications setPage={setPage} navigateToQueue={navigateToQueue} />
          )}
          {contentPage === "users" && isCountrySuperAdmin(admin?.role) && !actingAsState && (
            <CountryUsers admins={admins} units={units} reload={loadAdmins} setPage={setPage} />
          )}
          {contentPage === "users" && isStateLevelUi(admin, viewMode) && (
            <StateUsers admins={admins} units={units} reload={loadAdmins} setPage={setPage} />
          )}
          {contentPage === "users" && admin?.role === "satellite_church_admin" && (
            <SatelliteUsers admins={admins} units={units} reload={loadAdmins} setPage={setPage} />
          )}
          {contentPage === "users" && admin?.role === "service_unit_leader" && (
            <ServiceUnitUsers admins={admins} units={units} reload={loadAdmins} />
          )}
          {contentPage === "users" && admin?.role === "sub_unit_leader" && (
            <SubUnitUsers units={units} />
          )}
          {contentPage === "settings"  && canPlatformSettings && <Settings />}
          {contentPage === "profile"   && <ProfileSettings />}
          </TotpEnrollmentGate>
          </AdminErrorBoundary>
        </div>
      </div>
    </div>
    </AdminGeoFilterProvider>
  );
}
