/** Shared role checks for admin UI and API. */

export function isRootSuperAdmin(role) {
  return role === "super_admin";
}

export function isGlobalAdminRole(role) {
  return role === "super_admin" || role === "general_admin";
}

export function isSupervisoryBranchRole(role) {
  return role === "country_super_admin" || role === "state_super_admin";
}
