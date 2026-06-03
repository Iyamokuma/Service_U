import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { useAdminAuth } from "../AdminContext.jsx";
import { useToast } from "../components/Toast.jsx";
import { StateBranchAdminModal } from "../components/StateBranchAdminModal.jsx";
import { AdminRowActionsMenu, AdminRowActionsTrigger } from "../components/AdminRowActionsMenu.jsx";
import { buildAdminRowMenuItems, isAdminActive, nextAdminActiveValue } from "../components/adminRowMenuItems.js";
import { UsersPendingQueue } from "../components/UsersPendingQueue.jsx";
import { UsersPageMeta } from "../components/UsersPageMeta.jsx";
import { UsersSectionTabs } from "../components/UsersSectionTabs.jsx";
import { UsersContextSwitch } from "../components/UsersContextSwitch.jsx";
import { CountryWorkforce } from "./CountryWorkforce.jsx";
import { branchCountryLabel, branchStateLabel, branchStatesForCountry } from "../branchRegions.js";
import { countryAdminHomeState } from "../roles.js";
import {
  availableStatesForCountryAdmin,
  occupiedStateCodes,
  stateLeaderForCode,
} from "../stateAdminForm.js";
import { readCountryAdminsContext, writeCountryAdminsContext } from "../countryUsersContext.js";
import { readUsersSectionTab, writeUsersSectionTab } from "../usersSectionTab.js";
import { exportCsv } from "../exportCsv.js";

const BRANCH_ADMIN_ROLES = new Set(["state_super_admin", "satellite_church_admin", "country_super_admin"]);

function adminLocationLabel(admin, countryCode) {
  const cc = branchCountryLabel(admin.branch_country || countryCode);
  const st = branchStateLabel(admin.branch_country || countryCode, admin.branch_state);
  const sat = String(admin.satellite_site || "").trim();
  if (admin.role === "satellite_church_admin" && sat) {
    return st ? `${sat} · ${st}` : sat;
  }
  if (st && cc) return `${st}, ${cc}`;
  return st || cc || "—";
}

function adminRoleLabel(admin, { isDefaultStateRow } = {}) {
  if (isDefaultStateRow && admin.role === "country_super_admin") {
    return "State Branch Admin (HQ)";
  }
  if (admin.role === "state_super_admin") return "State Branch Admin";
  if (admin.role === "satellite_church_admin") return "Satellite Pastor Admin";
  return String(admin.role || "—");
}

function isBranchAdminRow(admin) {
  return BRANCH_ADMIN_ROLES.has(admin.role);
}

