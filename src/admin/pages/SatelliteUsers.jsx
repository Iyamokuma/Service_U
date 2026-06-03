import { useCallback, useEffect, useMemo, useState } from "react";
import { readUsersSectionTab, writeUsersSectionTab } from "../usersSectionTab.js";
import { api } from "../api.js";
import { useAdminAuth } from "../AdminContext.jsx";
import { useToast } from "../components/Toast.jsx";
import { AdminRowActionsMenu } from "../components/AdminRowActionsMenu.jsx";
import { buildAdminRowMenuItems, isAdminActive, nextAdminActiveValue } from "../components/adminRowMenuItems.js";
import { UsersPendingQueue } from "../components/UsersPendingQueue.jsx";
import { UsersPageMeta } from "../components/UsersPageMeta.jsx";
import { UsersSectionTabs } from "../components/UsersSectionTabs.jsx";
import { SatelliteChurchLeaders } from "./SatelliteChurchLeaders.jsx";
import { UnitMembers } from "./UnitMembers.jsx";
import { WorkforceLeaderModal } from "../components/WorkforceLeaderModal.jsx";
import { readStateWorkforceContext } from "../countryUsersContext.js";
import { branchCountryLabel, branchStateLabel } from "../branchRegions.js";
import { fetchChurchesCatalog } from "../../lib/churchesCatalog.js";

export function SatelliteUsers({ admins: adminsPayload, units, reload, setPage }) {
  const toast = useToast();
  const { admin: me } = useAdminAuth();
  const countryCode = String(me?.branch_country || "").toUpperCase();
  const stateCode = String(me?.branch_state || "").toUpperCase();
  const satelliteSite = String(me?.satellite_site || "").trim();
  const countryLabel = branchCountryLabel(countryCode);
  const stateLabel = branchStateLabel(countryCode, stateCode) || stateCode;

  const [sectionTab, setSectionTabRaw] = useState(() => readUsersSectionTab());
  const setSectionTab = useCallback((tab) => {
    writeUsersSectionTab(tab);
    setSectionTabRaw(tab);
  }, []);
  const [saving, setSaving] = useState(false);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [churches, setChurches] = useState([]);
  const [actionMenu, setActionMenu] = useState({ id: null, anchor: null });
  const [leaderModal, setLeaderModal] = useState(null);
  const [memberTotal, setMemberTotal] = useState(null);

  const churchLeaders = useMemo(() => {
    return (adminsPayload?.data ?? []).filter(
      (a) =>
        String(a.branch_country || "").toUpperCase() === countryCode &&
        String(a.branch_state || "").toUpperCase() === stateCode &&
        String(a.satellite_site || "").trim() === satelliteSite &&
        ["service_unit_leader", "sub_unit_leader"].includes(a.role),
    );
  }, [adminsPayload, countryCode, stateCode, satelliteSite]);

  const unitLeaderCount = churchLeaders.filter((a) => a.role === "service_unit_leader").length;
  const subLeaderCount = churchLeaders.filter((a) => a.role === "sub_unit_leader").length;
  const workforceContext = readStateWorkforceContext();

  const loadPending = useCallback(() => {
    api
      .requests({ per_page: 200, page: 1 })
      .then((res) => setPendingRequests(res.data || []))
      .catch(() => setPendingRequests([]));
  }, []);

  const loadMemberCount = useCallback(() => {
    api
      .members({ page: 1, per_page: 1, viewer: me })
      .then((res) => setMemberTotal(res.pagination?.total ?? 0))
      .catch(() => setMemberTotal(null));
  }, [me]);

  useEffect(() => {
    loadPending();
    loadMemberCount();
  }, [loadPending, loadMemberCount, adminsPayload]);

  useEffect(() => {
    fetchChurchesCatalog().then(setChurches).catch(() => setChurches([]));
  }, []);

  const actionTarget = useMemo(
    () => churchLeaders.find((a) => Number(a.id) === Number(actionMenu.id)),
    [actionMenu.id, churchLeaders],
  );

  function closeActionMenu() {
    setActionMenu({ id: null, anchor: null });
  }

  function openLeaderActions(e, row) {
    e.stopPropagation();
    if (actionMenu.id === row.id) {
      closeActionMenu();
      return;
    }
    setActionMenu({ id: row.id, anchor: e.currentTarget });
  }

  async function saveWorkforceLeader(form, validationError) {
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
      toast(
        form.id
          ? "Leader updated."
          : `${form.role === "sub_unit_leader" ? "Sub-unit" : "Service unit"} leader created.`,
        "success",
      );
      setLeaderModal(null);
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

  const menuItems = useMemo(() => {
    if (!actionTarget) return [];
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
  }, [actionTarget, actionTarget?.is_active]);

  return (
    <>
      <header className="sa-users-page-head">
        <div className="sa-users-page-head-top">
          <h1 className="sa-admins-title">Users</h1>
          {sectionTab === "admins" ? (
            <div className="sa-users-page-actions">
              <button
                type="button"
                className="sa-btn sa-btn-primary sa-btn-sm"
                onClick={() =>
                  setLeaderModal({
                    initialRole:
                      workforceContext === "sub_unit_leader"
                        ? "sub_unit_leader"
                        : "service_unit_leader",
                  })
                }
              >
                {workforceContext === "sub_unit_leader"
                  ? "+ New Sub-Unit Leader"
                  : "+ New Service Unit Leader"}
              </button>
            </div>
          ) : null}
        </div>
        <div className="sa-users-page-head-tabs">
          <UsersSectionTabs
            active={sectionTab}
            onChange={setSectionTab}
            workforceLabel="Workforce"
          />
        </div>
        {sectionTab === "admins" ? (
          <UsersPageMeta
            items={[
              satelliteSite ? `Church: ${satelliteSite}` : null,
              `${unitLeaderCount} service unit leader${unitLeaderCount !== 1 ? "s" : ""}`,
              `${subLeaderCount} sub-unit leader${subLeaderCount !== 1 ? "s" : ""}`,
            ]}
          />
        ) : sectionTab === "workforce" ? (
          <UsersPageMeta
            items={[
              memberTotal != null
                ? `${memberTotal} approved member${memberTotal !== 1 ? "s" : ""} at your church`
                : "Members who joined at your satellite church",
              stateLabel && countryLabel ? `${stateLabel}, ${countryLabel}` : null,
            ]}
          />
        ) : null}
      </header>

      <UsersPendingQueue compact requests={pendingRequests} onOpenQueue={() => setPage?.("requests")} />

      {sectionTab === "workforce" ? (
        <UnitMembers units={units} embedded />
      ) : (
        <SatelliteChurchLeaders
          embedded
          admins={adminsPayload}
          units={units}
          actionMenu={actionMenu}
          onOpenActions={openLeaderActions}
          onCloseActionMenu={closeActionMenu}
          menuItems={menuItems}
        />
      )}

      <WorkforceLeaderModal
        open={!!leaderModal}
        countryCode={countryCode}
        stateCode={stateCode}
        churches={churches}
        units={units?.data || []}
        lockedSatelliteSite={satelliteSite}
        initialRole={leaderModal?.initialRole || leaderModal?.role || "service_unit_leader"}
        editData={leaderModal?.id ? leaderModal : null}
        saving={saving}
        onClose={() => setLeaderModal(null)}
        onSave={saveWorkforceLeader}
      />
    </>
  );
}
