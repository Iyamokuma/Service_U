import { useMemo } from "react";
import { SectionSegmentTabs } from "./SectionSegmentTabs.jsx";

/**
 * Service unit leader Application Queue: sub-unit picker (Users-page segment style).
 */
export function QueueSubUnitTabs({ subUnits = [], activeSubUnit = "", onChange, allLabel = "All sub-units" }) {
  const tabs = useMemo(
    () => [
      { id: "", label: allLabel },
      ...subUnits.map((name) => ({ id: name, label: name })),
    ],
    [subUnits, allLabel],
  );

  if (subUnits.length === 0) return null;

  return (
    <SectionSegmentTabs
      tabs={tabs}
      active={activeSubUnit}
      onChange={onChange}
      ariaLabel="Sub-unit"
      className="sa-users-section-tabs--wrap"
    />
  );
}
