/** Reusable audience tick boxes for Send all (global and country admin). */
export function AnnouncementAudienceCheckboxes({
  options,
  selected = [],
  onChange,
  ariaLabel = "Send all audiences",
}) {
  if (!options?.length) return null;

  return (
    <div className="sa-ann-admin-role-row" role="group" aria-label={ariaLabel}>
      {options.map((opt) => (
        <label key={opt.value} className="sa-field-toggle sa-ann-admin-role-item" style={{ cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={selected.includes(opt.value)}
            onChange={(e) => {
              const audiences = new Set(selected);
              if (e.target.checked) audiences.add(opt.value);
              else audiences.delete(opt.value);
              onChange([...audiences]);
            }}
          />
          <span className="sa-field-toggle-label">{opt.label}</span>
        </label>
      ))}
    </div>
  );
}
