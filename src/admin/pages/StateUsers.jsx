import { useCallback, useEffect, useMemo, useState } from "react";
import { readUsersSectionTab, writeUsersSectionTab } from "../usersSectionTab.js";
import { api } from "../api.js";
import { useAdminAuth } from "../AdminContext.jsx";
import { useToast } from "../components/Toast.jsx";
import { AdminLoginMeta } from "../components/AdminLoginMeta.jsx";
import { SatellitePastorAdminModal } from "../components/SatellitePastorAdminModal.jsx";
import { AdminRowActionsMenu, AdminRowActionsTrigger } from "../components/AdminRowActionsMenu.jsx";
import { buildAdminRowMenuItems, isAdminActive, nextAdminActiveValue } from "../components/adminRowMenuItems.js";
import { UsersPendingQueue } from "../components/UsersPendingQueue.jsx";
import { UsersPageMeta } from "../components/UsersPageMeta.jsx";
import { UsersSectionTabs } from "../components/UsersSectionTabs.jsx";
import { StateWorkforce } from "./StateWorkforce.jsx";
import { UnitMembers } from "./UnitMembers.jsx";
import { WorkforceLeaderModal } from "../components/WorkforceLeaderModal.jsx";
import { branchCountryLabel, branchStateLabel } from "../branchRegions.js";
import { countryAdminHomeState, isCountrySuperAdmin } from "../roles.js";
import { adminApiScopeParams, isActingAsStateAdmin } from "../adminViewMode.js";
import { fetchAdminChurchesCatalog } from "../churchesCatalog.js";
import { satelliteSitesForBranch } from "../satelliteSites.js";
import { availableSatellitesForState } from "../stateSatelliteForm.js";
import { exportCsv } from "../exportCsv.js";
import { toastAfterAdminCreate } from "../adminInviteUi.js";

const ADMINS_PAGE_SIZE = 25;

function compareAdminsAlphabetical(a, b) {
  return String(a.full_name || "").localeCompare(String(b.full_name || ""), undefined, {
    sensitivity: "base",
  });
}

function satelliteLocationLabel(admin, stateLabel, countryLabel) {
  const sat = String(admin.satellite_site || "").trim();
  if (sat && stateLabel) return `${sat} · ${stateLabel}`;
  if (sat) return sat;
  if (stateLabel && countryLabel) return `${stateLabel}, ${countryLabel}`;
  return stateLabel || countryLabel || "—";
}

