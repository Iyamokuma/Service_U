import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { useAdminAuth } from "../AdminContext.jsx";
import { useToast } from "../components/Toast.jsx";
import { AdminLoginMeta } from "../components/AdminLoginMeta.jsx";
import { StateBranchAdminModal } from "../components/StateBranchAdminModal.jsx";
import { SatellitePastorAdminModal } from "../components/SatellitePastorAdminModal.jsx";
import { AdminRowActionsMenu, AdminRowActionsTrigger } from "../components/AdminRowActionsMenu.jsx";
import { canCountryAdminManageRole } from "../roles.js";
import { buildAdminRowMenuItems, isAdminActive, nextAdminActiveValue } from "../components/adminRowMenuItems.js";
import { TableSelectCheckbox } from "../components/TableSelectCheckbox.jsx";
import { TableBulkActionsBar } from "../components/TableBulkActionsBar.jsx";
import { useAdminTableBulk } from "../hooks/useAdminTableBulk.js";
import { UsersPendingQueue } from "../components/UsersPendingQueue.jsx";
import { UsersPageMeta } from "../components/UsersPageMeta.jsx";
import { UsersSectionTabs } from "../components/UsersSectionTabs.jsx";
import { CountryWorkforce } from "./CountryWorkforce.jsx";
import { UnitMembers } from "./UnitMembers.jsx";
import { branchCountryLabel, branchStateLabel } from "../branchRegions.js";
import { fetchAdminChurchesCatalog } from "../churchesCatalog.js";
import { statesFromCatalogAndChurches } from "../catalogGeoOptions.js";
import { satelliteSitesForCountry } from "../satelliteSites.js";
import {
  availableStatesForCountryAdmin,
  countStateBranchLeaders,
  isStateBranchLeader,
  occupiedStateCodes,
  stateLeaderLabel,
} from "../stateAdminForm.js";
import { readUsersSectionTab, writeUsersSectionTab } from "../usersSectionTab.js";
import { exportCsv } from "../exportCsv.js";
import { toastAfterAdminCreate } from "../adminInviteUi.js";

const ADMINS_PAGE_SIZE = 25;

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

function adminRoleLabel(admin) {
  if (admin.role === "state_super_admin") return "State Branch Admin";
  if (admin.role === "country_super_admin" && admin.branch_state) {
    return stateLeaderLabel({ kind: "country_hq", admin });
  }
  if (admin.role === "satellite_church_admin") return "Satellite Pastor Admin";
  return String(admin.role || "—");
}

function compareAdminsAlphabetical(a, b) {
  return String(a.full_name || "").localeCompare(String(b.full_name || ""), undefined, {
    sensitivity: "base",
  });
}

