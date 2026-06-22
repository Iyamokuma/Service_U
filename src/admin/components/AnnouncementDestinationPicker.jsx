import { AnnouncementAudienceCheckboxes } from "./AnnouncementAudienceCheckboxes.jsx";

/**
 * Reusable destination tabs for create-announcement flows.
 * Global, country, and state branch admins include a Send all tab with audience checkboxes.
 */
export function AnnouncementDestinationPicker({
  tabs,
  destinationType,
  onDestinationChange,
  adminsSubtitle = "",
  sendAllAudiences = null,
  selectedAudiences = [],
  onAudiencesChange,
}) {
  const showSendAllAudiences = destinationType === "send_all" && sendAllAudiences?.length > 0;

  return (
    <div className="sa-field">
      <label className="sa-label">Destination</label>
      <div className="sa-ann-dest-tabs" role="radiogroup" aria-label="Announcement destination">
        {tabs.map((opt) => (
          <label key={opt.id} className="sa-field-toggle sa-ann-dest-tab" style={{ cursor: "pointer" }}>
            <input
              type="radio"
              name="ann-dest"
              checked={destinationType === opt.id}
              onChange={() => onDestinationChange(opt.id)}
            />
            <span className="sa-field-toggle-label">{opt.label}</span>
          </label>
        ))}
      </div>
      {destinationType === "admins" && adminsSubtitle ? (
        <p className="sa-field-hint" style={{ marginTop: 8, marginBottom: 0 }}>
          {adminsSubtitle}
        </p>
      ) : null}
      {showSendAllAudiences ? (
        <AnnouncementAudienceCheckboxes
          options={sendAllAudiences}
          selected={selectedAudiences}
          onChange={onAudiencesChange}
        />
      ) : null}
    </div>
  );
}
