/** Queue / stats visibility: always use JWT-loaded admin row — never trust client-supplied viewer. */

export type AdminRow = Record<string, unknown>;

function norm(s: unknown): string {
  return String(s ?? "").trim();
}
function up(s: unknown): string {
  return norm(s).toUpperCase();
}

/** Apply role-based filters to a PostgREST `registrations` query (Supabase client). */
// deno-lint-ignore no-explicit-any
export function applyRegistrationScopeQuery(q: any, admin: AdminRow): any {
  const role = norm(admin.role);
  if (role === "super_admin" || role === "general_admin" || role === "data_entry_admin") return q;
  if (role === "country_super_admin") {
    const c = up(admin.branch_country);
    return c ? q.eq("branch_country", c) : q;
  }
  if (role === "state_super_admin") {
    let q2 = q;
    const c = up(admin.branch_country);
    const st = up(admin.branch_state);
    if (c) q2 = q2.eq("branch_country", c);
    if (st) q2 = q2.eq("branch_state", st);
    return q2;
  }
  if (role === "satellite_church_admin") {
    let q2 = q;
    const c = up(admin.branch_country);
    const st = up(admin.branch_state);
    if (c) q2 = q2.eq("branch_country", c);
    if (st) q2 = q2.eq("branch_state", st);
    const sat = norm(admin.satellite_site);
    if (sat) q2 = q2.eq("satellite_site", sat);
    return q2;
  }
  if (role === "service_unit_leader") {
    const uid = Number(admin.service_unit_id);
    let q2 = Number.isFinite(uid) ? q.eq("unit_id", uid) : q;
    const c = up(admin.branch_country);
    const st = up(admin.branch_state);
    if (c && st) q2 = q2.eq("branch_country", c).eq("branch_state", st);
    return q2;
  }
  if (role === "sub_unit_leader") {
    const uid = Number(admin.service_unit_id);
    const sub = norm(admin.sub_unit_name);
    let q2 = Number.isFinite(uid) ? q.eq("unit_id", uid) : q;
    if (sub) q2 = q2.eq("sub_unit", sub);
    const c = up(admin.branch_country);
    const st = up(admin.branch_state);
    if (c && st) q2 = q2.eq("branch_country", c).eq("branch_state", st);
    return q2;
  }
  return q;
}

/** True if this admin may read or mutate the given registration row. */
export function canAccessRegistration(admin: AdminRow, row: Record<string, unknown>): boolean {
  const role = norm(admin.role);
  if (role === "super_admin" || role === "general_admin" || role === "data_entry_admin") return true;
  if (role === "country_super_admin") {
    return up(admin.branch_country) === up(row.branch_country);
  }
  if (role === "state_super_admin") {
    return up(admin.branch_country) === up(row.branch_country) && up(admin.branch_state) === up(row.branch_state);
  }
  if (role === "satellite_church_admin") {
    if (up(admin.branch_country) !== up(row.branch_country)) return false;
    if (up(admin.branch_state) !== up(row.branch_state)) return false;
    const sat = norm(admin.satellite_site);
    if (!sat) return true;
    return norm(row.satellite_site) === sat;
  }
  if (role === "service_unit_leader") {
    if (Number(row.unit_id) !== Number(admin.service_unit_id)) return false;
    const c = up(admin.branch_country);
    const st = up(admin.branch_state);
    if (c && st) {
      return up(row.branch_country) === c && up(row.branch_state) === st;
    }
    return true;
  }
  if (role === "sub_unit_leader") {
    if (Number(row.unit_id) !== Number(admin.service_unit_id)) return false;
    if (norm(row.sub_unit).toLowerCase() !== norm(admin.sub_unit_name).toLowerCase()) return false;
    const c = up(admin.branch_country);
    const st = up(admin.branch_state);
    if (c && st) {
      return up(row.branch_country) === c && up(row.branch_state) === st;
    }
    return true;
  }
  return false;
}
