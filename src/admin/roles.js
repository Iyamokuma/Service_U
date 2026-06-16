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

/** Super Admin accounts: editable by platform owner or General Admin (not by other roles). */
export function canManageSuperAdminAccount(role) {
  return isRootSuperAdmin(role) || role === "general_admin";
}

/** Registration intake / queue access similar to general admin; no platform settings. */
export function isDataEntryAdmin(role) {
  return role === "data_entry_admin";
}

/** Countries / states / churches directory (admin-managed, public form lists). */
export function canEditBranchCatalog(role) {
  return role === "super_admin" || role === "general_admin" || role === "data_entry_admin";
}

/** Direct publish to registration form (no approval queue). */
export function canPublishLocations(role) {
  return isGlobalAdminRole(role);
}

/** Propose locations via approval request. */
export function canProposeLocations(role) {
  return isDataEntryAdmin(role);
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

/** Roles a country admin may create directly (no request flow). */
export const COUNTRY_DIRECT_CREATE_ROLES = [
  "state_super_admin",
  "satellite_church_admin",
  "service_unit_leader",
  "sub_unit_leader",
];

/** Admin roles a country super admin may manage on the Users tab (within their country). */
export const COUNTRY_MANAGED_ADMIN_ROLES = [
  "state_super_admin",
  "satellite_church_admin",
  "service_unit_leader",
  "sub_unit_leader",
];

/** Headquarters state on Country Admin (required; set at creation or auto-assigned on login). */
export function countryAdminHomeState(admin) {
  if (admin?.role !== "country_super_admin") return "";
  return String(admin.branch_state || "").trim();
}

export function countryAdminActsAsStateAdmin(admin) {
  return !!countryAdminHomeState(admin);
}

export function canCountryAdminManageRole(targetRole) {
  return COUNTRY_MANAGED_ADMIN_ROLES.includes(targetRole);
}

/** Roles a satellite pastor may create directly at their church. */
export const SATELLITE_DIRECT_CREATE_ROLES = ["service_unit_leader", "sub_unit_leader"];

/** Roles a state branch admin (or Country Admin in state view) may create directly. */
export const STATE_DIRECT_CREATE_ROLES = [
  "satellite_church_admin",
  "service_unit_leader",
  "sub_unit_leader",
];

/** Admin roles a state branch admin may manage (within their state). */
export const STATE_MANAGED_ADMIN_ROLES = [
  "satellite_church_admin",
  "service_unit_leader",
  "sub_unit_leader",
];

export function canStateAdminManageRole(targetRole) {
  return STATE_MANAGED_ADMIN_ROLES.includes(targetRole);
}

/** Whether this admin role generally uses request→approval for new accounts (legacy helper). */
export function mustUseRequestFlow(role) {
  return role === "state_super_admin";
}

/** Request vs direct create when adding a new admin account. */
export function mustUseRequestFlowForCreate(actorRole, targetRole, viewMode) {
  if (actorRole === "country_super_admin" && COUNTRY_DIRECT_CREATE_ROLES.includes(targetRole)) {
    return false;
  }
  if (
    actorRole === "country_super_admin" &&
    viewMode === "state" &&
    STATE_DIRECT_CREATE_ROLES.includes(targetRole)
  ) {
    return false;
  }
  if (actorRole === "state_super_admin" && STATE_DIRECT_CREATE_ROLES.includes(targetRole)) {
    return false;
  }
  if (actorRole === "satellite_church_admin" && SATELLITE_DIRECT_CREATE_ROLES.includes(targetRole)) {
    return false;
  }
  if (actorRole === "country_super_admin") return true;
  return mustUseRequestFlow(actorRole);
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
