/** Shared role checks for admin UI and API. */

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

export function isSupervisoryBranchRole(role) {
  return (
    role === "country_super_admin" ||
    role === "state_super_admin" ||
    role === "satellite_church_admin"
  );
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
