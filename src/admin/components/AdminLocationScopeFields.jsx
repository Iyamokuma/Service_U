import { SearchableSelect } from "./SearchableSelect.jsx";
import {
  ROLES_WITH_SATELLITE,
  ROLES_WITH_STATE,
} from "../adminAccountForm.js";
import { hqChurchValueFromForm, parseHqChurchValue } from "../catalogGeoOptions.js";

/**
 * Country / state / HQ church fields for global admin create & reassign flows.
 */
export function AdminLocationScopeFields({
  form,
  setForm,
  isEdit = false,
  countryOptions,
  allCountryOptions,
  allStateOptions,
  stateOptions,
  showBranchChurchStepFlow,
  showBranchStateStep = false,
  branchStateLabelText = "State / region",
  branchChurchHint = "",
  branchChurchOpts = [],
  showChurchPicker = false,
  steppedStateOptions = [],
  disableCountry = false,
  disableState = false,
  onCountryChange,
  showCountryVacantHint = false,
  showStateVacantHint = false,
  showSteppedStateVacantHint = false,
}) {
  const role = form?.role || "";
  const countryList =
    role === "country_super_admin" && !isEdit ? countryOptions : allCountryOptions;
  const stateList =
    (role === "state_super_admin" || role === "country_super_admin") && !isEdit
      ? stateOptions
      : allStateOptions;

  function pickCountry(branch_country) {
    setForm((f) => {
      let next = { ...f, branch_country, branch_state: "", satellite_site: "" };
      if (onCountryChange) next = onCountryChange(next, branch_country, f) || next;
      return next;
    });
  }

  return (
    <>
      <div className={showBranchChurchStepFlow ? "sa-field" : "sa-form-row"}>
        <div className="sa-field">
          <label className="sa-label">
            Country <span className="sa-required">*</span>
          </label>
          <select
            className="sa-field-select"
            value={form.branch_country}
            onChange={(e) => pickCountry(e.target.value)}
            disabled={disableCountry || (role === "country_super_admin" && isEdit)}
          >
            <option value="">Select country</option>
            {(countryList || []).map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
          {showCountryVacantHint ? (
            <div className="sa-field-hint">
              Every country already has a Country Admin (or one pending approval).
            </div>
          ) : null}
        </div>

        {!showBranchChurchStepFlow && ROLES_WITH_STATE.includes(role) ? (
          <div className="sa-field">
            <label className="sa-label">
              {role === "country_super_admin" ? "Headquarters state" : branchStateLabelText}{" "}
              <span className="sa-required">*</span>
            </label>
            <select
              className="sa-field-select"
              value={form.branch_state}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  branch_state: e.target.value,
                  satellite_site: ROLES_WITH_SATELLITE.includes(f.role) ? "" : f.satellite_site,
                }))
              }
              disabled={disableState || !form.branch_country || (role === "state_super_admin" && isEdit)}
            >
              <option value="">{form.branch_country ? "Select state" : "Select country first"}</option>
              {(stateList || []).map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
            {showStateVacantHint ? (
              <div className="sa-field-hint">
                Every state in this country already has a State Branch Admin (or one pending approval).
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {showBranchStateStep && form.branch_country ? (
        <div className="sa-field">
          <label className="sa-label">
            {role === "country_super_admin" ? "Headquarters state" : branchStateLabelText}{" "}
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
            disabled={
              (role === "state_super_admin" && isEdit) || (role === "country_super_admin" && isEdit)
            }
          >
            <option value="">Select state</option>
            {steppedStateOptions.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </select>
          {showSteppedStateVacantHint ? (
            <div className="sa-field-hint">
              {role === "country_super_admin"
                ? "No available states in this country (all already have a branch admin or pending request)."
                : "Every state in this country already has a State Branch Admin (or one pending approval)."}
            </div>
          ) : (
            <div className="sa-field-hint">States are loaded from the branch directory for the selected country.</div>
          )}
        </div>
      ) : null}

      {showChurchPicker ? (
        <div className="sa-field">
          <label className="sa-label">
            {role === "country_super_admin" ? "Headquarters church" : "Church branch"}{" "}
            <span className="sa-required">*</span>
          </label>
          <SearchableSelect
            value={hqChurchValueFromForm(form.branch_state, form.satellite_site)}
            onChange={(e) => {
              const { branch_state, satellite_site } = parseHqChurchValue(e.target.value);
              setForm((f) => ({ ...f, branch_state, satellite_site }));
            }}
            options={branchChurchOpts}
            placeholder={
              branchChurchOpts.length ? "Select church branch" : "No churches in this country yet"
            }
            searchPlaceholder="Search church branches…"
            emptyMessage="No churches match your search"
            ariaLabel="Church branch"
          />
          <div className="sa-field-hint">
            {branchChurchOpts.length === 0
              ? "No churches listed for this country yet. Add branches via Data Entry or approve a location request first."
              : branchChurchHint}
          </div>
        </div>
      ) : null}
    </>
  );
}