export function StateUsers({ admins: adminsPayload, units, reload, setPage }) {
  const toast = useToast();
  const { admin: me, viewMode } = useAdminAuth();
  const actingAsState = isActingAsStateAdmin(me, viewMode);
  const countryCode = String(me?.branch_country || "").toUpperCase();
  const stateCode = String(
    isCountrySuperAdmin(me?.role) && actingAsState
      ? countryAdminHomeState(me) || me?.branch_state
      : me?.branch_state || "",
  ).toUpperCase();
  const countryLabel = branchCountryLabel(countryCode);
  const stateLabel = branchStateLabel(countryCode, stateCode) || stateCode;

  const [sectionTab, setSectionTabRaw] = useState(() => readUsersSectionTab());
  const setSectionTab = useCallback((tab) => {
    writeUsersSectionTab(tab);
    setSectionTabRaw(tab);
  }, []);
  const [search, setSearch] = useState("");
  const [filterSatellite, setFilterSatellite] = useState("");
  const [adminsPage, setAdminsPage] = useState(1);
  const [showInactive, setShowInactive] = useState(false);
  const [workforceStats, setWorkforceStats] = useState({ total: 0, unitLeaders: 0, subLeaders: 0 });
  const [memberTotal, setMemberTotal] = useState(0);
  const [satelliteModal, setSatelliteModal] = useState(null);
  const [reassignOnly, setReassignOnly] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [churches, setChurches] = useState([]);
  const [actionMenu, setActionMenu] = useState({ id: null, anchor: null, scope: "admins" });
  const [leaderModal, setLeaderModal] = useState(null);

  const allAdmins = adminsPayload?.data ?? [];

  const stateAdmins = useMemo(
    () =>
      allAdmins.filter(
        (a) =>
          String(a.branch_country || "").toUpperCase() === countryCode &&
          String(a.branch_state || "").toUpperCase() === stateCode,
      ),
    [allAdmins, countryCode, stateCode],
  );

  const satellitePastors = useMemo(
    () =>
      stateAdmins
        .filter((a) => a.role === "satellite_church_admin")
        .sort(compareAdminsAlphabetical),
    [stateAdmins],
  );

  const workforceLeaders = useMemo(
    () => stateAdmins.filter((a) => ["service_unit_leader", "sub_unit_leader"].includes(a.role)),
    [stateAdmins],
  );

  const loadPending = useCallback(() => {
    api
      .requests({ per_page: 200, page: 1 })
      .then((res) => setPendingRequests(res.data || []))
      .catch(() => setPendingRequests([]));
  }, []);

  useEffect(() => {
    loadPending();
  }, [loadPending, adminsPayload]);

  useEffect(() => {
    fetchAdminChurchesCatalog().then(setChurches).catch(() => setChurches([]));
  }, []);

  const satellitesInDataset = useMemo(
    () => satelliteSitesForBranch(churches, countryCode, stateCode),
    [churches, countryCode, stateCode],
  );

  const vacantSatellites = useMemo(
    () => availableSatellitesForState(churches, countryCode, stateCode, stateAdmins, pendingRequests),
    [churches, countryCode, stateCode, stateAdmins, pendingRequests],
  );

  useEffect(() => {
    setAdminsPage(1);
  }, [search, showInactive, filterSatellite]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return satellitePastors.filter((a) => {
      if (!showInactive && Number(a.is_active) !== 1) return false;
      if (filterSatellite && String(a.satellite_site || "").trim() !== filterSatellite) return false;
      if (!q) return true;
      const loc = satelliteLocationLabel(a, stateLabel, countryLabel);
      const hay = [a.full_name, a.username, a.email, a.satellite_site, loc].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [satellitePastors, search, showInactive, filterSatellite, stateLabel, countryLabel]);

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

  const actionTarget = useMemo(() => {
    if (actionMenu.scope === "workforce") {
      return workforceLeaders.find((a) => Number(a.id) === Number(actionMenu.id));
    }
    return satellitePastors.find((a) => Number(a.id) === Number(actionMenu.id));
  }, [actionMenu.scope, actionMenu.id, workforceLeaders, satellitePastors]);

  function closeActionMenu() {
    setActionMenu({ id: null, anchor: null, scope: "admins" });
  }

  function openAdminActions(e, row) {
    e.stopPropagation();
    if (actionMenu.id === row.id && actionMenu.scope === "admins") {
      closeActionMenu();
      return;
    }
    setActionMenu({ id: row.id, anchor: e.currentTarget, scope: "admins" });
  }

  function openWorkforceActions(e, row) {
    e.stopPropagation();
    if (actionMenu.id === row.id && actionMenu.scope === "workforce") {
      closeActionMenu();
      return;
    }
    setActionMenu({ id: row.id, anchor: e.currentTarget, scope: "workforce" });
  }

  async function saveWorkforceLeader(form, validationError) {
    if (validationError) {
      toast(validationError, "error");
      return;
    }
    if (!form) return;
    setSaving(true);
    try {
      const payload = { ...form, viewer: me, ...adminApiScopeParams(me) };
      if (form.id) {
        await api.updateAdmin(form.id, payload);
        toastAfterAdminCreate(toast, { isEdit: true, updatedMessage: "Workforce leader updated." });
      } else {
        const res = await api.createAdmin(payload);
        toastAfterAdminCreate(toast, { res, email: form.email, isEdit: false });
      }
      setLeaderModal(null);
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
      const payload = { ...form, viewer: me, ...adminApiScopeParams(me) };
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
    if (!window.confirm(`Delete ${row.full_name}? This cannot be undone.`)) return;
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
      filename: `satellite-pastor-admins-${stateCode}-${new Date().toISOString().slice(0, 10)}.csv`,
      columns: [
        { key: "full_name", label: "Name of admin" },
        {
          key: "satellite_site",
          label: "Location of admin",
          format: (v, row) => satelliteLocationLabel(row, stateLabel, countryLabel),
        },
        { key: "is_active", label: "Status", format: (v) => (Number(v) === 1 ? "Active" : "Inactive") },
      ],
    });
    toast(`Exported ${filtered.length} record${filtered.length !== 1 ? "s" : ""}.`, "success");
  }

  const menuItems = useMemo(() => {
    if (!actionTarget) return [];
    if (actionMenu.scope === "workforce") {
      return buildAdminRowMenuItems({
        row: actionTarget,
        includeReassign: false,
        onEdit: () => {
          closeActionMenu();
          setLeaderModal(actionTarget);
        },
        onToggleActive: () => toggleActive(actionTarget),
        onDelete: () => deleteAdmin(actionTarget),
      });
    }
    return buildAdminRowMenuItems({
      row: actionTarget,
      includeReassign: true,
      onEdit: () => {
        setReassignOnly(false);
        setSatelliteModal(actionTarget);
      },
      onReassign: () => {
        setReassignOnly(true);
        setSatelliteModal(actionTarget);
      },
      onToggleActive: () => toggleActive(actionTarget),
      onDelete: () => deleteAdmin(actionTarget),
    });
  }, [actionTarget, actionTarget?.is_active, actionMenu.scope]);

  const satellitesTotal = satellitesInDataset?.length ?? 0;
  const pastorTotal = satellitePastors.length;

  if (!stateCode) {
    return (
      <div className="sa-card" style={{ marginTop: 8 }}>
        <div className="sa-empty" style={{ padding: "32px 24px" }}>
          <div className="sa-empty-text" style={{ maxWidth: 480, margin: "0 auto", lineHeight: 1.5 }}>
            <strong>Headquarters state required</strong>
            <p style={{ margin: "12px 0 0" }}>
              Set your headquarters state in Profile / Settings before using the State Branch Admin view.
            </p>
          </div>
          <button
            type="button"
            className="sa-btn sa-btn-primary sa-btn-sm"
            style={{ marginTop: 16 }}
            onClick={() => setPage?.("profile")}
          >
            Open Profile / Settings
          </button>
        </div>
      </div>
    );
  }

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
              <button
                type="button"
                className="sa-btn sa-btn-primary sa-btn-sm"
                onClick={() => {
                  setReassignOnly(false);
                  setSatelliteModal({});
                }}
              >
                + New Satellite Pastor Admin
              </button>
            </div>
          ) : sectionTab === "workforce" ? (
            <div className="sa-users-page-actions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className="sa-btn sa-btn-primary sa-btn-sm"
                onClick={() => setLeaderModal({ initialRole: "service_unit_leader" })}
              >
                + New Service Unit Leader
              </button>
              <button
                type="button"
                className="sa-btn sa-btn-outline sa-btn-sm"
                onClick={() => setLeaderModal({ initialRole: "sub_unit_leader" })}
              >
                + New Sub-Unit Leader
              </button>
            </div>
          ) : null}
        </div>
        <div className="sa-users-page-head-tabs">
          <UsersSectionTabs active={sectionTab} onChange={setSectionTab} showMembersTab />
        </div>
        {sectionTab === "admins" ? (
          <UsersPageMeta
            items={[
              `Admins: ${pastorTotal} satellite pastor${pastorTotal !== 1 ? "s" : ""} in ${stateLabel || "your state"}`,
              satellitesTotal
                ? `${satellitesTotal - vacantSatellites.length}/${satellitesTotal} satellites covered`
                : null,
            ]}
          />
        ) : sectionTab === "workforce" ? (
          <UsersPageMeta
            items={[
              `Workforce: ${workforceStats.total} total (${workforceStats.unitLeaders} service unit · ${workforceStats.subLeaders} sub-unit)`,
              `All leaders in ${stateLabel || "your state"}`,
            ]}
          />
        ) : sectionTab === "members" ? (
          <UsersPageMeta
            items={[
              `Unit members: ${memberTotal} approved across satellite churches in ${stateLabel || "your state"}`,
            ]}
          />
        ) : null}
      </header>

      <UsersPendingQueue compact requests={pendingRequests} onOpenQueue={() => setPage?.("requests")} />

      {sectionTab === "workforce" ? (
        <StateWorkforce
          embedded
          admins={adminsPayload}
          units={units}
          actionMenu={actionMenu}
          onOpenActions={openWorkforceActions}
          onCloseActionMenu={closeActionMenu}
          menuItems={menuItems}
          onStats={setWorkforceStats}
        />
      ) : sectionTab === "members" ? (
        <UnitMembers
          units={units}
          embedded
          stateGeo
          stateCode={stateCode}
          onMemberStats={({ total }) => setMemberTotal(total)}
        />
      ) : (
        <div className="sa-card">
          <div className="sa-admins-filters" role="toolbar" aria-label="Filter admins">
            <select
              className="sa-select"
              value={filterSatellite}
              onChange={(e) => setFilterSatellite(e.target.value)}
              aria-label="Satellite church"
            >
              <option value="">All satellite churches</option>
              {satellitesInDataset.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
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
                placeholder="Search name, email, satellite…"
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
            Sorted A–Z · showing {adminsPagination.total} of {pastorTotal} pastor{pastorTotal !== 1 ? "s" : ""}
            {adminsPagination.pages > 1
              ? ` · page ${adminsPagination.page} of ${adminsPagination.pages}`
              : ""}
          </p>

          <div className="sa-table-wrap">
            {adminsPagination.rows.length === 0 ? (
              <div className="sa-empty">
                <div className="sa-empty-text">
                  {!stateCode
                    ? "Set your headquarters state before managing satellite pastors."
                    : satellitePastors.length === 0
                      ? "No Satellite Pastor Admins in this state yet."
                      : "No accounts match your filters."}
                </div>
              </div>
            ) : (
              <table className="sa-table sa-table-admins-simple">
                <thead>
                  <tr>
                    <th>Name of admin</th>
                    <th>Satellite church</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {adminsPagination.rows.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <div className="sa-fw-600">{a.full_name}</div>
                        <AdminLoginMeta username={a.username} email={a.email} />
                      </td>
                      <td className="sa-text-sm">
                        {String(a.satellite_site || "").trim() || "—"}
                      </td>
                      <td>
                        <span className={`sa-badge ${Number(a.is_active) === 1 ? "active" : "inactive"}`}>
                          {Number(a.is_active) === 1 ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>
                        <AdminRowActionsTrigger onOpen={(e) => openAdminActions(e, a)} label="Action" />
                      </td>
                    </tr>
                  ))}
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

      {sectionTab === "admins" ? (
        <AdminRowActionsMenu
          open={!!actionMenu.id && actionMenu.scope === "admins"}
          anchorEl={actionMenu.anchor}
          onClose={closeActionMenu}
          items={menuItems}
        />
      ) : null}

      <SatellitePastorAdminModal
        open={!!satelliteModal}
        countryCode={countryCode}
        stateCode={stateCode}
        churches={churches}
        existingAdmins={stateAdmins}
        pendingRequests={pendingRequests}
        initialSatellite={satelliteModal?.initialSatellite || satelliteModal?.satellite_site || ""}
        editData={satelliteModal?.id ? satelliteModal : null}
        saving={saving}
        reassignOnly={reassignOnly}
        onClose={() => {
          setSatelliteModal(null);
          setReassignOnly(false);
        }}
        onSave={saveSatellitePastor}
      />

      <WorkforceLeaderModal
        open={!!leaderModal}
        countryCode={countryCode}
        stateCode={stateCode}
        churches={churches}
        units={units?.data || []}
        initialRole={leaderModal?.initialRole || leaderModal?.role || "service_unit_leader"}
        editData={leaderModal?.id ? leaderModal : null}
        saving={saving}
        onClose={() => setLeaderModal(null)}
        onSave={saveWorkforceLeader}
      />
    </>
  );
}
