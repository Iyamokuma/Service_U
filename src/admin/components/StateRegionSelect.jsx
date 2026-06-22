import { useMemo } from "react";
import {
  ensureStateRowForCode,
  resolveStateCodeFromSelection,
  stateSelectionValueForCode,
} from "../catalogGeoOptions.js";

/**
 * Native state/region select — shows directory names, stores branch_state codes via onChange.
 */
export function StateRegionSelect({
  stateRows = [],
  countryCode = "",
  value = "",
  onChange,
  emptyOption = "Select state",
  allowEmpty = true,
  className = "sa-field-select",
  disabled = false,
  id,
  ...rest
}) {
  const rows = useMemo(
    () => ensureStateRowForCode(stateRows, countryCode, value),
    [stateRows, countryCode, value],
  );
  const displayValue = stateSelectionValueForCode(value, rows);

  return (
    <select
      id={id}
      className={className}
      value={displayValue}
      disabled={disabled}
      onChange={(e) => onChange?.(resolveStateCodeFromSelection(e.target.value, rows))}
      {...rest}
    >
      {allowEmpty ? <option value="">{emptyOption}</option> : null}
      {rows.map((s) => {
        const name = String(s.name || "").trim();
        if (!name) return null;
        return (
          <option key={s.code} value={name}>
            {name}
          </option>
        );
      })}
    </select>
  );
}
