import { useEffect, useMemo, useState } from "react";

/**
 * Search input + native select (same pattern as public ChurchLocationSection).
 */
export function SearchableSelect({
  value,
  onChange,
  options = [],
  disabled = false,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyMessage = "No matches",
  searchAriaLabel = "Filter options",
  selectClassName = "sa-field-select",
  searchClassName = "sa-input",
}) {
  const [filter, setFilter] = useState("");

  useEffect(() => {
    setFilter("");
  }, [disabled, options]);

  const normalized = useMemo(
    () =>
      options.map((o) => {
        if (typeof o === "string") return { value: o, label: o };
        return { value: String(o.value ?? ""), label: String(o.label ?? o.value ?? "") };
      }),
    [options],
  );

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return normalized;
    return normalized.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
    );
  }, [normalized, filter]);

  const selectPlaceholder = disabled
    ? placeholder
    : filtered.length
      ? placeholder
      : emptyMessage;

  return (
    <>
      <input
        type="search"
        className={searchClassName}
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder={searchPlaceholder}
        disabled={disabled}
        aria-label={searchAriaLabel}
        style={{ marginBottom: 8 }}
      />
      <select className={selectClassName} value={value} onChange={onChange} disabled={disabled}>
        <option value="">{selectPlaceholder}</option>
        {filtered.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </>
  );
}
