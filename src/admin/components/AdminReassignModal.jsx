import { useEffect, useMemo, useState } from "react";
import { Modal } from "./Modal.jsx";
import { SearchableSelect } from "./SearchableSelect.jsx";
import { fetchAdminChurchesCatalog } from "../churchesCatalog.js";
import {
  BRANCH_COUNTRIES,
  branchCountryLabel,
  branchStatesForCountry,
  coerceStateForCountry,
  defaultHeadquartersStateForCountry,
} from "../branchRegions.js";
import { satelliteSitesForBranch } from "../satelliteSites.js";
import {
  occupiedCountryCodes,
  ROLES_WITH_COUNTRY,
  ROLES_WITH_STATE,
  ROLES_WITH_SATELLITE,
  validateAdminReassignForm,
} from "../adminAccountForm.js";
import { occupiedStateCodes } from "../stateAdminForm.js";
import { roleDisplayLabel } from "../roles.js";
import { unitHasSubUnits } from "../../serviceUnitUtils.js";

const ROLE_OPTIONS = [
  { value: "country_super_admin", label: "Country Admin" },
  { value: "state_super_admin", label: "State Branch Admin" },
  { value: "satellite_church_admin", label: "Satellite Pastor Admin" },
  { value: "data_entry_admin", label: "Data Entry Admin" },
  { value: "general_admin", label: "General Admin" },
  { value: "super_admin", label: "Super Admin" },
];

function emptyScopeForRole(role, prev = {}) {
  const r = role || "";
  return {
    role: r,
    branch_country: ROLES_WITH_COUNTRY.includes(r) ? prev.branch_country || "" : "",
    branch_state: ROLES_WITH_STATE.includes(r) ? prev.branch_state || "" : "",
    satellite_site: ROLES_WITH_SATELLITE.includes(r) ? prev.satellite_site || "" : "",
    service_unit_id: ["service_unit_leader", "sub_unit_leader"].includes(r) ? prev.service_unit_id || "" : "",
    sub_unit_name: r === "sub_unit_leader" ? prev.sub_unit_name || "" : "",
  };
}

