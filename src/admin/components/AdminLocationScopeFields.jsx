import { useMemo } from "react";
import { Field } from "../../components/Field.jsx";
import { SearchableDropdown } from "../../components/SearchableDropdown.jsx";
import { StateRegionSelect } from "./StateRegionSelect.jsx";
import { SearchableSelect } from "./SearchableSelect.jsx";
import {
  ROLES_WITH_SATELLITE,
  ROLES_WITH_STATE,
} from "../adminAccountForm.js";
import { branchStateLabel } from "../branchRegions.js";
import { churchSelectOptionsForBranch } from "../satelliteSites.js";
import {
  hqChurchValueFromForm,
  parseHqChurchValue,
  resolveStateCodeFromSelection,
  stateSelectOptionsForDropdown,
  stateSelectionValueForCode,
} from "../catalogGeoOptions.js";

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
  churches = [],
  showChurchPicker = false,
  stateFieldOptions = [],
  steppedStateOptions = [],
  disableCountry = false,
  disableState = false,
  onCountryChange,
  onStateChange,
  showCountryVacantHint = false,
  showStateVacantHint = false,
  showSteppedStateVacantHint = false,
  churchesLoading = false,
  statesLoading = false,
  stateReadOnly = false,
  showChurchInStepFlow = true,
}) {
  const role = form?.role || "";
  const countryList =
    role === "country_super_admin" && !isEdit ? countryOptions : allCountryOptions;
  const stateList =
    (role === "state_super_admin" || role === "country_super_admin") && !isEdit
      ? stateOptions
      : allStateOptions;

  const countrySelectOptions = useMemo(
    () => (countryList || []).map((c) => ({ value: c.code, label: c.name })),
    [countryList],
  );

  function pickCountry(branch_country) {
    setForm((f) => {
      let next = { ...f, branch_country, branch_state: "", satellite_site: "" };
      if (onCountryChange) next = onCountryChange(next, branch_country, f) || next;
      return next;
    });
  }

  function pickState(selection) {
    const canonical = resolveStateCodeFromSelection(selection, stateFieldOptions);
    setForm((f) => {
      let next = { ...f, branch_state: canonical, satellite_site: "" };
      if (onStateChange) next = onStateChange(next, { branch_state: canonical, prev: f }) || next;
      return next;
    });
  }

  const stateDropdownOptions = useMemo(
    () => stateSelectOptionsForDropdown(stateFieldOptions, form.branch_country),
    [stateFieldOptions, form.branch_country],
  );

  const stateDropdownValue = useMemo(
    () => stateSelectionValueForCode(form.branch_state, stateFieldOptions, form.branch_country),
    [form.branch_state, stateFieldOptions, form.branch_country],
  );

  const scopedChurchOpts = useMemo(() => {
    if (!form.branch_country || !form.branch_state) return [];
    return churchSelectOptionsForBranch(churches || [], form.branch_country, form.branch_state);
  }, [churches, form.branch_country, form.branch_state]);

  const countryDisabled = disableCountry || (role === "country_super_admin" && isEdit);

  const churchHint = (() => {
    if (churchesLoading && form.branch_country) {
      return "Loading churches from the directory…";
    }
    if (!form.branch_country) {
      return "Select a country first.";
    }
    if (scopedChurchOpts.length === 0) {
      return "No churches listed for this country yet. Add branches via Data Entry or approve a location request first.";
    }
    return branchChurchHint || "Pick the branch name as listed in the directory.";
  })();

  const selectedStateLabel =
    form.branch_state && form.branch_country
      ? branchStateLabel(form.branch_country, form.branch_state) || form.branch_state
      : "";

  if (showBranchChurchStepFlow) {
    const stateLabel = role === "country_super_admin" ? "Headquarters state" : branchStateLabelText;
    const countryHint = showCountryVacantHint
      ? "Every country already has a Country Admin (or one pending approval)."
      : "Where your branch is located.";
    const stateHint = (() => {
      if (!form.branch_country) return "Select a country first.";
      if (statesLoading) return "Loading states from the branch directory…";
      if (showSteppedStateVacantHint || showStateVacantHint) {
        return role === "country_super_admin"
          ? "No available states in this country (all already have a branch admin or pending request)."
          : "Every state in this country already has a State Branch Admin (or one pending approval).";
      }
      return "State where this branch is located.";
    })();
    const churchFieldHint = (() => {
      if (churchesLoading && form.branch_country) {
        return "Loading churches from the directory…";
      }
      if (!form.branch_country) {
        return "Select a country first.";
      }
      if (!form.branch_state) {
        return "Select a state first.";
      }
    if (scopedChurchOpts.length === 0) {
      return "No churches listed for this state yet. Add branches via Data Entry or approve a location request first.";
    }
    return branchChurchHint || "Pick the branch name as listed in the directory.";
  })();

    const churchValue = hqChurchValueFromForm(form.branch_state, form.satellite_site);
    const churchPlaceholder = !form.branch_country
      ? "Select country first"
      : !form.branch_state
        ? "Select state first"
        : churchesLoading
          ? "Loading churches…"
          : scopedChurchOpts.length
            ? "Select"
            : "No branches found for this state";

    return (
      <div className="grid">
        <Field label="Country" required hint={countryHint}>
          <select
            className="select"
            value={form.branch_country}
            onChange={(e) => pickCountry(e.target.value)}
            disabled={countryDisabled}
          >
            <option value="">Select country</option>
            {countrySelectOptions.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label={stateLabel} required hint={stateHint}>
          {stateReadOnly ? (
            <input
              className="input"
              value={selectedStateLabel || form.branch_state || ""}
              disabled
              readOnly
            />
          ) : (
            <SearchableDropdown
              value={stateDropdownValue}
              onChange={pickState}
              options={stateDropdownOptions}
              disabled={!form.branch_country || disableState || statesLoading}
              placeholder={
                !form.branch_country
                  ? "Select country first"
                  : statesLoading
                    ? "Loading states…"
                    : stateDropdownOptions.length
                      ? "Select"
                      : "No states found for this country"
              }
              searchPlaceholder="Search state"
              emptyMessage="No states match your search"
              valid={!!form.branch_state && !statesLoading}
              ariaLabel={stateLabel}
            />
          )}
        </Field>

        {showChurchInStepFlow ? (
          <>
            <Field label="Church / branch" required span="2" hint={churchFieldHint}>
              <SearchableDropdown
                key={`${form.branch_country}-${form.branch_state}`}
                value={churchValue}
                onChange={(value) => {
                  const { branch_state, satellite_site } = parseHqChurchValue(value);
                  setForm((f) => ({ ...f, branch_state, satellite_site }));
                }}
                options={scopedChurchOpts}
                disabled={!form.branch_country || !form.branch_state || churchesLoading}
                placeholder={churchPlaceholder}
                searchPlaceholder="Search by name or address"
                emptyMessage="No branches match your search"
                valid={!!churchValue && !churchesLoading}
                ariaLabel="Church / branch"
              />
            </Field>

            {form.satellite_site ? (
              <div className="field col-span-2">
                <div className="field-hint" style={{ marginTop: -4 }}>
                  Selected: <strong>{form.satellite_site}</strong>
                  {selectedStateLabel ? <> · {selectedStateLabel}</> : null}
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <div className="sa-form-row">
        <div className="sa-field">
          <label className="sa-label">
            Country <span className="sa-required">*</span>
          </label>
          <SearchableSelect
            value={form.branch_country}
            onChange={(e) => pickCountry(e.target.value)}
            options={countrySelectOptions}
            disabled={countryDisabled}
            placeholder="Select country"
            searchPlaceholder="Search countries…"
            emptyMessage="No countries match"
            searchAriaLabel="Filter countries"
          />
          {showCountryVacantHint ? (
            <div className="sa-field-hint">
              Every country already has a Country Admin (or one pending approval).
            </div>
          ) : null}
        </div>

        {ROLES_WITH_STATE.includes(role) ? (
          <div className="sa-field">
            <label className="sa-label">
              {role === "country_super_admin" ? "Headquarters state" : branchStateLabelText}{" "}
              <span className="sa-required">*</span>
            </label>
            <StateRegionSelect
              stateRows={stateList || []}
              countryCode={form.branch_country}
              value={form.branch_state}
              onChange={(code) =>
                setForm((f) => ({
                  ...f,
                  branch_state: code,
                  satellite_site: ROLES_WITH_SATELLITE.includes(f.role) ? "" : f.satellite_site,
                }))
              }
              emptyOption={form.branch_country ? "Select state" : "Select country first"}
              disabled={disableState || !form.branch_country || (role === "state_super_admin" && isEdit)}
            />
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
          <StateRegionSelect
            stateRows={steppedStateOptions}
            countryCode={form.branch_country}
            value={form.branch_state}
            onChange={(code) =>
              setForm((f) => ({
                ...f,
                branch_state: code,
                satellite_site: "",
              }))
            }
            disabled={
              (role === "state_super_admin" && isEdit) || (role === "country_super_admin" && isEdit)
            }
          />
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
            options={scopedChurchOpts}
            disabled={!form.branch_country || !form.branch_state || churchesLoading}
            placeholder={
              !form.branch_country
                ? "Select country first"
                : !form.branch_state
                  ? "Select state first"
                  : churchesLoading
                    ? "Loading churches…"
                    : scopedChurchOpts.length
                      ? "Select church branch"
                      : "No churches in this state yet"
            }
            searchPlaceholder="Search church branches…"
            emptyMessage="No churches match your search"
            searchAriaLabel="Filter church branches"
          />
          <div className="sa-field-hint">{churchHint}</div>
        </div>
      ) : null}
    </>
  );
}
