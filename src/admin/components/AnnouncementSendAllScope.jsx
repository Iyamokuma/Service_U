import { AnnouncementAudienceGeoScope } from "./AnnouncementAudienceGeoScope.jsx";

/** Audience scope for Send all — geo only (no service unit / sub-unit narrowing). */
export function AnnouncementSendAllScope({
  scope,
  onScopeChange,
  churches,
  branchCountries,
  scopeHint,
  lockedCountryCode = "",
  lockedStateCode = "",
  lockedSatelliteSite = "",
  allowAllCountries = false,
  allowAllSatellites = false,
  vis,
  forceAllStates = false,
  forceAllSatellites = false,
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
  return (
    <section className="sa-ann-scope" aria-label="Announcement audience scope">
      <div className="sa-ann-scope-title">Audience scope</div>
      <AnnouncementAudienceGeoScope
        scope={scope}
        onScopeChange={onScopeChange}
        churches={churches}
        branchCountries={branchCountries}
        requireCountry={false}
        allowAllCountries={allowAllCountries}
        allowAllSatellites={allowAllSatellites}
        vis={vis || { country: true, state: true, satellite: true }}
        lockedCountryCode={lockedCountryCode}
        lockedStateCode={lockedStateCode}
        lockedSatelliteSite={lockedSatelliteSite}
        forceAllStates={forceAllStates}
        forceAllSatellites={forceAllSatellites}
        showLeaderType={showLeaderType}
        leaderMode={leaderMode}
        leaderModeOptions={leaderModeOptions}
        onLeaderModeChange={onLeaderModeChange}
        leaderTypeLabel={leaderTypeLabel}
        leaderTypeHint={leaderTypeHint}
        leaderTypePlaceholder={leaderTypePlaceholder}
        leaderTypeAriaLabel={leaderTypeAriaLabel}
        showPastorRole={showPastorRole}
        pastorRole={pastorRole}
        pastorRoleOptions={pastorRoleOptions}
        onPastorRoleChange={onPastorRoleChange}
        pastorRoleLabel={pastorRoleLabel}
        pastorRoleHint={pastorRoleHint}
        pastorRolePlaceholder={pastorRolePlaceholder}
        pastorRoleAriaLabel={pastorRoleAriaLabel}
        showPastorRoleFixed={showPastorRoleFixed}
        pastorRoleFixedLabel={pastorRoleFixedLabel}
        pastorRoleFixedValue={pastorRoleFixedValue}
      />
      {scopeHint ? (
        <p className="sa-field-hint" style={{ marginTop: 12, marginBottom: 0 }}>
          {scopeHint}
        </p>
      ) : null}
    </section>
  );
}
