import { useEffect, useMemo, useState } from "react";
import { Field } from "../../components/Field.jsx";
import { Modal } from "./Modal.jsx";
import { branchCountryLabel } from "../branchRegions.js";
import {
  availableSatellitesForState,
  occupiedSatelliteSites,
  suggestedSatellitePastorUsername,
  validateSatellitePastorAdminForm,
} from "../stateSatelliteForm.js";
import { usesAdminInviteCreate } from "../adminAccountForm.js";
import { adminCreateButtonLabel } from "../adminInviteUi.js";
import { AdminAccountIdentityFields } from "./AdminAccountIdentityFields.jsx";
import { AdminLocationScopeFields } from "./AdminLocationScopeFields.jsx";

function shouldAutoFillUsername(username) {
  const u = String(username || "").trim().toLowerCase();
  return !u || /^[a-z0-9]{2,12}\.[a-z0-9]{2,12}\.[a-z0-9]{2,12}\.pastor$/.test(u);
}

export function SatellitePastorAdminModal({
  open,
  onClose,
  onSave,
  saving,
  countryCode,
  stateCode,
  churches = [],
  existingAdmins = [],
  pendingRequests = [],
  initialSatellite = "",
  editData = null,
  reassignOnly = false,
}) {
  const isEdit = !!editData?.id;
  const inviteCreate = usesAdminInviteCreate(isEdit);
  const cc = String(countryCode || "").toUpperCase();
  const st = String(stateCode || "").trim();

  const [form, setForm] = useState({
    role: "satellite_church_admin",
    full_name: "",
    username: "",
    email: "",
    password: "",
    branch_country: cc,
    branch_state: st,
    satellite_site: "",
    is_active: 1,
  });

  const satelliteOptions = useMemo(
    () =>
      availableSatellitesForState(churches, cc, st, existingAdmins, pendingRequests, isEdit ? editData?.id : null),
    [churches, cc, st, existingAdmins, pendingRequests, isEdit, editData?.id],
  );

  const churchDropdownOptions = useMemo(
    () => satelliteOptions.map((s) => ({ value: s.name, label: s.name })),
    [satelliteOptions],
  );

  useEffect(() => {
    if (!open) return;
    if (editData?.id) {
      setForm({
        role: "satellite_church_admin",
        id: editData.id,
        full_name: editData.full_name || "",
        username: editData.username || "",
        email: editData.email || "",
        password: "",
        branch_country: cc,
        branch_state: editData.branch_state || st,
        satellite_site: editData.satellite_site || "",
        is_active: editData.is_active ?? 1,
      });
      return;
    }
    const site = initialSatellite || "";
    setForm({
      role: "satellite_church_admin",
      full_name: "",
      username: site ? suggestedSatellitePastorUsername(cc, st, site) : "",
      email: "",
      password: "",
      branch_country: cc,
      branch_state: st,
      satellite_site: site,
      is_active: 1,
    });
  }, [open, editData, initialSatellite, cc, st]);

  function submit() {
    const takenSites = occupiedSatelliteSites(existingAdmins, pendingRequests, cc, st, isEdit ? editData?.id : null);
    const msg = validateSatellitePastorAdminForm(
      { ...form, branch_country: cc, branch_state: st, role: "satellite_church_admin" },
      { countryCode: cc, stateCode: st, takenSites, isEdit, churches, inviteCreate },
    );
    if (msg) {
      onSave(null, msg);
      return;
    }
    onSave({
      ...form,
      role: "satellite_church_admin",
      branch_country: cc,
      branch_state: form.branch_state || st,
      satellite_site: form.satellite_site,
    });
  }

  const countryLabel = branchCountryLabel(cc);
  const useSteppedLocation = !isEdit || reassignOnly;
  const showChurchInStepFlow = !reassignOnly && !isEdit;
  const stateReadOnly = true;
  const satelliteReadOnly = isEdit && !reassignOnly;

  const branchChurchHint = "Pastor admin is scoped to this satellite within the selected state.";

  const createBlocked = !isEdit && satelliteOptions.length === 0 && !initialSatellite;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        reassignOnly ? "Reassign Satellite Pastor Admin" : isEdit ? "Edit Satellite Pastor Admin" : "New Satellite Pastor Admin"
      }
      size="md"
      footer={
        <>
          <button type="button" className="sa-btn sa-btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="sa-btn sa-btn-primary"
            onClick={submit}
            disabled={saving || createBlocked}
          >
            {adminCreateButtonLabel({ saving, isEdit, reassignOnly })}
          </button>
        </>
      }
    >
      {reassignOnly && isEdit ? (
        <Field label="Admin">
          <input className="input" value={form.full_name} disabled readOnly />
        </Field>
      ) : null}

      {!reassignOnly ? (
        <AdminAccountIdentityFields
          form={form}
          setForm={setForm}
          isEdit={isEdit}
          inviteCreate={inviteCreate}
          usernamePlaceholder="ng.la.ikeja.pastor"
          showStatus={isEdit}
        />
      ) : null}

      <div style={{ marginTop: reassignOnly ? 0 : 16 }}>
        <AdminLocationScopeFields
          form={form}
          setForm={setForm}
          isEdit={isEdit}
          countryOptions={[{ code: cc, name: countryLabel || cc }]}
          allCountryOptions={[{ code: cc, name: countryLabel || cc }]}
          allStateOptions={[]}
          stateOptions={[]}
          stateFieldOptions={[]}
          showBranchChurchStepFlow={useSteppedLocation}
          showBranchStateStep={false}
          branchStateLabelText="State / region"
          branchChurchHint={branchChurchHint}
          showChurchPicker={showChurchInStepFlow}
          disableCountry
          countryReadOnly
          countryReadOnlyLabel={countryLabel || cc}
          disableState
          stateReadOnly={stateReadOnly}
          showChurchInStepFlow={showChurchInStepFlow}
          satelliteReadOnly={satelliteReadOnly}
          churchFieldLabel="Satellite church"
          churchPickerMode="satellite"
          churchOptionsOverride={churchDropdownOptions}
          churches={churches}
          onSatelliteChange={(next, site, prev) => {
            if (shouldAutoFillUsername(prev.username)) {
              return { ...next, username: suggestedSatellitePastorUsername(cc, st, site) };
            }
            return next;
          }}
        />
      </div>
    </Modal>
  );
}
