/** Human-readable service unit / sub-unit scope for leader dashboards (uses API-shaped admin). */
export function leaderScopeLabel(admin) {
  if (!admin?.role) return "";
  const u = String(admin.service_unit_name || "").trim();
  const s = String(admin.sub_unit_name || "").trim();
  const sat = String(admin.satellite_site || "").trim();
  if (admin.role === "data_entry_admin") return "All branches (data entry)";
  if (admin.role === "satellite_church_admin") {
    const cc = String(admin.branch_country || "").trim();
    const st = String(admin.branch_state || "").trim();
    const geo = [cc, st].filter(Boolean).join(" · ");
    if (geo && sat) return `${geo} · ${sat}`;
    return geo || sat || "";
  }
  if (admin.role === "service_unit_leader") return u;
  if (admin.role === "sub_unit_leader") {
    if (u && s) return `${u} · ${s}`;
    return u || s || "";
  }
  return "";
}
