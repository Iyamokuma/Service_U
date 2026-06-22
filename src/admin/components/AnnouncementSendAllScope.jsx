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
  showLeaderType = false,
  leaderMode = "",
  leaderModeOptions = [],
  onLeaderModeChange,
  leaderTypeLabel = "Leader type",
  leaderTypeHint = "",
  leaderTypePlaceholder = "Select audience",
  leaderTypeAriaLabel = "Leader type",
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
        showLeaderType={showLeaderType}
        leaderMode={leaderMode}
        leaderModeOptions={leaderModeOptions}
        onLeaderModeChange={onLeaderModeChange}
        leaderTypeLabel={leaderTypeLabel}
        leaderTypeHint={leaderTypeHint}
        leaderTypePlaceholder={leaderTypePlaceholder}
        leaderTypeAriaLabel={leaderTypeAriaLabel}
      />
      {scopeHint ? (
        <p className="sa-field-hint" style={{ marginTop: 12, marginBottom: 0 }}>
          {scopeHint}
        </p>
      ) : null}
    </section>
  );
}
