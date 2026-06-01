import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { useAdminAuth } from "../AdminContext.jsx";
import { useToast } from "../components/Toast.jsx";
import { StateBranchAdminModal } from "../components/StateBranchAdminModal.jsx";
import { AdminRowActionsMenu, AdminRowActionsTrigger } from "../components/AdminRowActionsMenu.jsx";
import { buildAdminRowMenuItems, isAdminActive, nextAdminActiveValue } from "../components/adminRowMenuItems.js";
import { UsersPendingQueue } from "../components/UsersPendingQueue.jsx";
import { UsersPageMeta } from "../components/UsersPageMeta.jsx";
import { CountryAdminHqSettings } from "../components/CountryAdminHqSettings.jsx";
import { UsersSectionTabs } from "../components/UsersSectionTabs.jsx";
import { CountryWorkforce } from "./CountryWorkforce.jsx";
import { branchCountryLabel, branchStateLabel, branchStatesForCountry } from "../branchRegions.js";
import { countryAdminHomeState } from "../roles.js";
import {
  availableHomeStatesForCountryAdmin,
  availableStatesForCountryAdmin,
  occupiedStateCodes,
} from "../stateAdminForm.js";
import { exportCsv } from "../exportCsv.js";

function adminLocationLabel(admin, countryCode) {
  const cc = branchCountryLabel(admin.branch_country || countryCode);
  if (admin.role === "country_super_admin") {
    const hq = branchStateLabel(admin.branch_country || countryCode, admin.branch_state);
    return hq ? `${hq} (HQ) · ${cc || countryCode}` : cc ? `${cc} — National oversight` : "National oversight";
  }
  const st = branchStateLabel(admin.branch_country || countryCode, admin.branch_state);
  if (st && cc) return `${st}, ${cc}`;
  return st || cc || "—";
}

