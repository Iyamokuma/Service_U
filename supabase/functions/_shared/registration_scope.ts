/** Queue / stats visibility: always use JWT-loaded admin row — never trust client-supplied viewer. */

export type AdminRow = Record<string, unknown>;

function norm(s: unknown): string {
  return String(s ?? "").trim();
}
function up(s: unknown): string {
  return norm(s).toUpperCase();
}

/** Case-insensitive match for full state names (and legacy uppercase codes). */
function branchStatesMatch(a: unknown, b: unknown): boolean {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return !x && !y;
  return x.localeCompare(y, undefined, { sensitivity: "accent" }) === 0;
}

// deno-lint-ignore no-explicit-any
function applyBranchStateScope(q: any, stateValue: unknown): any {
  const st = norm(stateValue);
  if (!st) return q;
  const legacyCode = st.toUpperCase();
  if (legacyCode === st && legacyCode.length <= 12 && /^[A-Z0-9]+$/.test(legacyCode)) {
    return q.or(`branch_state.ilike.${st},branch_state.eq.${legacyCode}`);
  }
  return q.ilike("branch_state", st);
}

/** Leaders may see legacy registrations with no satellite_site yet. */
function satelliteSiteMatchesScope(adminSat: string, rowSatellite: unknown): boolean {
  const sat = norm(adminSat);
  if (!sat) return true;
  const rowSat = norm(rowSatellite);
  return !rowSat || rowSat === sat;
}

// deno-lint-ignore no-explicit-any
function applyLeaderSatelliteSiteScope(q: any, sat: string): any {
  const site = norm(sat);
  if (!site) return q;
  return q.in("satellite_site", [site, ""]);
}

/** Country Admin in State view: scope data to headquarters state only (Country Admin account only). */
export function effectiveScopeAdmin(admin: AdminRow, scopeMode?: unknown): AdminRow {
  const role = norm(admin.role);
  if (role !== "country_super_admin") return admin;
  if (norm(scopeMode) !== "state") return admin;
  const st = up(admin.branch_state);
  if (!st) return admin;
  return { ...admin, role: "state_super_admin" };
}

/** Apply role-based filters to a PostgREST `registrations` query (Supabase client). */
// deno-lint-ignore no-explicit-any
export function applyRegistrationScopeQuery(q: any, admin: AdminRow, scopeMode?: unknown): any {
  const scoped = effectiveScopeAdmin(admin, scopeMode);
  const role = norm(scoped.role);
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
    if (st) q2 = applyBranchStateScope(q2, admin.branch_state);
    return q2;
  }
  if (role === "satellite_church_admin") {
    let q2 = q;
    const c = up(admin.branch_country);
    const st = up(admin.branch_state);
    const sat = norm(admin.satellite_site);
    if (c) q2 = q2.eq("branch_country", c);
    if (st) q2 = applyBranchStateScope(q2, admin.branch_state);
    if (sat) q2 = q2.eq("satellite_site", sat);
    return q2;
  }
  if (role === "service_unit_leader" || role === "sub_unit_leader") {
    let q2 = q;
    const uid = Number(admin.service_unit_id);
    if (Number.isFinite(uid)) q2 = q2.eq("unit_id", uid);
    if (role === "sub_unit_leader") {
      const sub = norm(admin.sub_unit_name);
      if (sub) q2 = q2.eq("sub_unit", sub);
    }
    const c = up(admin.branch_country);
    const st = up(admin.branch_state);
    const sat = norm(admin.satellite_site);
    if (c) q2 = q2.eq("branch_country", c);
    if (st) q2 = applyBranchStateScope(q2, admin.branch_state);
    q2 = applyLeaderSatelliteSiteScope(q2, sat);
    return q2;
  }
  return q;
}

/** True if this admin may read or mutate the given registration row. */
export function canAccessRegistration(admin: AdminRow, row: Record<string, unknown>, scopeMode?: unknown): boolean {
  const scoped = effectiveScopeAdmin(admin, scopeMode);
  const role = norm(scoped.role);
  if (role === "super_admin" || role === "general_admin" || role === "data_entry_admin") return true;
  if (role === "country_super_admin") {
    return up(admin.branch_country) === up(row.branch_country);
  }
  if (role === "state_super_admin") {
    return up(admin.branch_country) === up(row.branch_country) && branchStatesMatch(admin.branch_state, row.branch_state);
  }
  if (role === "satellite_church_admin") {
    const c = up(admin.branch_country);
    const st = up(admin.branch_state);
    const sat = norm(admin.satellite_site);
    if (!c || !st || !sat) return false;
    return up(row.branch_country) === c && branchStatesMatch(admin.branch_state, row.branch_state) && norm(row.satellite_site) === sat;
  }
  if (role === "service_unit_leader" || role === "sub_unit_leader") {
    if (Number(row.unit_id) !== Number(admin.service_unit_id)) return false;
    if (role === "sub_unit_leader") {
      if (norm(row.sub_unit).toLowerCase() !== norm(admin.sub_unit_name).toLowerCase()) return false;
    }
    const c = up(admin.branch_country);
    const st = up(admin.branch_state);
    const sat = norm(admin.satellite_site);
    if (c && up(row.branch_country) !== c) return false;
    if (st && !branchStatesMatch(admin.branch_state, row.branch_state)) return false;
    if (!satelliteSiteMatchesScope(sat, row.satellite_site)) return false;
    return true;
  }
  return false;
}
