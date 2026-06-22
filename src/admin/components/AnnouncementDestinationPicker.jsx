/**
 * Reusable destination tabs for create-announcement flows.
 * Global admins can include a Send all tab alongside Members, Leaders, and Admins.
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
        <>
          <p className="sa-field-hint" style={{ marginTop: 12, marginBottom: 10 }}>
            Choose one or more groups to include in this broadcast.
          </p>
          <div className="sa-ann-admin-role-row" role="group" aria-label="Send all audiences">
            {sendAllAudiences.map((opt) => (
              <label key={opt.value} className="sa-field-toggle sa-ann-admin-role-item" style={{ cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={selectedAudiences.includes(opt.value)}
                  onChange={(e) => {
                    const audiences = new Set(selectedAudiences);
                    if (e.target.checked) audiences.add(opt.value);
                    else audiences.delete(opt.value);
                    onAudiencesChange([...audiences]);
                  }}
                />
                <span className="sa-field-toggle-label">{opt.label}</span>
              </label>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