export function CountryUsers({ admins: adminsPayload, reload, setPage }) {
  const toast = useToast();
  const { admin: me, refreshAdmin } = useAdminAuth();
  const countryCode = String(me?.branch_country || "").toUpperCase();
  const countryLabel = branchCountryLabel(countryCode);
  const myHomeState = countryAdminHomeState(me);

  const [sectionTab, setSectionTab] = useState("admins");
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [stateModal, setStateModal] = useState(null);
  const [reassignOnly, setReassignOnly] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingHome, setSavingHome] = useState(false);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [homeStateDraft, setHomeStateDraft] = useState(myHomeState);
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

  /** Country Admin (you) first, then State Branch Admins in this country. */
  const countryAdminSelf = useMemo(() => {
    if (me?.role !== "country_super_admin") return null;
    return countryAdmins.find((a) => Number(a.id) === Number(me?.id)) || me;
  }, [countryAdmins, me]);

  const managedAdmins = useMemo(() => {
    const others = stateBranchAdmins
      .filter((a) => !countryAdminSelf || Number(a.id) !== Number(countryAdminSelf.id))
      .sort((a, b) => String(a.full_name || "").localeCompare(String(b.full_name || ""), undefined, { sensitivity: "base" }));
    return countryAdminSelf ? [countryAdminSelf, ...others] : others;
  }, [countryAdminSelf, stateBranchAdmins]);

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
    setHomeStateDraft(myHomeState);
  }, [myHomeState]);

  const vacantStates = useMemo(
    () => availableStatesForCountryAdmin(countryCode, countryAdmins, pendingRequests),
    [countryCode, countryAdmins, pendingRequests],
  );

  const homeStateOptions = useMemo(
    () => availableHomeStatesForCountryAdmin(countryCode, countryAdmins, pendingRequests, me?.id),
    [countryCode, countryAdmins, pendingRequests, me?.id],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return managedAdmins.filter((a) => {
      if (!showInactive && Number(a.is_active) !== 1) return false;
      if (!q) return true;
      const loc = adminLocationLabel(a, countryCode);
      const hay = [a.full_name, a.username, a.email, loc, a.role === "country_super_admin" ? "country admin default" : ""]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [managedAdmins, search, showInactive, countryCode]);

  const actionTarget = useMemo(
    () => managedAdmins.find((a) => Number(a.id) === Number(actionMenu.id)),
    [managedAdmins, actionMenu.id],
  );

  const isSelfRow = (row) => countryAdminSelf && Number(row?.id) === Number(countryAdminSelf.id);

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

  function goAssignVacant(stateCode) {
    setSectionTab("admins");
    setReassignOnly(false);
    setStateModal({ initialState: stateCode });
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
    if (
      !window.confirm(
        `Delete ${row.full_name}? This cannot be undone.`,
      )
    ) {
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

  async function saveHomeState() {
    setSavingHome(true);
    try {
      await api.updateAdmin(me.id, { branch_state: homeStateDraft || "", viewer: me });
      await refreshAdmin?.();
      toast(homeStateDraft ? "Headquarters state saved." : "Headquarters state cleared.", "success");
      reload?.();
      loadPending();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setSavingHome(false);
    }
  }

  function handleExport() {
    if (!filtered.length) {
      toast("No records to export.", "error");
      return;
    }
    exportCsv(filtered, {
      filename: `state-branch-admins-${countryCode}-${new Date().toISOString().slice(0, 10)}.csv`,
      columns: [
        { key: "full_name", label: "Name of admin" },
        {
          key: "branch_state",
          label: "Location of admin",
          format: (v, row) => adminLocationLabel(row, countryCode),
        },
        { key: "is_active", label: "Status", format: (v) => (Number(v) === 1 ? "Active" : "Inactive") },
      ],
    });
    toast(`Exported ${filtered.length} record${filtered.length !== 1 ? "s" : ""}.`, "success");
  }

  const takenCount = occupiedStateCodes(countryAdmins, pendingRequests, countryCode).size;
  const statesTotal = branchStatesForCountry(countryCode).length;

  const menuItems = useMemo(() => {
    if (!actionTarget || isSelfRow(actionTarget) || actionTarget.role !== "state_super_admin") {
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
  }, [actionTarget, actionTarget?.is_active, countryAdminSelf, me?.id]);

  const activeStateAdminCount = stateBranchAdmins.filter((a) => Number(a.is_active) === 1).length;

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
              {vacantStates.length > 0 ? (
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
        <UsersPageMeta
          items={[
            `${activeStateAdminCount} active state admin${activeStateAdminCount !== 1 ? "s" : ""}`,
            `${takenCount}/${statesTotal} states covered`,
            vacantStates.length
              ? `${vacantStates.length} vacant state${vacantStates.length !== 1 ? "s" : ""}`
              : "All states covered",
          ]}
        />
      </header>

      <UsersPendingQueue
        compact
        requests={pendingRequests}
        onOpenQueue={() => setPage?.("oversight")}
      />

      {sectionTab === "workforce" ? (
        <CountryWorkforce
          embedded
          admins={adminsPayload}
          reload={reload}
          onAssignVacant={goAssignVacant}
        />
      ) : (
        <div className="sa-card">
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
                placeholder="Search name or location…"
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
                    ? "No administrators in this country yet."
                    : "No accounts match your filters."}
                </div>
              </div>
            ) : (
              <table className="sa-table sa-table-admins-simple">
                <thead>
                  <tr>
                    <th>Name of admin</th>
                    <th>Location of admin</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <div className="sa-fw-600">{a.full_name}</div>
                        <div className="sa-text-sm sa-text-muted">{a.username}</div>
                        {isSelfRow(a) ? (
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
                        {isSelfRow(a) || a.role !== "state_super_admin" ? (
                          <span className="sa-text-muted sa-text-sm">—</span>
                        ) : (
                          <AdminRowActionsTrigger onOpen={(e) => openActions(e, a)} label="Action" />
                        )}
                      </td>
                    </tr>
                  ))}
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

      <CountryAdminHqSettings
        countryCode={countryCode}
        homeStateDraft={homeStateDraft}
        homeStateOptions={homeStateOptions}
        myHomeState={myHomeState}
        savingHome={savingHome}
        onChangeHomeState={setHomeStateDraft}
        onSave={saveHomeState}
      />
    </>
  );
}
