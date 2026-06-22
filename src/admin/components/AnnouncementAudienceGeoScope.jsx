import { useMemo } from "react";
import { branchCountryLabel, branchStateLabel } from "../branchRegions.js";
import {
  announcementCountryOptions,
  announcementSatelliteOptions,
  announcementStateOptions,
} from "../announcementScopePolicy.js";
import { SearchableDropdown } from "./SearchableDropdown.jsx";
import { AnnouncementLeaderTypeField } from "./AnnouncementLeaderTypeField.jsx";

export function LockedGeoField({ label, value, hint }) {
  return (
    <div className="sa-field" style={{ marginBottom: 0 }}>
      {label ? <label className="sa-label">{label}</label> : null}
      <input className="sa-input" value={value || "—"} readOnly disabled />
      {hint ? <div className="sa-field-hint">{hint}</div> : null}
    </div>
  );
}

/**
 * Reusable country / state / satellite scope for announcement audiences.
 * Supports optional "All countries" for global send-all broadcasts.
 */
export function AnnouncementAudienceGeoScope({
  scope,
  onScopeChange,
  churches,
  branchCountries = [],
  requireCountry = false,
  allowAllCountries = false,
  allowAllSatellites = false,
  vis,
  lockedCountryCode = "",
  lockedStateCode = "",
  lockedSatelliteSite = "",
  showLeaderType = false,
  leaderMode = "",
  leaderModeOptions = [],
  onLeaderModeChange,
  leaderTypeLabel = "Leader type",
  leaderTypeHint = "",
  leaderTypePlaceholder = "Select audience",
  leaderTypeAriaLabel = "Leader type",
  showPastorRole = false,
  pastorRole = "",
  pastorRoleOptions = [],
  onPastorRoleChange,
  pastorRoleLabel = "Pastors",
  pastorRoleHint = "",
  pastorRolePlaceholder = "Select pastors",
  pastorRoleAriaLabel = "Pastor types",
  showPastorRoleFixed = false,
  pastorRoleFixedLabel = "Pastors",
  pastorRoleFixedValue = "",
}) {
  const v = vis || { country: true, state: true, satellite: true };
  const cc = lockedCountryCode || scope.branch_country;

  const countryOptions = useMemo(
    () =>
      announcementCountryOptions(lockedCountryCode, branchCountries, { allowAllCountries }),
    [lockedCountryCode, branchCountries, allowAllCountries],
  );

  const stateOptions = useMemo(
    () => announcementStateOptions(churches, cc, lockedStateCode),
    [churches, cc, lockedStateCode],
  );

  const satelliteOptions = useMemo(() => {
    const st = lockedStateCode || scope.branch_state;
    return announcementSatelliteOptions(churches, cc, st, lockedSatelliteSite);
  }, [churches, cc, scope.branch_state, lockedStateCode, lockedSatelliteSite]);

  const canPickState = Boolean(cc);
  const canPickSatellite = allowAllSatellites ? Boolean(cc) : Boolean(cc && (lockedStateCode || scope.branch_state));

  return (
    <div className="sa-ann-scope-grid">
      {lockedCountryCode ? (
        <LockedGeoField
          label="Country"
          value={branchCountryLabel(lockedCountryCode) || lockedCountryCode}
          hint="Announcements are limited to this country."
        />
      ) : v.country ? (
        <div className="sa-field" style={{ marginBottom: 0 }}>
          <label className="sa-label">
            Country {requireCountry ? <span className="sa-required">*</span> : null}
          </label>
          <SearchableDropdown
            value={scope.branch_country}
            onChange={(code) => onScopeChange({ branch_country: code, branch_state: "", satellite_site: "" })}
            options={countryOptions}
            placeholder={allowAllCountries ? "All countries" : "Select country"}
            searchPlaceholder="Search country"
            emptyMessage="No countries match"
            ariaLabel="Country"
          />
        </div>
      ) : null}
      {(v.state || lockedStateCode) && (
        <div className="sa-field" style={{ marginBottom: 0 }}>
          <label className="sa-label">State / region</label>
          {lockedStateCode ? (
            <LockedGeoField
              label=""
              value={branchStateLabel(cc, lockedStateCode) || lockedStateCode}
              hint="State is fixed to your assigned branch."
            />
          ) : (
            <SearchableDropdown
              value={scope.branch_state}
              onChange={(code) => onScopeChange({ branch_state: code, satellite_site: "" })}
              options={stateOptions}
              disabled={!canPickState}
              placeholder={canPickState ? "All states" : "Select a country first"}
              searchPlaceholder="Search state"
              emptyMessage="No states match"
              ariaLabel="State / region"
            />
          )}
        </div>
      )}
      {(v.satellite || lockedSatelliteSite) && (
        <div className="sa-field" style={{ marginBottom: 0 }}>
          <label className="sa-label">Satellite / branch</label>
          {lockedSatelliteSite ? (
            <LockedGeoField
              label=""
              value={lockedSatelliteSite}
              hint="Satellite is fixed to your assigned church site."
            />
          ) : (
            <SearchableDropdown
              value={scope.satellite_site}
              onChange={(site) => onScopeChange({ satellite_site: site })}
              options={satelliteOptions}
              disabled={!canPickSatellite}
              placeholder={
                !canPickState
                  ? "Select a country first"
                  : allowAllSatellites || lockedStateCode || scope.branch_state
                    ? "All satellites"
                    : "Select a state first"
              }
              searchPlaceholder="Search by name or address"
              emptyMessage="No branches match"
              ariaLabel="Satellite / branch"
            />
          )}
        </div>
      )}
      {showLeaderType ? (
        <AnnouncementLeaderTypeField
          label={leaderTypeLabel}
          hint={leaderTypeHint}
          value={leaderMode}
          options={leaderModeOptions}
          onChange={onLeaderModeChange}
          placeholder={leaderTypePlaceholder}
          ariaLabel={leaderTypeAriaLabel}
        />
      ) : null}
      {showPastorRole ? (
        <AnnouncementLeaderTypeField
          label={pastorRoleLabel}
          hint={pastorRoleHint}
          value={pastorRole}
          options={pastorRoleOptions}
          onChange={onPastorRoleChange}
          placeholder={pastorRolePlaceholder}
          ariaLabel={pastorRoleAriaLabel}
        />
      ) : null}
      {showPastorRoleFixed ? (
        <LockedGeoField
          label={pastorRoleFixedLabel}
          value={pastorRoleFixedValue}
        />
      ) : null}
    </div>
  );
}
