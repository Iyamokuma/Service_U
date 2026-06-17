import { useCallback, useEffect, useMemo, useState } from "react";
import { readUsersSectionTab, writeUsersSectionTab } from "../usersSectionTab.js";
import { api } from "../api.js";
import { useAdminAuth } from "../AdminContext.jsx";
import { useToast } from "../components/Toast.jsx";
import { buildAdminRowMenuItems, isAdminActive, nextAdminActiveValue } from "../components/adminRowMenuItems.js";
import { UsersPageMeta } from "../components/UsersPageMeta.jsx";
import { UsersSectionTabs } from "../components/UsersSectionTabs.jsx";
import { WorkforceLeadersPanel } from "../components/WorkforceLeadersPanel.jsx";
import { UnitMembers } from "./UnitMembers.jsx";
import { WorkforceLeaderModal } from "../components/WorkforceLeaderModal.jsx";
import { branchCountryLabel, branchStateLabel } from "../branchRegions.js";
import { fetchAdminChurchesCatalog } from "../churchesCatalog.js";
import { toastAfterAdminCreate } from "../adminInviteUi.js";

function initialServiceUnitTab() {
  const tab = readUsersSectionTab();
  if (tab === "admins") return "workforce";
  return tab === "members" ? tab : "workforce";
}

export function ServiceUnitUsers({ admins: adminsPayload, units, reload }) {
  const toast = useToast();
  const { admin: me } = useAdminAuth();
  const countryCode = String(me?.branch_country || "").toUpperCase();
  const stateCode = String(me?.branch_state || "").toUpperCase();
  const satelliteSite = String(me?.satellite_site || "").trim();
  const unitId = Number(me?.service_unit_id);
  const unitName = (units?.data || []).find((u) => Number(u.id) === unitId)?.name || me?.service_unit_name || "";

  const [sectionTab, setSectionTabRaw] = useState(initialServiceUnitTab);
  const setSectionTab = useCallback((tab) => {
    writeUsersSectionTab(tab);
    setSectionTabRaw(tab);
  }, []);
  const [saving, setSaving] = useState(false);
  const [churches, setChurches] = useState([]);
  const [actionMenu, setActionMenu] = useState({ id: null, anchor: null });
  const [leaderModal, setLeaderModal] = useState(null);
  const [workforceStats, setWorkforceStats] = useState({ total: 0, unitLeaders: 0, subLeaders: 0 });
  const [memberTotal, setMemberTotal] = useState(0);

  const rowFilter = useCallback(
    (a) =>
      a.role === "sub_unit_leader" &&
      Number(a.service_unit_id) === unitId &&
      String(a.branch_country || "").toUpperCase() === countryCode &&
      String(a.branch_state || "").toUpperCase() === stateCode &&
      (!satelliteSite || String(a.satellite_site || "").trim() === satelliteSite),
    [unitId, countryCode, stateCode, satelliteSite],
  );

  useEffect(() => {
    fetchAdminChurchesCatalog().then(setChurches).catch(() => setChurches([]));
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

  async function saveSubLeader(form, validationError) {
    if (validationError) {
      toast(validationError, "error");
      return;
    }
    if (!form) return;
    setSaving(true);
    try {
      const payload = { ...form, viewer: me, role: "sub_unit_leader", service_unit_id: unitId };
      if (form.id) {
        await api.updateAdmin(form.id, payload);
        toast("Sub-unit leader updated.", "success");
      } else {
        const res = await api.createAdmin(payload);
        toastAfterAdminCreate(toast, { res, email: form.email, isEdit: false });
      }
      setLeaderModal(null);
      reload?.();
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
    } catch (e) {
      toast(e.message, "error");
    }
  }

  async function deleteAdmin(row) {
    closeActionMenu();
    if (!window.confirm(`Delete ${row.full_name}? This cannot be undone.`)) return;
    try {
      await api.deleteAdmin(row.id, { viewer: me });
      toast("Leader deleted.", "success");
      reload?.();
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
            <div className="sa-users-page-actions">
              <button
                type="button"
                className="sa-btn sa-btn-primary sa-btn-sm"
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
              `Workforce: ${workforceStats.total} sub-unit leader${workforceStats.total !== 1 ? "s" : ""}`,
              unitName ? `Service unit: ${unitName}` : null,
            ]}
          />
        ) : (
          <UsersPageMeta
            items={[
              `Unit members: ${memberTotal} approved in ${unitName || "your service unit"}`,
              branchStateLabel(countryCode, stateCode) ? `State: ${branchStateLabel(countryCode, stateCode)}` : null,
              satelliteSite ? `Satellite: ${satelliteSite}` : null,
              branchCountryLabel(countryCode) ? `${branchCountryLabel(countryCode)}` : null,
            ]}
          />
        )}
      </header>

      {sectionTab === "workforce" ? (
        <WorkforceLeadersPanel
          admins={adminsPayload}
          units={units}
          countryCode={countryCode}
          rowFilter={rowFilter}
          roles={["sub_unit_leader"]}
          showRoleFilter={false}
          emptyScopeLabel={unitName || "your service unit"}
          actionMenu={actionMenu}
          onOpenActions={openLeaderActions}
          onCloseActionMenu={closeActionMenu}
          menuItems={menuItems}
          onStats={setWorkforceStats}
          me={me}
          reload={reload}
          bulkScope={{ isServiceLeader: true }}
        />
      ) : (
        <UnitMembers units={units} embedded unitLeaderGeo serviceUnitId={unitId} onMemberStats={({ total }) => setMemberTotal(total)} />
      )}

      <WorkforceLeaderModal
        open={!!leaderModal}
        countryCode={countryCode}
        stateCode={stateCode}
        churches={churches}
        units={(units?.data || []).filter((u) => Number(u.id) === unitId)}
        lockedSatelliteSite={satelliteSite}
        initialRole="sub_unit_leader"
        editData={leaderModal?.id ? leaderModal : null}
        saving={saving}
        onClose={() => setLeaderModal(null)}
        onSave={saveSubLeader}
      />
    </>
  );
}
