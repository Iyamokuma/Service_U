/**
 * Reusable destination tabs for create-announcement flows.
 * Global and country admins include a Send all tab alongside Members, Leaders, and Admins.
 */
export function AnnouncementDestinationPicker({
  tabs,
  destinationType,
  onDestinationChange,
  adminsSubtitle = "",
}) {
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
    </div>
  );
}