export function AdminReassignModal({
  open,
  onClose,
  onSave,
  saving,
  admin,
  existingAdmins = [],
  pendingRequests = [],
  unitList = [],
  isRootSuper = false,
}) {
  const [form, setForm] = useState(null);
  const [churches, setChurches] = useState([]);

  const roleOptions = useMemo(
    () => ROLE_OPTIONS.filter((r) => r.value !== "super_admin" || isRootSuper),
    [isRootSuper],
  );

  useEffect(() => {
    if (!open) return;
    fetchAdminChurchesCatalog().then(setChurches).catch(() => setChurches([]));
  }, [open]);

  useEffect(() => {
    if (!open || !admin?.id) return;
    setForm({
      id: admin.id,
      full_name: admin.full_name || "",
      username: admin.username || "",
      email: admin.email || "",
      role: admin.role || "state_super_admin",
      branch_country: admin.branch_country || "",
      branch_state: admin.branch_state || "",
      satellite_site: admin.satellite_site || "",
      service_unit_id: admin.service_unit_id || "",
      sub_unit_name: admin.sub_unit_name || "",
      is_active: admin.is_active ?? 1,
    });
  }, [open, admin]);

  const takenCountries = useMemo(
    () => occupiedCountryCodes(existingAdmins, pendingRequests, form?.id),
    [existingAdmins, pendingRequests, form?.id],
  );

  const takenStates = useMemo(
    () => occupiedStateCodes(existingAdmins, pendingRequests, form?.branch_country, form?.id),
    [existingAdmins, pendingRequests, form?.branch_country, form?.id],
  );

  const stateOptions = useMemo(() => {
    const cc = String(form?.branch_country || "").toUpperCase();
    if (!cc) return [];
    return branchStatesForCountry(cc).filter((s) => !takenStates.has(String(s.code).toUpperCase()));
  }, [form?.branch_country, takenStates]);

  const satelliteOptions = useMemo(() => {
    const cc = String(form?.branch_country || "").toUpperCase();
    const st = coerceStateForCountry(cc, form?.branch_state || "");
    return satelliteSitesForBranch(churches, cc, st);
  }, [churches, form?.branch_country, form?.branch_state]);

  const selectedUnit = useMemo(
    () => unitList.find((u) => Number(u.id) === Number(form?.service_unit_id)),
    [unitList, form?.service_unit_id],
  );
  const selectedUnitHasSubs = unitHasSubUnits(selectedUnit);

  const locationScoped = form && ROLES_WITH_COUNTRY.includes(form.role);

  function setRole(role) {
    setForm((f) => ({
      ...f,
      ...emptyScopeForRole(role, f),
      role,
      branch_state:
        role === "country_super_admin" && f.branch_country && !f.branch_state
          ? defaultHeadquartersStateForCountry(f.branch_country) || ""
          : emptyScopeForRole(role, f).branch_state,
    }));
  }

  function submit() {
    if (!form) return;
    const msg = validateAdminReassignForm(form, { takenCountries, takenStates, units: unitList });
    if (msg) {
      onSave(null, msg);
      return;
    }
    onSave({
      id: form.id,
      full_name: form.full_name,
      email: form.email,
      role: form.role,
      branch_country: ROLES_WITH_COUNTRY.includes(form.role) ? form.branch_country : "",
      branch_state: ROLES_WITH_STATE.includes(form.role) ? form.branch_state : "",
      satellite_site: ROLES_WITH_SATELLITE.includes(form.role) ? form.satellite_site : "",
      service_unit_id: ["service_unit_leader", "sub_unit_leader"].includes(form.role)
        ? form.service_unit_id
        : "",
      sub_unit_name: form.role === "sub_unit_leader" ? form.sub_unit_name : "",
      is_active: form.is_active,
    });
  }

  if (!form) return null;

  const previousRoleLabel = admin?.role ? roleDisplayLabel(admin.role) : "—";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Reassign administrator"
      size="md"
      footer={
        <>
          <button type="button" className="sa-btn sa-btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="sa-btn sa-btn-primary" onClick={submit} disabled={saving}>
            {saving ? "Saving…" : "Save reassignment"}
          </button>
        </>
      }
    >
      <div className="sa-field" style={{ marginBottom: 12 }}>
        <label className="sa-label">Administrator</label>
        <input className="sa-input" value={form.full_name} disabled readOnly />
        <div className="sa-field-hint">
          Login: <strong>{form.username}</strong> · {form.email}
        </div>
      </div>

      <div className="sa-field" style={{ marginBottom: 12 }}>
        <label className="sa-label">Current role</label>
        <input className="sa-input" value={previousRoleLabel} disabled readOnly />
      </div>

      <div className="sa-field" style={{ marginBottom: 16 }}>
        <label className="sa-label">
          New role <span className="sa-required">*</span>
        </label>
        <select className="sa-field-select" value={form.role} onChange={(e) => setRole(e.target.value)}>
          {roleOptions.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      {locationScoped ? (
        <>
          <p className="sa-text-sm sa-fw-600" style={{ margin: "0 0 8px" }}>
            New scope / location
          </p>
          <div className="sa-form-row">
            <div className="sa-field">
              <label className="sa-label">
                Country <span className="sa-required">*</span>
              </label>
              <select
                className="sa-field-select"
                value={form.branch_country}
                onChange={(e) => {
                  const branch_country = e.target.value;
                  setForm((f) => ({
                    ...f,
                    branch_country,
                    branch_state:
                      f.role === "country_super_admin"
                        ? defaultHeadquartersStateForCountry(branch_country) || ""
                        : "",
                    satellite_site: "",
                  }));
                }}
              >
                <option value="">Select country</option>
                {BRANCH_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            {ROLES_WITH_STATE.includes(form.role) ? (
              <div className="sa-field">
                <label className="sa-label">
                  {form.role === "country_super_admin" ? "Headquarters state" : "State / region"}{" "}
                  <span className="sa-required">*</span>
                </label>
                <select
                  className="sa-field-select"
                  value={form.branch_state}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      branch_state: e.target.value,
                      satellite_site: "",
                    }))
                  }
                  disabled={!form.branch_country}
                >
                  <option value="">{form.branch_country ? "Select state" : "Select country first"}</option>
                  {(form.role === "state_super_admin" ? stateOptions : branchStatesForCountry(form.branch_country)).map(
                    (s) => (
                      <option key={s.code} value={s.code}>
                        {s.name}
                      </option>
                    ),
                  )}
                </select>
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      {ROLES_WITH_SATELLITE.includes(form.role) ? (
        <div className="sa-field">
          <label className="sa-label">
            Satellite church <span className="sa-required">*</span>
          </label>
          <SearchableSelect
            value={form.satellite_site}
            onChange={(e) => setForm((f) => ({ ...f, satellite_site: e.target.value }))}
            options={satelliteOptions}
            placeholder="Select satellite"
            searchPlaceholder="Search satellite churches…"
            emptyMessage="No satellites in this state"
            ariaLabel="Satellite church"
          />
        </div>
      ) : null}

      {["service_unit_leader", "sub_unit_leader"].includes(form.role) ? (
        <div className="sa-form-row">
          <div className="sa-field">
            <label className="sa-label">
              Service unit <span className="sa-required">*</span>
            </label>
            <select
              className="sa-field-select"
              value={form.service_unit_id}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  service_unit_id: e.target.value,
                  sub_unit_name: "",
                }))
              }
            >
              <option value="">Select unit</option>
              {unitList.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          {form.role === "sub_unit_leader" ? (
            <div className="sa-field">
              <label className="sa-label">
                Sub-unit <span className="sa-required">*</span>
              </label>
              <select
                className="sa-field-select"
                value={form.sub_unit_name}
                onChange={(e) => setForm((f) => ({ ...f, sub_unit_name: e.target.value }))}
                disabled={!form.service_unit_id || !selectedUnitHasSubs}
              >
                <option value="">
                  {!form.service_unit_id
                    ? "Select service unit first"
                    : selectedUnitHasSubs
                      ? "Select sub-unit"
                      : "No sub-units on this unit"}
                </option>
                {(selectedUnit?.sub_units || []).map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
              {form.service_unit_id && !selectedUnitHasSubs ? (
                <div className="sa-field-hint">This service unit has no sub-units.</div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {form.role === "country_super_admin" || form.role === "state_super_admin" || form.role === "general_admin" || form.role === "data_entry_admin" ? (
        <p className="sa-text-muted sa-text-sm" style={{ margin: "12px 0 0", lineHeight: 1.5 }}>
          Previous assignment: {branchCountryLabel(admin?.branch_country) || "—"}
          {admin?.branch_state ? ` · ${admin.branch_state}` : ""}
          {admin?.satellite_site ? ` · ${admin.satellite_site}` : ""}
        </p>
      ) : null}
    </Modal>
  );
}
