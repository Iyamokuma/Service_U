/** Audience tick boxes for Send all (global, country, and state branch admin). */
export function AnnouncementAudienceCheckboxes({
  options,
  selected = [],
  onChange,
  ariaLabel = "Send all audiences",
}) {
  if (!options?.length) return null;

  return (
    <div className="sa-ann-send-all-audiences" role="group" aria-label={ariaLabel}>
      {options.map((opt) => (
        <label key={opt.value} className="sa-field-toggle sa-ann-send-all-audience-item">
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
