import { branchCountryLabel, branchStateLabel } from "./branchRegions.js";

/** Human-readable service unit / sub-unit scope for leader dashboards (uses API-shaped admin). */
export function leaderScopeLabel(admin, viewMode) {
  if (!admin?.role) return "";
  const u = String(admin.service_unit_name || "").trim();
  const s = String(admin.sub_unit_name || "").trim();
  const sat = String(admin.satellite_site || "").trim();
  if (admin.role === "data_entry_admin") return "All branches (data entry)";
  if (admin.role === "country_super_admin") {
    const cc = String(admin.branch_country || "").trim();
    const st = String(admin.branch_state || "").trim();
    if (viewMode === "state" && cc && st) {
      return `${branchCountryLabel(cc)} · ${branchStateLabel(cc, st)}`;
    }
    if (cc && st) {
      return `${branchCountryLabel(cc)} · HQ ${branchStateLabel(cc, st)}`;
    }
    return cc ? branchCountryLabel(cc) : "Country";
  }
  if (admin.role === "state_super_admin") {
    const cc = String(admin.branch_country || "").trim();
    const st = String(admin.branch_state || "").trim();
    if (cc && st) return `${branchCountryLabel(cc)} · ${branchStateLabel(cc, st)}`;
    return cc ? branchCountryLabel(cc) : "State";
  }
  if (admin.role === "satellite_church_admin") {
    const cc = String(admin.branch_country || "").trim();
    const st = String(admin.branch_state || "").trim();
    const geo = [cc, st].filter(Boolean).join(" · ");
    if (geo && sat) return `${geo} · ${sat}`;
    return geo || sat || "";
  }
  if (admin.role === "service_unit_leader") {
    const cc = String(admin.branch_country || "").trim();
    const st = String(admin.branch_state || "").trim();
    const sat = String(admin.satellite_site || "").trim();
    const geo = [cc, st].filter(Boolean).join(" · ");
    if (u && (geo || sat)) {
      const branch = sat ? `${geo} · ${sat}` : geo;
      return branch ? `${u} · ${branch}` : u;
    }
    return u || "Service unit";
  }
  if (admin.role === "sub_unit_leader") {
    if (u && s) return `${u} · ${s}`;
    return u || s || "";
  }
  return "";
}
