import { SearchableDropdown } from "./SearchableDropdown.jsx";

/** Satellite-style leader type picker (service unit vs sub unit leaders). */
export function AnnouncementLeaderTypeField({
  value,
  onChange,
  options,
  label,
  hint,
  placeholder = "Select leader type",
  ariaLabel = "Leader type",
}) {
  return (
    <div className="sa-field" style={{ marginBottom: 0 }}>
      <label className="sa-label">{label}</label>
      <SearchableDropdown
        value={value}
        onChange={onChange}
        options={options}
        placeholder={placeholder}
        searchPlaceholder="Search option"
        emptyMessage="No options"
        ariaLabel={ariaLabel}
      />
      {hint ? <div className="sa-field-hint">{hint}</div> : null}
    </div>
  );
}
