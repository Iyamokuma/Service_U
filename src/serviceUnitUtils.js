/** Shared helpers for service units that may or may not have sub-units. */

function subUnitRecordName(record) {
  if (!record) return "";
  if (typeof record === "string") return String(record).trim();
  return String(record.name || "").trim();
}

/** Active sub-unit records from catalog (`sub_units`) or public form (`subs`). */
export function activeSubUnitRecords(unit) {
  if (!unit) return [];
  if (Array.isArray(unit.sub_units)) {
    return unit.sub_units.filter((s) => s && Number(s.is_active ?? 1) !== 0);
  }
  if (Array.isArray(unit.subs)) {
    return unit.subs.map((name) => ({ name: String(name).trim() })).filter((s) => s.name);
  }
  return [];
}

export function subUnitNamesForUnit(unit) {
  return activeSubUnitRecords(unit).map(subUnitRecordName).filter(Boolean);
}

export function unitHasSubUnits(unit) {
  return subUnitNamesForUnit(unit).length > 0;
}