export function CountryUsers({ admins: adminsPayload, units, reload, setPage }) {
  const toast = useToast();
  const { admin: me } = useAdminAuth();
  const countryCode = String(me?.branch_country || "").toUpperCase();
  const countryLabel = branchCountryLabel(countryCode) || countryCode;

  const [sectionTab, setSectionTabRaw] = useState(() => {
    const tab = readUsersSectionTab();
    return tab === "members" ? "admins" : tab;
  });
  const setSectionTab = useCallback((tab) => {
    writeUsersSectionTab(tab);
    setSectionTabRaw(tab);
  }, []);

  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [roleFilter, setRoleFilter] = useState("all");
  const [filterState, setFilterState] = useState("");
  const [filterSatellite, setFilterSatellite] = useState("");
  const [adminsPage, setAdminsPage] = useState(1);
  const [stateModal, setStateModal] = useState(null);
  const [satelliteModal, setSatelliteModal] = useState(null);
  const [reassignOnly, setReassignOnly] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [actionMenu, setActionMenu] = useState({ id: null, anchor: null });
  const [churches, setChurches] = useState([]);
  const [catalog, setCatalog] = useState(null);
  const [workforceStats, setWorkforceStats] = useState({
    total: 0,
    unitLeaders: 0,
    subLeaders: 0,
  });
  const [memberTotal, setMemberTotal] = useState(0);

  const allAdmins = adminsPayload?.data ?? [];

  const countryAdmins = useMemo(
    () => allAdmins.filter((a) => String(a.branch_country || "").toUpperCase() === countryCode),
    [allAdmins, countryCode],
  );

  const stateBranchAdmins = useMemo(
    () => countryAdmins.filter((a) => isStateBranchLeader(a)),
    [countryAdmins],
  );

  const satellitePastors = useMemo(
    () => countryAdmins.filter((a) => a.role === "satellite_church_admin"),
    [countryAdmins],
  );

  /** State branch pastors + satellite pastors in this country (alphabetical list source). */
  const pastorAdmins = useMemo(() => {
    return countryAdmins
      .filter(
        (a) =>
          isStateBranchLeader(a) ||
          a.role === "satellite_church_admin",
      )
      .sort(compareAdminsAlphabetical);
  }, [countryAdmins]);

  const pastorAdminTotal = stateBranchAdmins.length + satellitePastors.length;

  const stateOptions = useMemo(
    () => statesFromCatalogAndChurches(catalog, countryCode, churches),
    [catalog, countryCode, churches],
  );

  const satelliteOptions = useMemo(
    () => satelliteSitesForCountry(churches, countryCode, filterState),
    [churches, countryCode, filterState],
  );

  useEffect(() => {
    fetchAdminChurchesCatalog().then(setChurches).catch(() => setChurches([]));
    api.catalogList().then(setCatalog).catch(() => setCatalog(null));
  }, []);

  useEffect(() => {
    setAdminsPage(1);
  }, [search, showInactive, roleFilter, filterState, filterSatellite]);

  useEffect(() => {
    if (!filterSatellite) return;
    if (!satelliteOptions.includes(filterSatellite)) {
      setFilterSatellite("");
    }
  }, [filterSatellite, satelliteOptions]);

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
    () => availableStatesForCountryAdmin(countryCode, countryAdmins, pendingRequests, null, { catalog, churches }),
    [countryCode, countryAdmins, pendingRequests, catalog, churches],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pastorAdmins.filter((a) => {
      if (!showInactive && Number(a.is_active) !== 1) return false;
      if (roleFilter === "state_super_admin" && !isStateBranchLeader(a)) return false;
      if (roleFilter === "satellite_church_admin" && a.role !== "satellite_church_admin") return false;
      if (filterState && String(a.branch_state || "").toUpperCase() !== filterState) return false;
      if (filterSatellite && String(a.satellite_site || "").trim() !== filterSatellite) return false;
      if (!q) return true;
      const loc = adminLocationLabel(a, countryCode);
      const hay = [a.full_name, a.username, a.email, loc, adminRoleLabel(a)].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [pastorAdmins, search, showInactive, roleFilter, filterState, filterSatellite, countryCode]);

  const adminsPagination = useMemo(() => {
    const total = filtered.length;
    const pages = Math.max(1, Math.ceil(total / ADMINS_PAGE_SIZE));
    const page = Math.min(adminsPage, pages);
    const start = (page - 1) * ADMINS_PAGE_SIZE;
    return {
      page,
      pages,
      total,
      rows: filtered.slice(start, start + ADMINS_PAGE_SIZE),
    };
  }, [filtered, adminsPage]);

  const bulk = useAdminTableBulk({
    rows: adminsPagination.rows,
    me,
    reload,
    bulkScope: { isCountryAdmin: true },
    noun: "admin",
  });

  const actionTarget = useMemo(
    () => pastorAdmins.find((a) => Number(a.id) === Number(actionMenu.id)),
    [pastorAdmins, actionMenu.id],
  );

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
      if (form.id) {
        await api.updateAdmin(form.id, payload);
        toastAfterAdminCreate(toast, { isEdit: true, updatedMessage: "State Branch Admin updated." });
      } else {
        const res = await api.createAdmin(payload);
        toastAfterAdminCreate(toast, { res, email: form.email, isEdit: false });
      }
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

  async function saveSatellitePastor(form, validationError) {
    if (validationError) {
      toast(validationError, "error");
      return;
    }
    if (!form) return;
    setSaving(true);
    try {
      const payload = { ...form, viewer: me };
      if (form.id) {
        await api.updateAdmin(form.id, payload);
        toastAfterAdminCreate(toast, { isEdit: true, updatedMessage: "Satellite Pastor Admin updated." });
      } else {
        const res = await api.createAdmin(payload);
        toastAfterAdminCreate(toast, { res, email: form.email, isEdit: false });
      }
      setSatelliteModal(null);
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
        { key: "role", label: "Role", format: (v, row) => adminRoleLabel(row) },
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
  const statesTotal = stateOptions.length;

  const menuItems = useMemo(() => {
    if (!actionTarget || !canCountryAdminManageRole(actionTarget.role)) return [];
    if (actionTarget.role === "state_super_admin") {
      return buildAdminRowMenuItems({
        row: actionTarget,
        includeReassign: true,
        onEdit: () => {
          closeActionMenu();
          setReassignOnly(false);
          setSatelliteModal(null);
          setStateModal(actionTarget);
        },
        onReassign: () => {
          closeActionMenu();
          setReassignOnly(true);
          setSatelliteModal(null);
          setStateModal(actionTarget);
        },
        onToggleActive: () => toggleActive(actionTarget),
        onDelete: () => deleteAdmin(actionTarget),
      });
    }
    return buildAdminRowMenuItems({
      row: actionTarget,
      includeReassign: true,
      onEdit: () => {
        closeActionMenu();
        setReassignOnly(false);
        setStateModal(null);
        setSatelliteModal(actionTarget);
      },
      onReassign: () => {
        closeActionMenu();
        setReassignOnly(true);
        setStateModal(null);
        setSatelliteModal(actionTarget);
      },
      onToggleActive: () => toggleActive(actionTarget),
      onDelete: () => deleteAdmin(actionTarget),
    });
  }, [actionTarget, actionTarget?.is_active]);

  const adminsMetaItems = [
    `Admins: ${pastorAdminTotal} total (${stateBranchAdmins.length} state branch · ${satellitePastors.length} satellite pastor${satellitePastors.length !== 1 ? "s" : ""})`,
    `${takenCount}/${statesTotal} states with a state branch admin`,
    vacantStates.length
      ? `${vacantStates.length} vacant state${vacantStates.length !== 1 ? "s" : ""}`
      : "All states covered",
  ];

  return (
    <>
      <header className="sa-users-page-head">
        <div className="sa-users-page-head-top">
          <h1 className="sa-admins-title">Members</h1>
          {sectionTab === "admins" ? (
            <div className="sa-users-page-actions">
              <button
                type="button"
                className="sa-btn sa-btn-outline sa-btn-sm"
                onClick={handleExport}
                disabled={!filtered.length}
              >
                Export CSV
              </button>
              <button
                type="button"
                className="sa-btn sa-btn-primary sa-btn-sm"
                onClick={() => {
                  setReassignOnly(false);
                  setSatelliteModal(null);
                  setStateModal({});
                }}
              >
                + New State Branch Admin
              </button>
            </div>
          ) : null}
        </div>
        <div className="sa-users-page-head-tabs">
          <UsersSectionTabs active={sectionTab} onChange={setSectionTab} showMembersTab />
        </div>
        {sectionTab === "admins" ? (
          <UsersPageMeta items={adminsMetaItems} />
        ) : sectionTab === "workforce" ? (
          <UsersPageMeta
            items={[
              `Workforce: ${workforceStats.total} total (${workforceStats.unitLeaders} service unit leader${workforceStats.unitLeaders !== 1 ? "s" : ""} · ${workforceStats.subLeaders} sub-unit leader${workforceStats.subLeaders !== 1 ? "s" : ""})`,
              "Across all states in your country",
            ]}
          />
        ) : sectionTab === "members" ? (
          <UsersPageMeta
            items={[
              `Unit members: ${memberTotal} approved across all satellite churches in ${countryLabel || "your country"}`,
            ]}
          />
        ) : null}
      </header>

      <UsersPendingQueue
        compact
        requests={pendingRequests}
        onOpenQueue={() => setPage?.("requests")}
      />

      {sectionTab === "workforce" ? (
        <CountryWorkforce embedded admins={adminsPayload} onStats={setWorkforceStats} />
      ) : sectionTab === "members" ? (
        <UnitMembers
          units={units}
          embedded
          countryGeo
          onMemberStats={({ total }) => setMemberTotal(total)}
        />
      ) : (
        <div className="sa-card">
          <div className="sa-admins-filters" role="toolbar" aria-label="Filter admins">
            <select className="sa-select" value={countryCode} disabled aria-label="Country">
              <option value={countryCode}>{countryLabel}</option>
            </select>
            <select
              className="sa-select"
              value={filterState}
              onChange={(e) => {
                setFilterState(e.target.value);
                setFilterSatellite("");
              }}
              aria-label="State / region"
            >
              <option value="">All states / regions</option>
              {stateOptions.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              className="sa-select"
              value={filterSatellite}
              onChange={(e) => setFilterSatellite(e.target.value)}
              disabled={satelliteOptions.length === 0}
              aria-label="Satellite church"
            >
              <option value="">All satellite churches</option>
              {satelliteOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <select
              className="sa-select"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              aria-label="Role"
            >
              <option value="all">All</option>
              <option value="state_super_admin">State branch</option>
              <option value="satellite_church_admin">Satellite pastor</option>
            </select>
            <div className="sa-search">
              <span className="sa-search-icon" aria-hidden>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
              <input
                type="search"
                placeholder="Search name, email, location…"
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
          </div>

          <p className="sa-text-sm sa-text-muted" style={{ margin: "0 0 12px", padding: "0 4px" }}>
            Sorted A–Z · showing {adminsPagination.total} of {pastorAdminTotal} admin
            {pastorAdminTotal !== 1 ? "s" : ""}
            {adminsPagination.pages > 1
              ? ` · page ${adminsPagination.page} of ${adminsPagination.pages}`
              : ""}
          </p>

          <TableBulkActionsBar
            selectedCount={bulk.selection.selectedCount}
            onClear={bulk.selection.clear}
            actions={bulk.bulkActions}
            busy={bulk.bulkBusy}
          />

          <div className="sa-table-wrap">
            {adminsPagination.rows.length === 0 ? (
              <div className="sa-empty">
                <div className="sa-empty-text">
                  {pastorAdmins.length === 0
                    ? "No state branch or satellite pastor admins in this country yet."
                    : "No accounts match your filters."}
                </div>
              </div>
            ) : (
              <table className="sa-table sa-table-admins-simple">
                <thead>
                  <tr>
                    {bulk.showBulkColumn ? (
                      <th className="sa-table-select-col">
                        <TableSelectCheckbox
                          checked={bulk.selection.allSelected}
                          indeterminate={bulk.selection.someSelected}
                          onChange={bulk.selection.toggleAll}
                          disabled={!bulk.selection.hasSelectableRows || bulk.bulkBusy}
                          ariaLabel="Select all admins on this page"
                        />
                      </th>
                    ) : null}
                    <th>Name of admin</th>
                    <th>Location</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {adminsPagination.rows.map((a) => {
                    const selectable = bulk.canSelectRow(a);
                    const marked = bulk.selection.isSelected(a.id);
                    return (
                    <tr key={a.id} className={marked ? "sa-row-selected" : undefined}>
                      {bulk.showBulkColumn ? (
                        <td className="sa-table-select-col">
                          {selectable ? (
                            <TableSelectCheckbox
                              checked={marked}
                              onChange={() => bulk.selection.toggle(a.id)}
                              disabled={bulk.bulkBusy}
                              ariaLabel={`Select ${a.full_name || "admin"}`}
                            />
                          ) : null}
                        </td>
                      ) : null}
                      <td>
                        <div className="sa-fw-600">{a.full_name}</div>
                        <AdminLoginMeta username={a.username} email={a.email} />
                      </td>
                      <td className="sa-text-sm">{adminLocationLabel(a, countryCode)}</td>
                      <td className="sa-text-sm">{adminRoleLabel(a)}</td>
                      <td>
                        <span className={`sa-badge ${Number(a.is_active) === 1 ? "active" : "inactive"}`}>
                          {Number(a.is_active) === 1 ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>
                        {canCountryAdminManageRole(a.role) ? (
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

          {adminsPagination.pages > 1 ? (
            <div className="sa-pagination">
              <span>
                Page {adminsPagination.page} of {adminsPagination.pages} ({adminsPagination.total} admins)
              </span>
              <div className="sa-pag-btns">
                <button
                  type="button"
                  className="sa-pag-btn"
                  disabled={adminsPagination.page <= 1}
                  onClick={() => setAdminsPage((p) => Math.max(1, p - 1))}
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="sa-pag-btn"
                  disabled={adminsPagination.page >= adminsPagination.pages}
                  onClick={() => setAdminsPage((p) => Math.min(adminsPagination.pages, p + 1))}
                >
                  ›
                </button>
              </div>
            </div>
          ) : null}
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
        reassignOnly={reassignOnly && !!stateModal?.id}
      />

      <SatellitePastorAdminModal
        open={!!satelliteModal}
        countryCode={countryCode}
        stateCode={satelliteModal?.branch_state || ""}
        churches={churches}
        existingAdmins={countryAdmins}
        pendingRequests={pendingRequests}
        initialSatellite={satelliteModal?.initialSatellite || satelliteModal?.satellite_site || ""}
        editData={satelliteModal?.id ? satelliteModal : null}
        saving={saving}
        reassignOnly={reassignOnly && !!satelliteModal?.id}
        onClose={() => {
          setSatelliteModal(null);
          setReassignOnly(false);
        }}
        onSave={saveSatellitePastor}
      />
    </>
  );
}
