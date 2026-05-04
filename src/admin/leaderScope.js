/** Human-readable service unit / sub-unit scope for leader dashboards (uses API-shaped admin). */
export function leaderScopeLabel(admin) {
  if (!admin?.role) return "";
  const u = String(admin.service_unit_name || "").trim();
  const s = String(admin.sub_unit_name || "").trim();
  if (admin.role === "service_unit_leader") return u;
  if (admin.role === "sub_unit_leader") {
    if (u && s) return `${u} · ${s}`;
    return u || s || "";
  }
  return "";
}
