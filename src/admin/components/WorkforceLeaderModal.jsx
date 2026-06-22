import { useEffect, useMemo, useState } from "react";
import { Modal } from "./Modal.jsx";
import { branchCountryLabel } from "../branchRegions.js";
import { satelliteSitesForBranch } from "../satelliteSites.js";
import { usesAdminInviteCreate } from "../adminAccountForm.js";
import { adminCreateButtonLabel } from "../adminInviteUi.js";
import { validateWorkforceLeaderForm } from "../stateLeaderForm.js";
import { AdminAccountIdentityFields } from "./AdminAccountIdentityFields.jsx";
import { AdminLocationScopeFields } from "./AdminLocationScopeFields.jsx";
import { AdminWorkforceUnitFields } from "./AdminWorkforceUnitFields.jsx";

export function WorkforceLeaderModal({
  open,
  onClose,
  onSave,
  saving,
  countryCode,
  stateCode,
  churches = [],
  units = [],
  initialRole = "service_unit_leader",
  editData = null,
  lockedSatelliteSite = "",
}) {
  const cc = String(countryCode || "").toUpperCase();
  const st = String(stateCode || "").trim();
  const isEdit = !!editData?.id;
  const inviteCreate = usesAdminInviteCreate(isEdit);
  const role = isEdit ? editData.role : initialRole;
  const isSubUnit = role === "sub_unit_leader";
  const countryLabel = branchCountryLabel(cc);
  const satelliteLocked = Boolean(lockedSatelliteSite);

  const [form, setForm] = useState({
    role,
    full_name: "",
    username: "",
    email: "",
    password: "",
    branch_country: cc,
    branch_state: st,
    satellite_site: "",
    service_unit_id: "",
    sub_unit_name: "",
    is_active: 1,
  });

  const unitOptions = useMemo(
    () => (units || []).filter((u) => Number(u.is_active) !== 0),
    [units],
  );

  const satelliteOptions = useMemo(
    () => satelliteSitesForBranch(churches, cc, st),
    [churches, cc, st],
  );

  const churchDropdownOptions = useMemo(
    () => satelliteOptions.map((name) => ({ value: name, label: name })),
    [satelliteOptions],
  );

  useEffect(() => {
    if (!open) return;
    if (editData?.id) {
      setForm({
        role: editData.role || role,
        id: editData.id,
        full_name: editData.full_name || "",
        username: editData.username || "",
        email: editData.email || "",
        password: "",
        branch_country: cc,
        branch_state: editData.branch_state || st,
        satellite_site: editData.satellite_site || lockedSatelliteSite || "",
        service_unit_id: editData.service_unit_id ? String(editData.service_unit_id) : "",
        sub_unit_name: editData.sub_unit_name || "",
        is_active: editData.is_active ?? 1,
      });
      return;
    }
    setForm({
      role,
      full_name: "",
      username: "",
      email: "",
      password: "",
      branch_country: cc,
      branch_state: st,
      satellite_site: lockedSatelliteSite || "",
      service_unit_id: unitOptions[0]?.id ? String(unitOptions[0].id) : "",
      sub_unit_name: "",
      is_active: 1,
    });
  }, [open, editData, unitOptions, lockedSatelliteSite, cc, st, role]);

  function submit() {
    const msg = validateWorkforceLeaderForm(
      { ...form, role, satellite_site: lockedSatelliteSite || form.satellite_site },
      { isEdit, role, units: unitOptions, inviteCreate },
    );
    if (msg) {
      onSave(null, msg);
      return;
    }
    onSave({
      ...form,
      role,
      branch_country: cc,
      branch_state: form.branch_state || st,
      satellite_site: lockedSatelliteSite || form.satellite_site,
    });
  }

  const title = isEdit
    ? isSubUnit
      ? "Edit Sub-Unit Leader"
      : "Edit Service Unit Leader"
    : isSubUnit
      ? "New Sub-Unit Leader"
      : "New Service Unit Leader";

  const branchChurchHint = isSubUnit
    ? "Sub-unit leader is assigned to this satellite church within the selected state."
    : "Service unit leader is assigned to this satellite church within the selected state.";

  const serviceUnitHint = isSubUnit
    ? "Choose the ministry unit this sub-unit belongs to."
    : "Choose the ministry unit this person leads.";

  const showSatellitePicker = !isEdit && !satelliteLocked;
  const satelliteReadOnly = isEdit || satelliteLocked;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="md"
      footer={
        <>
          <button type="button" className="sa-btn sa-btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="sa-btn sa-btn-primary" onClick={submit} disabled={saving}>
            {adminCreateButtonLabel({ saving, isEdit })}
          </button>
        </>
      }
    >
      <AdminAccountIdentityFields
        form={form}
        setForm={setForm}
        isEdit={isEdit}
        inviteCreate={inviteCreate}
        usernamePlaceholder="leader.username"
        showStatus={isEdit}
      />

      <div style={{ marginTop: 16 }}>
        <AdminLocationScopeFields
          form={form}
          setForm={setForm}
          isEdit={isEdit}
          countryOptions={[{ code: cc, name: countryLabel || cc }]}
          allCountryOptions={[{ code: cc, name: countryLabel || cc }]}
          allStateOptions={[]}
          stateOptions={[]}
          stateFieldOptions={[]}
          showBranchChurchStepFlow
          showBranchStateStep={false}
          branchStateLabelText="State / region"
          branchChurchHint={branchChurchHint}
          disableCountry
          countryReadOnly
          countryReadOnlyLabel={countryLabel || cc}
          disableState
          stateReadOnly
          showChurchInStepFlow={showSatellitePicker}
          satelliteReadOnly={satelliteReadOnly}
          churchFieldLabel="Satellite church"
          churchPickerMode="satellite"
          churchOptionsOverride={churchDropdownOptions}
          churches={churches}
        />
      </div>

      <div style={{ marginTop: 16 }}>
        <AdminWorkforceUnitFields
          form={form}
          setForm={setForm}
          units={unitOptions}
          role={role}
          isEdit={isEdit}
          serviceUnitHint={serviceUnitHint}
        />
      </div>
    </Modal>
  );
}
