import { useCallback, useEffect, useMemo, useState } from "react";
import { readUsersSectionTab, writeUsersSectionTab } from "../usersSectionTab.js";
import { api } from "../api.js";
import { useAdminAuth } from "../AdminContext.jsx";
import { useToast } from "../components/Toast.jsx";
import { buildAdminRowMenuItems, isAdminActive, nextAdminActiveValue } from "../components/adminRowMenuItems.js";
import { UsersPendingQueue } from "../components/UsersPendingQueue.jsx";
import { UsersPageMeta } from "../components/UsersPageMeta.jsx";
import { UsersSectionTabs } from "../components/UsersSectionTabs.jsx";
import { WorkforceLeadersPanel } from "../components/WorkforceLeadersPanel.jsx";
import { UnitMembers } from "./UnitMembers.jsx";
import { WorkforceLeaderModal } from "../components/WorkforceLeaderModal.jsx";
import { branchCountryLabel, branchStateLabel } from "../branchRegions.js";
import { fetchChurchesCatalog } from "../../lib/churchesCatalog.js";
import { toastAfterAdminCreate } from "../adminInviteUi.js";

function initialSatelliteTab() {
  const tab = readUsersSectionTab();
  if (tab === "admins") return "workforce";
  return tab === "members" ? tab : "workforce";
}

export function SatelliteUsers({ admins: adminsPayload, units, reload, setPage }) {
  const toast = useToast();
  const { admin: me } = useAdminAuth();
  const countryCode = String(me?.branch_country || "").toUpperCase();
  const stateCode = String(me?.branch_state || "").toUpperCase();
  const satelliteSite = String(me?.satellite_site || "").trim();
  const stateLabel = branchStateLabel(countryCode, stateCode) || stateCode;

  const [sectionTab, setSectionTabRaw] = useState(initialSatelliteTab);
  const setSectionTab = useCallback((tab) => {
    writeUsersSectionTab(tab);
    setSectionTabRaw(tab);
  }, []);
  const [saving, setSaving] = useState(false);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [churches, setChurches] = useState([]);
  const [actionMenu, setActionMenu] = useState({ id: null, anchor: null });
  const [leaderModal, setLeaderModal] = useState(null);
  const [workforceStats, setWorkforceStats] = useState({ total: 0, unitLeaders: 0, subLeaders: 0 });
  const [memberTotal, setMemberTotal] = useState(0);

  const rowFilter = useCallback(
    (a) =>
      String(a.branch_country || "").toUpperCase() === countryCode &&
      String(a.branch_state || "").toUpperCase() === stateCode &&
      String(a.satellite_site || "").trim() === satelliteSite,
    [countryCode, stateCode, satelliteSite],
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

  const actionTarget = useMemo(
    () => (adminsPayload?.data ?? []).find((a) => Number(a.id) === Number(actionMenu.id) && rowFilter(a)),
    [adminsPayload, actionMenu.id, rowFilter],
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
      if (form.id) {
        await api.updateAdmin(form.id, payload);
        toastAfterAdminCreate(toast, { isEdit: true, updatedMessage: "Leader updated." });
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
          {sectionTab === "workforce" ? (
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
          <UsersSectionTabs
            active={sectionTab}
            onChange={setSectionTab}
            showAdminsTab={false}
            showMembersTab
          />
        </div>
        {sectionTab === "workforce" ? (
          <UsersPageMeta
            items={[
              `Workforce: ${workforceStats.total} total (${workforceStats.unitLeaders} service unit · ${workforceStats.subLeaders} sub-unit)`,
              satelliteSite ? `Church: ${satelliteSite}` : null,
            ]}
          />
        ) : sectionTab === "members" ? (
          <UsersPageMeta
            items={[
              `Unit members: ${memberTotal} approved at ${satelliteSite || "your satellite church"}`,
              stateLabel ? `In ${stateLabel}` : null,
            ]}
          />
        ) : null}
      </header>

      <UsersPendingQueue compact requests={pendingRequests} onOpenQueue={() => setPage?.("requests")} />

      {sectionTab === "workforce" ? (
        <WorkforceLeadersPanel
          admins={adminsPayload}
          units={units}
          countryCode={countryCode}
          rowFilter={rowFilter}
          emptyScopeLabel={satelliteSite || "your satellite church"}
          actionMenu={actionMenu}
          onOpenActions={openLeaderActions}
          onCloseActionMenu={closeActionMenu}
          menuItems={menuItems}
          onStats={setWorkforceStats}
        />
      ) : (
        <UnitMembers
          units={units}
          embedded
          satelliteGeo
          satelliteSite={satelliteSite}
          stateCode={stateCode}
          onMemberStats={({ total }) => setMemberTotal(total)}
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
