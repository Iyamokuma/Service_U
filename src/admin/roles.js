/** Shared role checks for admin UI and API. */

export function roleDisplayLabel(role) {
  if (!role) return "—";
  const labels = {
    super_admin: "Super Admin",
    general_admin: "General Admin",
    data_entry_admin: "Data Entry Admin",
    country_super_admin: "Country Admin",
    state_super_admin: "State Branch Admin",
    satellite_church_admin: "Satellite Pastor Admin",
    service_unit_leader: "Service Unit Leader",
    sub_unit_leader: "Sub-Unit Leader",
  };
  if (labels[role]) return labels[role];
  return String(role)
    .split("_")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ""))
    .filter(Boolean)
    .join(" ");
}

export function isRootSuperAdmin(role) {
  return role === "super_admin";
}

export function isGlobalAdminRole(role) {
  return role === "super_admin" || role === "general_admin";
}

/** Registration intake / queue access similar to general admin; no platform settings. */
export function isDataEntryAdmin(role) {
  return role === "data_entry_admin";
}

/** Countries / states / churches directory (admin-managed, public form lists). */
export function canEditBranchCatalog(role) {
  return role === "super_admin" || role === "general_admin" || role === "data_entry_admin";
}

export function isCountrySuperAdmin(role) {
  return role === "country_super_admin";
}

export function isStateSuperAdmin(role) {
  return role === "state_super_admin";
}

export function isSupervisoryBranchRole(role) {
  return (
    role === "country_super_admin" ||
    role === "state_super_admin" ||
    role === "satellite_church_admin"
  );
}

/** Admin roles a country super admin may create, edit, or delete (within their country). */
export const COUNTRY_MANAGED_ADMIN_ROLES = [
  "satellite_church_admin",
  "state_super_admin",
  "service_unit_leader",
  "sub_unit_leader",
];

export function canCountryAdminManageRole(targetRole) {
  return COUNTRY_MANAGED_ADMIN_ROLES.includes(targetRole);
}

export function isServiceUnitLeader(role) {
  return role === "service_unit_leader";
}

/** Service unit leaders manage sub-unit leader accounts only (not sub-unit structure). */
export function canManageSubUnitAdmins(role) {
  return isServiceUnitLeader(role) || isGlobalAdminRole(role);
}

/** Creating, renaming, or deleting sub-units (structural changes). */
export function canManageSubUnitStructure(role) {
  return isGlobalAdminRole(role);
}

/** Roles allowed to create announcements; the API scopes each post to that admin’s jurisdiction. */
export function canPostAnnouncements(role) {
  return (
    role === "super_admin" ||
    role === "general_admin" ||
    role === "country_super_admin" ||
    role === "state_super_admin" ||
    role === "satellite_church_admin" ||
    role === "service_unit_leader" ||
    role === "sub_unit_leader" ||
    role === "data_entry_admin"
  );
}
