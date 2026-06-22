import { useEffect, useMemo, useState } from "react";
import { Field } from "../../components/Field.jsx";
import { Modal } from "./Modal.jsx";
import { branchCountryLabel } from "../branchRegions.js";
import {
  availableStatesForCountryAdmin,
  occupiedStateCodes,
  suggestedStateAdminUsername,
  validateStateBranchAdminForm,
} from "../stateAdminForm.js";
import { usesAdminInviteCreate } from "../adminAccountForm.js";
import { adminCreateButtonLabel } from "../adminInviteUi.js";
import { useCountryStateRows } from "../hooks/useCountryStateRows.js";
import { AdminAccountIdentityFields } from "./AdminAccountIdentityFields.jsx";
import { AdminLocationScopeFields } from "./AdminLocationScopeFields.jsx";

function shouldAutoFillUsername(username) {
  const u = String(username || "").trim().toLowerCase();
  return !u || /^[a-z0-9]{2,8}\.[a-z0-9]{1,12}\.admin$/.test(u);
}

export function StateBranchAdminModal({
  open,
  onClose,
  onSave,
  saving,
  countryCode,
  existingAdmins = [],
  pendingRequests = [],
  initialStateCode = "",
  editData = null,
  reassignOnly = false,
  churches: churchesProp = null,
  catalog: catalogProp = null,
}) {
  const isEdit = !!editData?.id;
  const inviteCreate = usesAdminInviteCreate(isEdit);
  const cc = String(countryCode || "").toUpperCase();

  const hasExternalCatalog = catalogProp != null;
  const {
    churches: loadedChurches,
    catalog: loadedCatalog,
    loading: catalogLoading,
    directoryStates,
    stateRows: allCountryStates,
  } = useCountryStateRows(cc, { enabled: open && !hasExternalCatalog });
  const catalog = hasExternalCatalog ? catalogProp : loadedCatalog;
  const churches = churchesProp?.length ? churchesProp : loadedChurches;
  const statesLoading = catalogLoading;

  const [form, setForm] = useState({
    role: "state_super_admin",
    full_name: "",
    username: "",
    email: "",
    password: "",
    branch_country: cc,
    branch_state: "",
    satellite_site: "",
    is_active: 1,
  });

  const stateFieldOptions = useMemo(() => {
    const effectiveDirectoryStates =
      directoryStates.length > 0
        ? directoryStates
        : (() => {
            const country = (catalog?.countries || []).find(
              (c) => String(c.branch_country_code || "").toUpperCase() === cc,
            );
            if (!country) return [];
            return (catalog?.states || []).filter(
              (s) => Number(s.country_id) === Number(country.id),
            );
          })();

    if (isEdit || reassignOnly) {
      return allCountryStates.length
        ? allCountryStates
        : availableStatesForCountryAdmin(cc, existingAdmins, pendingRequests, isEdit ? editData?.id : null, {
            catalog,
            churches,
            directoryStates: effectiveDirectoryStates,
          });
    }

    return availableStatesForCountryAdmin(cc, existingAdmins, pendingRequests, null, {
      catalog,
      churches,
      directoryStates: effectiveDirectoryStates,
    });
  }, [
    cc,
    existingAdmins,
    pendingRequests,
    isEdit,
    reassignOnly,
    editData?.id,
    catalog,
    churches,
    directoryStates,
    allCountryStates,
  ]);

  useEffect(() => {
    if (!open) return;
    if (editData?.id) {
      setForm({
        role: "state_super_admin",
        id: editData.id,
        full_name: editData.full_name || "",
        username: editData.username || "",
        email: editData.email || "",
        password: "",
        branch_country: cc,
        branch_state: editData.branch_state || "",
        satellite_site: editData.satellite_site || "",
        is_active: editData.is_active ?? 1,
      });
      return;
    }
    const st = initialStateCode || "";
    setForm({
      role: "state_super_admin",
      full_name: "",
      username: st ? suggestedStateAdminUsername(cc, st) : "",
      email: "",
      password: "",
      branch_country: cc,
      branch_state: st,
      satellite_site: "",
      is_active: 1,
    });
  }, [open, editData, initialStateCode, cc]);

  function submit() {
    const takenStates = occupiedStateCodes(existingAdmins, pendingRequests, cc, isEdit ? editData?.id : null);
    const msg = validateStateBranchAdminForm(
      { ...form, branch_country: cc, role: "state_super_admin" },
      { countryCode: cc, takenStates, isEdit, inviteCreate, churches },
    );
    if (msg) {
      onSave(null, msg);
      return;
    }
    onSave({
      ...form,
      role: "state_super_admin",
      branch_country: cc,
      branch_state: form.branch_state,
      satellite_site: form.satellite_site,
    });
  }

  const countryLabel = branchCountryLabel(cc);
  const useSteppedLocation = !isEdit || reassignOnly;
  const showChurchInStepFlow = !reassignOnly && !isEdit;
  const stateReadOnly = isEdit && !reassignOnly;

  const branchChurchHint =
    "Select the satellite church for this State Branch Admin. State for the branch view is taken from this church.";

  const createBlocked =
    !isEdit &&
    !statesLoading &&
    stateFieldOptions.length === 0 &&
    !initialStateCode &&
    allCountryStates.length > 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        reassignOnly ? "Reassign State Branch Admin" : isEdit ? "Edit State Branch Admin" : "New State Branch Admin"
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
          usernamePlaceholder="ng.la.admin"
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
        allStateOptions={stateFieldOptions}
        stateOptions={stateFieldOptions}
        showBranchChurchStepFlow={useSteppedLocation}
        showBranchStateStep={false}
        branchStateLabelText="State / region"
        branchChurchHint={branchChurchHint}
        showChurchPicker={showChurchInStepFlow}
        stateFieldOptions={stateFieldOptions}
        steppedStateOptions={stateFieldOptions}
        disableCountry
        countryReadOnly
        countryReadOnlyLabel={countryLabel || cc}
        disableState={stateReadOnly}
        stateReadOnly={stateReadOnly}
        showChurchInStepFlow={showChurchInStepFlow}
        churches={churches}
        churchesLoading={catalogLoading}
        statesLoading={statesLoading}
        showSteppedStateVacantHint={!isEdit && !statesLoading && stateFieldOptions.length === 0 && allCountryStates.length > 0}
        onStateChange={(next, { branch_state, prev }) => {
          if (shouldAutoFillUsername(prev.username)) {
            return { ...next, username: suggestedStateAdminUsername(cc, branch_state) };
          }
          return next;
        }}
        />
      </div>

      {!isEdit && !statesLoading && allCountryStates.length === 0 ? (
        <div className="field-hint" style={{ marginTop: 8 }}>
          No states found for {countryLabel || cc} in the directory yet. Add locations via Data Entry or the branch
          catalog first.
        </div>
      ) : null}
    </Modal>
  );
}