export function CountryUsers({ admins: adminsPayload, reload, setPage }) {
  const toast = useToast();
  const { admin: me, setViewMode } = useAdminAuth();
  const countryCode = String(me?.branch_country || "").toUpperCase();
  const myHomeState = countryAdminHomeState(me);

  const [sectionTab, setSectionTabRaw] = useState(() => {
    const tab = readUsersSectionTab();
    return tab === "members" ? "admins" : tab;
  });
  const setSectionTab = useCallback((tab) => {
    writeUsersSectionTab(tab);
    setSectionTabRaw(tab);
  }, []);

  const [adminsContext, setAdminsContextRaw] = useState(() => readCountryAdminsContext());
  const setAdminsContext = useCallback((ctx) => {
    writeCountryAdminsContext(ctx);
    setAdminsContextRaw(ctx);
  }, []);

  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [stateModal, setStateModal] = useState(null);
  const [reassignOnly, setReassignOnly] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [actionMenu, setActionMenu] = useState({ id: null, anchor: null });

  const allAdmins = adminsPayload?.data ?? [];

  const countryAdmins = useMemo(
    () => allAdmins.filter((a) => String(a.branch_country || "").toUpperCase() === countryCode),
    [allAdmins, countryCode],
  );

  const stateBranchAdmins = useMemo(
    () => countryAdmins.filter((a) => a.role === "state_super_admin"),
    [countryAdmins],
  );

  const satellitePastors = useMemo(
    () => countryAdmins.filter((a) => a.role === "satellite_church_admin"),
    [countryAdmins],
  );

  /** HQ default first, then state branch admins, then satellite pastors (country scope). */
  const managedAdmins = useMemo(() => {
    const hqState = String(myHomeState || "").toUpperCase();
    const hqLeader = hqState ? stateLeaderForCode(countryAdmins, countryCode, hqState) : null;
    const defaultRow = hqLeader?.admin && isBranchAdminRow(hqLeader.admin) ? hqLeader.admin : null;
    const defaultId = defaultRow ? Number(defaultRow.id) : null;

    const states = stateBranchAdmins
      .filter((a) => defaultId == null || Number(a.id) !== defaultId)
      .sort((a, b) => String(a.full_name || "").localeCompare(String(b.full_name || ""), undefined, { sensitivity: "base" }));

    const satellites = satellitePastors
      .slice()
      .sort((a, b) => {
        const st = String(a.branch_state || "").localeCompare(String(b.branch_state || ""), undefined, {
          sensitivity: "base",
        });
        if (st !== 0) return st;
        const sat = String(a.satellite_site || "").localeCompare(String(b.satellite_site || ""), undefined, {
          sensitivity: "base",
        });
        if (sat !== 0) return sat;
        return String(a.full_name || "").localeCompare(String(b.full_name || ""), undefined, { sensitivity: "base" });
      });

    return defaultRow ? [defaultRow, ...states, ...satellites] : [...states, ...satellites];
  }, [countryAdmins, countryCode, myHomeState, stateBranchAdmins, satellitePastors]);

  const defaultAdminId = useMemo(() => {
    const hqState = String(myHomeState || "").toUpperCase();
    const hqLeader = hqState ? stateLeaderForCode(countryAdmins, countryCode, hqState) : null;
    return hqLeader?.admin?.id ?? null;
  }, [countryAdmins, countryCode, myHomeState]);

  const adminsContextOptions = useMemo(() => {
    const defaultIsCountry = managedAdmins.some(
      (a) => Number(a.id) === Number(defaultAdminId) && a.role === "country_super_admin",
    );
    return [
      { id: "all", label: "All admins", count: managedAdmins.length },
      {
        id: "state_super_admin",
        label: "State branch",
        count: stateBranchAdmins.length + (defaultIsCountry ? 1 : 0),
      },
      { id: "satellite_church_admin", label: "Satellite pastors", count: satellitePastors.length },
    ];
  }, [managedAdmins, stateBranchAdmins.length, satellitePastors.length, defaultAdminId]);

  const contextFilteredAdmins = useMemo(() => {
    if (adminsContext === "state_super_admin") {
      return managedAdmins.filter(
        (a) =>
          a.role === "state_super_admin" ||
          (Number(a.id) === Number(defaultAdminId) && a.role === "country_super_admin"),
      );
    }
    if (adminsContext === "satellite_church_admin") {
      return managedAdmins.filter((a) => a.role === "satellite_church_admin");
    }
    return managedAdmins;
  }, [managedAdmins, adminsContext, defaultAdminId]);

  const loadPending = useCallback(() => {
    api
      .requests({ per_page: 200, page: 1 })
      .then((res) => setPendingRequests(res.data || []))
      .catch(() => setPendingRequests([]));
  }, []);

  useEffect(() => {
    loadPending();
  }, [loadPending, adminsPayload]);

  const vacantStates = useMemo(
    () => availableStatesForCountryAdmin(countryCode, countryAdmins, pendingRequests),
    [countryCode, countryAdmins, pendingRequests],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contextFilteredAdmins.filter((a) => {
      if (!showInactive && Number(a.is_active) !== 1) return false;
      if (!q) return true;
      const loc = adminLocationLabel(a, countryCode);
      const isDefault = defaultAdminId != null && Number(a.id) === Number(defaultAdminId);
      const hay = [
        a.full_name,
        a.username,
        a.email,
        loc,
        adminRoleLabel(a, { isDefaultStateRow: isDefault }),
        isDefault ? "default admin" : "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [contextFilteredAdmins, search, showInactive, countryCode, defaultAdminId]);

  const actionTarget = useMemo(
    () => managedAdmins.find((a) => Number(a.id) === Number(actionMenu.id)),
    [managedAdmins, actionMenu.id],
  );

  const isDefaultRow = (row) => defaultAdminId != null && Number(row?.id) === Number(defaultAdminId);

  function closeActionMenu() {
    setActionMenu({ id: null, anchor: null });
  }

  function openActions(e, row) {
    e.stopPropagation();
    if (actionMenu.id === row.id) {
      closeActionMenu();
      return;
    }
    setActionMenu({ id: row.id, anchor: e.currentTarget });
  }

  async function saveStateAdmin(form, validationError) {
    if (validationError) {
      toast(validationError, "error");
      return;
    }
    if (!form) return;
    setSaving(true);
    try {
      const payload = { ...form, viewer: me };
      if (form.id) await api.updateAdmin(form.id, payload);
      else await api.createAdmin(payload);
      toast(form.id ? "State Branch Admin updated." : "State Branch Admin created.", "success");
      setStateModal(null);
      setReassignOnly(false);
      reload?.();
      loadPending();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(row) {
    closeActionMenu();
    const activating = !isAdminActive(row);
    try {
      await api.updateAdmin(row.id, { is_active: nextAdminActiveValue(row), viewer: me });
      toast(activating ? "Account activated." : "Account deactivated.", "success");
      reload?.();
      loadPending();
    } catch (e) {
      toast(e.message, "error");
    }
  }

  async function deleteAdmin(row) {
    closeActionMenu();
    if (!window.confirm(`Delete ${row.full_name}? This cannot be undone.`)) {
      return;
    }
    try {
      await api.deleteAdmin(row.id, { viewer: me });
      toast("Admin account deleted.", "success");
      reload?.();
      loadPending();
    } catch (e) {
      toast(e.message, "error");
    }
  }

  function handleExport() {
    if (!filtered.length) {
      toast("No records to export.", "error");
      return;
    }
    exportCsv(filtered, {
      filename: `branch-admins-${countryCode}-${new Date().toISOString().slice(0, 10)}.csv`,
      columns: [
        { key: "full_name", label: "Name" },
        { key: "role", label: "Role", format: (v, row) => adminRoleLabel(row, { isDefaultStateRow: isDefaultRow(row) }) },
        {
          key: "branch_state",
          label: "Location",
          format: (v, row) => adminLocationLabel(row, countryCode),
        },
        { key: "is_active", label: "Status", format: (v) => (Number(v) === 1 ? "Active" : "Inactive") },
      ],
    });
    toast(`Exported ${filtered.length} record${filtered.length !== 1 ? "s" : ""}.`, "success");
  }

  const takenCount = occupiedStateCodes(countryAdmins, pendingRequests, countryCode).size;
  const statesTotal = branchStatesForCountry(countryCode).length;
  const activeStateCount = stateBranchAdmins.filter((a) => Number(a.is_active) === 1).length;
  const activeSatelliteCount = satellitePastors.filter((a) => Number(a.is_active) === 1).length;

  const menuItems = useMemo(() => {
    if (!actionTarget) return [];
    if (isDefaultRow(actionTarget) && actionTarget.role === "country_super_admin") {
      return [
        {
          id: "state-view",
          label: "Open state branch view",
          onClick: () => {
            closeActionMenu();
            setViewMode("state");
            writeUsersSectionTab("admins");
            setSectionTab("admins");
          },
        },
        {
          id: "profile",
          label: "Profile & account",
          onClick: () => {
            closeActionMenu();
            setPage?.("profile");
          },
        },
      ];
    }
    if (actionTarget.role !== "state_super_admin") {
      return [];
    }
    return buildAdminRowMenuItems({
      row: actionTarget,
      includeReassign: false,
      onEdit: () => {
        setReassignOnly(false);
        setStateModal(actionTarget);
      },
      onToggleActive: () => toggleActive(actionTarget),
      onDelete: () => deleteAdmin(actionTarget),
    });
  }, [actionTarget, actionTarget?.is_active, defaultAdminId, setViewMode, setPage, setSectionTab]);

  const pageMetaItems =
    sectionTab === "workforce"
      ? null
      : [
          `${activeStateCount} active state admin${activeStateCount !== 1 ? "s" : ""}`,
          `${activeSatelliteCount} active satellite pastor${activeSatelliteCount !== 1 ? "s" : ""}`,
          `${takenCount}/${statesTotal} states covered`,
          vacantStates.length
            ? `${vacantStates.length} vacant state${vacantStates.length !== 1 ? "s" : ""}`
            : "All states covered",
        ];

  return (
    <>
      <header className="sa-users-page-head">
        <div className="sa-users-page-head-top">
          <h1 className="sa-admins-title">Users</h1>
          {sectionTab === "admins" ? (
            <div className="sa-users-page-actions">
              <button type="button" className="sa-btn sa-btn-outline sa-btn-sm" onClick={handleExport} disabled={!filtered.length}>
                Export CSV
              </button>
              {adminsContext !== "satellite_church_admin" ? (
                <button
                  type="button"
                  className="sa-btn sa-btn-primary sa-btn-sm"
                  onClick={() => {
                    setReassignOnly(false);
                    setStateModal({});
                  }}
                >
                  + New State Branch Admin
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="sa-users-page-head-tabs">
          <UsersSectionTabs active={sectionTab} onChange={setSectionTab} />
        </div>
        {pageMetaItems ? <UsersPageMeta items={pageMetaItems} /> : null}
      </header>

      <UsersPendingQueue
        compact
        requests={pendingRequests}
        onOpenQueue={() => setPage?.("requests")}
      />

      {sectionTab === "workforce" ? (
        <CountryWorkforce embedded admins={adminsPayload} />
      ) : (
        <div className="sa-card">
          <UsersContextSwitch
            value={adminsContext}
            onChange={setAdminsContext}
            options={adminsContextOptions}
            ariaLabel="Branch admin type"
          />

          <div className="sa-admins-filters" role="toolbar" aria-label="Filter admins">
            <div className="sa-search">
              <span className="sa-search-icon" aria-hidden>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
              <input
                type="search"
                placeholder={
                  adminsContext === "satellite_church_admin"
                    ? "Search pastor, satellite, state…"
                    : adminsContext === "state_super_admin"
                      ? "Search state admin or state…"
                      : "Search name, state, satellite…"
                }
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <label className="sa-field-toggle">
              <span className="sa-field-toggle-label">Show inactive</span>
              <span className="sa-switch">
                <input
                  type="checkbox"
                  role="switch"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                />
                <span className="sa-switch-ui" aria-hidden />
              </span>
            </label>
            <span className="sa-admins-filter-count">
              {filtered.length} admin{filtered.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="sa-table-wrap">
            {filtered.length === 0 ? (
              <div className="sa-empty">
                <div className="sa-empty-text">
                  {managedAdmins.length === 0
                    ? "No state or satellite administrators in this country yet."
                    : "No accounts match your filters."}
                </div>
              </div>
            ) : (
              <table className="sa-table sa-table-admins-simple">
                <thead>
                  <tr>
                    <th>Name of admin</th>
                    <th>Location</th>
                    <th>Status</th>
                    <th>Role</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a) => {
                    const isDefault = isDefaultRow(a);
                    return (
                      <tr key={a.id}>
                        <td>
                          <div className="sa-fw-600">{a.full_name}</div>
                          <div className="sa-text-sm sa-text-muted">{a.username}</div>
                          {isDefault ? (
                            <span className="sa-badge viewer" style={{ marginTop: 6 }}>
                              Default admin
                            </span>
                          ) : null}
                          {Number(a.is_active) !== 1 ? (
                            <span className="sa-badge inactive" style={{ marginTop: 6 }}>
                              Inactive
                            </span>
                          ) : null}
                        </td>
                        <td className="sa-text-sm">{adminLocationLabel(a, countryCode)}</td>
                        <td>
                          <span className={`sa-badge ${Number(a.is_active) === 1 ? "active" : "inactive"}`}>
                            {Number(a.is_active) === 1 ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="sa-text-sm">
                          {adminRoleLabel(a, { isDefaultStateRow: isDefault })}
                        </td>
                        <td>
                          {a.role === "state_super_admin" || isDefault ? (
                            <AdminRowActionsTrigger onOpen={(e) => openActions(e, a)} label="Action" />
                          ) : (
                            <span className="sa-text-muted sa-text-sm">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      <AdminRowActionsMenu
        open={!!actionMenu.id}
        anchorEl={actionMenu.anchor}
        onClose={closeActionMenu}
        items={menuItems}
      />

      <StateBranchAdminModal
        open={!!stateModal}
        countryCode={countryCode}
        existingAdmins={countryAdmins}
        pendingRequests={pendingRequests}
        initialStateCode={stateModal?.initialState || stateModal?.branch_state || ""}
        editData={stateModal?.id ? stateModal : null}
        saving={saving}
        onClose={() => {
          setStateModal(null);
          setReassignOnly(false);
        }}
        onSave={saveStateAdmin}
        reassignOnly={reassignOnly}
      />
    </>
  );
}
