import { MONTHS, YEARS_FULL } from "../data.js";
import { Select } from "./Inputs.jsx";

export function DateSplit({
  value,
  onChange,
  includeDay = true,
  includeYear = true,
  yearRequired = true,
  yearRange = YEARS_FULL,
  error,
}) {
  const { month = "", day = "", year = "" } = value || {};
  const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1));
  const MONTH_OPTS = MONTHS.map((m, i) => [String(i + 1), m]);

  const cls =
    !includeDay && includeYear
      ? "date-split month-year"
      : !includeYear
      ? "date-split no-year"
      : "date-split";

  return (
    <div className={cls}>
      <Select
        value={month}
        onChange={(v) => onChange({ ...value, month: v })}
        options={MONTH_OPTS}
        placeholder="Month"
        state={error ? "error" : undefined}
      />
      {includeDay && (
        <Select
          value={day}
          onChange={(v) => onChange({ ...value, day: v })}
          options={DAYS}
          placeholder="Day"
          state={error ? "error" : undefined}
        />
      )}
      {includeYear && (
        <Select
          value={year}
          onChange={(v) => onChange({ ...value, year: v })}
          options={yearRange}
          placeholder={yearRequired ? "Year" : "Year (opt.)"}
          state={error ? "error" : undefined}
        />
      )}
    </div>
  );
}
