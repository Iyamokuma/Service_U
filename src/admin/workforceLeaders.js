/** Shared workforce leader list helpers. */

export const WORKFORCE_PAGE_SIZE = 25;

export function compareLeadersAlphabetical(a, b) {
  return String(a.full_name || "").localeCompare(String(b.full_name || ""), undefined, {
    sensitivity: "base",
  });
}

export function leaderRoleLabel(role) {
  if (role === "service_unit_leader") return "Service unit leader";
  if (role === "sub_unit_leader") return "Sub-unit leader";
  return String(role || "—");
}

export function buildUnitNameMap(units) {
  const map = new Map();
  for (const u of units || []) {
    map.set(Number(u.id), String(u.name || ""));
  }
  return map;
}
