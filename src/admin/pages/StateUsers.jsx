import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { useAdminAuth } from "../AdminContext.jsx";
import { useToast } from "../components/Toast.jsx";
import { SatellitePastorAdminModal } from "../components/SatellitePastorAdminModal.jsx";
import { AdminRowActionsMenu, AdminRowActionsTrigger } from "../components/AdminRowActionsMenu.jsx";
import { buildAdminRowMenuItems, isAdminActive, nextAdminActiveValue } from "../components/adminRowMenuItems.js";
import { UsersPendingQueue } from "../components/UsersPendingQueue.jsx";
import { UsersPageMeta } from "../components/UsersPageMeta.jsx";
import { UsersSectionTabs } from "../components/UsersSectionTabs.jsx";
import { StateWorkforce } from "./StateWorkforce.jsx";
import { branchCountryLabel, branchStateLabel } from "../branchRegions.js";
import { fetchChurchesCatalog } from "../../lib/churchesCatalog.js";
import { satelliteSitesForBranch } from "../satelliteSites.js";
import { availableSatellitesForState } from "../stateSatelliteForm.js";
import { exportCsv } from "../exportCsv.js";

function satelliteLocationLabel(admin, stateLabel, countryLabel) {
  const sat = String(admin.satellite_site || "").trim();
  if (sat && stateLabel) return `${sat} · ${stateLabel}`;
  if (sat) return sat;
  if (stateLabel && countryLabel) return `${stateLabel}, ${countryLabel}`;
  return stateLabel || countryLabel || "—";
}

export function StateUsers({ admins: adminsPayload, reload, setPage }) {
  const toast = useToast();
  const { admin: me } = useAdminAuth();
  const countryCode = String(me?.branch_country || "").toUpperCase();
  const stateCode = String(me?.branch_state || "").toUpperCase();
  const countryLabel = branchCountryLabel(countryCode);
  const stateLabel = branchStateLabel(countryCode, stateCode) || stateCode;

  const [sectionTab, setSectionTab] = useState("admins");
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [satelliteModal, setSatelliteModal] = useState(null);
  const [reassignOnly, setReassignOnly] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [churches, setChurches] = useState([]);
  const [actionMenu, setActionMenu] = useState({ id: null, anchor: null });

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
    () => stateAdmins.filter((a) => a.role === "satellite_church_admin"),
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
    fetchChurchesCatalog().then(setChurches).catch(() => setChurches([]));
  }, []);

  const satellitesInDataset = useMemo(
    () => satelliteSitesForBranch(churches, countryCode, stateCode),
    [churches, countryCode, stateCode],
  );

  const vacantSatellites = useMemo(
    () => availableSatellitesForState(churches, countryCode, stateCode, stateAdmins, pendingRequests),
    [churches, countryCode, stateCode, stateAdmins, pendingRequests],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return satellitePastors.filter((a) => {
      if (!showInactive && Number(a.is_active) !== 1) return false;
      if (!q) return true;
      const loc = satelliteLocationLabel(a, stateLabel, countryLabel);
      const hay = [a.full_name, a.username, a.email, loc].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [satellitePastors, search, showInactive, stateLabel, countryLabel]);

  const actionTarget = useMemo(
    () => satellitePastors.find((a) => Number(a.id) === Number(actionMenu.id)),
    [satellitePastors, actionMenu.id],
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

  function goAssignVacant(satelliteName) {
    setSectionTab("admins");
    setReassignOnly(false);
    setSatelliteModal({ initialSatellite: satelliteName });
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
      if (form.id) await api.updateAdmin(form.id, payload);
      else await api.createAdmin(payload);
      toast(form.id ? "Satellite Pastor Admin updated." : "Satellite Pastor Admin created.", "success");
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
  }, [actionTarget, actionTarget?.is_active]);

  const activePastorCount = satellitePastors.filter((a) => Number(a.is_active) === 1).length;
  const satellitesTotal = satellitesInDataset?.length ?? 0;

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
              {vacantSatellites.length > 0 ? (
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
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="sa-users-page-head-tabs">
          <UsersSectionTabs active={sectionTab} onChange={setSectionTab} />
        </div>
        <UsersPageMeta
          items={[
            `${activePastorCount} active pastor admin${activePastorCount !== 1 ? "s" : ""}`,
            satellitesTotal ? `${satellitesTotal - vacantSatellites.length}/${satellitesTotal} satellites covered` : null,
            vacantSatellites.length
              ? `${vacantSatellites.length} vacant satellite${vacantSatellites.length !== 1 ? "s" : ""}`
              : satellitesTotal
                ? "All satellites covered"
                : null,
          ]}
        />
      </header>

      <UsersPendingQueue compact requests={pendingRequests} onOpenQueue={() => setPage?.("oversight")} />

      {sectionTab === "workforce" ? (
        <StateWorkforce
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
                  {satellitePastors.length === 0
                    ? "No Satellite Pastor Admins yet."
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
                        {Number(a.is_active) !== 1 ? (
                          <span className="sa-badge inactive" style={{ marginTop: 6 }}>
                            Inactive
                          </span>
                        ) : null}
                      </td>
                      <td className="sa-text-sm">{satelliteLocationLabel(a, stateLabel, countryLabel)}</td>
                      <td>
                        <AdminRowActionsTrigger onOpen={(e) => openActions(e, a)} label="Action" />
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
    </>
  );
}
