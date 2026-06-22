import { isActingAsStateAdmin } from "./adminViewMode.js";
import { branchCountryLabel, branchStateLabel } from "./branchRegions.js";
import { isCountrySuperAdmin, isGlobalAdminRole, isStateSuperAdmin } from "./roles.js";
import { satelliteSitesForBranch } from "./satelliteSites.js";
import { stateSelectOptionsForDropdown, statesForCountryPicker } from "./catalogGeoOptions.js";

const ADMIN_ROLES_GLOBAL = [
  { value: "general_admin", label: "General Admin" },
  { value: "country_super_admin", label: "Country Admin" },
  { value: "state_super_admin", label: "State Branch Admin" },
  { value: "satellite_church_admin", label: "Satellite Pastor Admin" },
];

const ADMIN_ROLES_COUNTRY = [
  { value: "state_super_admin", label: "State Branch Pastor" },
  { value: "satellite_church_admin", label: "Satellite Pastor" },
];

const LEADER_MODES_DEFAULT = [
  { value: "all", label: "All leaders (service unit & sub-unit)" },
  { value: "service_unit", label: "Service unit leaders only" },
  { value: "sub_unit", label: "Sub-unit leaders (select unit + sub-unit)" },
];

const LEADER_MODES_COUNTRY = [
  { value: "all", label: "All service unit heads (service unit & sub-unit)" },
  { value: "service_unit", label: "Service unit heads only" },
  { value: "sub_unit", label: "Sub-unit heads (select unit + sub-unit)" },
];

const DESTINATION_TABS_DEFAULT = [
  { id: "members", label: "For Members" },
  { id: "leaders", label: "For Leaders" },
  { id: "admins", label: "For Admins" },
];

const DESTINATION_TABS_COUNTRY = [
  { id: "members", label: "Service Unit Members" },
  { id: "leaders", label: "Service Unit Heads" },
  { id: "admins", label: "Pastors" },
];

/** Satellite Pastor — members + service unit heads only (no admins destination). */
const DESTINATION_TABS_SATELLITE = [
  { id: "members", label: "Service Unit Members" },
  { id: "leaders", label: "Service Unit Heads" },
];

const LEADER_MODES_SATELLITE = [
  { value: "service_unit", label: "Service unit leaders" },
  { value: "sub_unit", label: "Sub unit leaders" },
];

const SATELLITE_LEADER_DISPLAY = {
  service_unit: "Service unit leaders",
  sub_unit: "Sub unit leaders",
};

const SATELLITE_LEADER_UI = {
  leaderScopeSectionTitle: "Service unit heads",
  leaderTypeTitle: "Service unit head role",
  leaderTypeLabel: "Service unit heads",
  leaderTypeHint: "Select Service unit leaders or Sub unit leaders.",
  defaultLeaderMode: "service_unit",
};

const DESTINATION_TABS_STATE_BRANCH = [
  { id: "members", label: "Service Unit Members" },
  { id: "leaders", label: "Service Unit Heads" },
  { id: "admins", label: "Satellite Pastors" },
];

/** State Branch Admin → Satellite Pastors tab (within assigned state only). */
const ADMIN_ROLES_STATE_BRANCH = [{ value: "satellite_church_admin", label: "Satellite Pastor" }];

const BRANCH_AUDIENCE_LEADER_MODES = LEADER_MODES_COUNTRY;

const BRANCH_AUDIENCE_LEADER_DISPLAY = {
  all: "All service unit heads",
  service_unit: "Service unit heads",
  sub_unit: "Sub-unit heads",
};

const BRANCH_AUDIENCE_LEADER_UI = {
  leaderTypeTitle: "Service unit head type",
  leaderTypeLabel: "Service unit heads",
  leaderTypeHint:
    "Service unit only: unit heads. Sub-unit: pick a unit and sub-unit for sub-unit heads.",
};

const ADMIN_ROLES_STATE = [
  { value: "state_super_admin", label: "State Branch Admin" },
  { value: "satellite_church_admin", label: "Satellite Pastor Admin" },
  { value: "service_unit_leader", label: "Service Unit Leader" },
  { value: "sub_unit_leader", label: "Sub-unit Leader" },
];

const ADMIN_ROLES_SATELLITE = [
  { value: "satellite_church_admin", label: "Satellite Pastor Admin" },
  { value: "service_unit_leader", label: "Service Unit Leader" },
  { value: "sub_unit_leader", label: "Sub-unit Leader" },
];

/** UI field visibility for audience narrowing (country shown separately when locked). */
const SCOPE_VISIBILITY_BY_ROLE = {
  country_super_admin: { country: false, state: true, satellite: true, unit: true, subunit: true },
  state_super_admin: { country: false, state: false, satellite: true, unit: true, subunit: true },
  satellite_church_admin: { country: false, state: false, satellite: false, unit: true, subunit: true },
  service_unit_leader: { country: false, state: false, satellite: false, unit: false, subunit: true },
  sub_unit_leader: { country: false, state: false, satellite: false, unit: false, subunit: false },
  data_entry_admin: { country: true, state: true, satellite: true, unit: true, subunit: true },
};

const DEFAULT_ADMIN_ROLES_BY_SENDER = {
  country_super_admin: ["state_super_admin", "satellite_church_admin"],
  state_super_admin: ["satellite_church_admin"],
  satellite_church_admin: ["service_unit_leader", "sub_unit_leader"],
  service_unit_leader: ["sub_unit_leader"],
  sub_unit_leader: ["sub_unit_leader"],
};

const DESTINATION_TABS_SUB_UNIT_MEMBERS_ONLY = [{ id: "members", label: "Service Unit Members" }];

/** Send-all audience checkboxes (country / state branch announcements). */
export const SEND_ALL_AUDIENCE_OPTIONS = [
  { value: "members", label: "Unit members" },
  { value: "service_unit_leaders", label: "Service unit leaders" },
  { value: "sub_unit_leaders", label: "Sub unit leaders" },
  { value: "satellite_pastors", label: "Satellite pastors" },
  { value: "state_branch_pastors", label: "State branch pastors" },
];

export function usesSendAllDestination(policy) {
  if (!policy || policy.isServiceUnitLeader || policy.isSubUnitLeader || policy.membersOnly) return false;
  return Boolean(policy.isCountryAdmin || policy.isStateBranchAudience);
}

export function sendAllAudienceOptionsForPolicy(policy) {
  if (policy?.isStateBranchAudience && !policy?.isCountryAdmin) {
    return SEND_ALL_AUDIENCE_OPTIONS.filter((a) => a.value !== "state_branch_pastors");
  }
  if (policy?.isCountryAdmin && policy?.actingAsState) {
    return SEND_ALL_AUDIENCE_OPTIONS.filter((a) => a.value !== "state_branch_pastors");
  }
  if (policy?.isCountryAdmin) {
    return SEND_ALL_AUDIENCE_OPTIONS;
  }
  return SEND_ALL_AUDIENCE_OPTIONS;
}

/** Service Unit Leader — create announcement destination radios. */
const DESTINATION_TABS_SERVICE_UNIT = [
  { id: "members", label: "Service Unit Members" },
  { id: "leaders", label: "Sub Unit Leaders" },
];

const LEADER_MODES_SERVICE_UNIT = [
  { value: "all", label: "All sub-unit leaders" },
  { value: "sub_unit", label: "Sub-unit leaders (select sub-unit)" },
];

const LEADER_DISPLAY_SERVICE_UNIT = {
  all: "All sub-unit leaders",
  sub_unit: "Sub-unit leaders",
  service_unit: "Service unit leaders",
};

const SERVICE_UNIT_LEADER_UI = {
  leaderScopeSectionTitle: "Sub Unit Leaders",
  leaderTypeTitle: "Sub-unit leaders",
  leaderTypeLabel: "Sub Unit Leaders",
  leaderTypeHint:
    "Reach every sub-unit leader in your service unit, or choose one sub-unit to narrow the audience.",
};

/** Role-specific announcement destination labels. */
export function getAnnouncementDestinationLabels(policy) {
  if (policy?.membersOnly) {
    return {
      destinationTabs: DESTINATION_TABS_SUB_UNIT_MEMBERS_ONLY,
      membersOnly: true,
      typePrefix: {
        members: "Service Unit Members",
        leaders: "Leaders",
        admins: "Admins",
      },
      pastorsSubtitle: "",
      broadcastSubtitle:
        "Send announcements to approved unit members in your sub-unit by email and/or push notification.",
      leaderModeOptions: LEADER_MODES_DEFAULT,
      leaderModeDisplay: {
        all: "All leaders",
        service_unit: "Service unit leaders",
        sub_unit: "Sub-unit leaders",
      },
      allRolesLabel: "All admins",
      adminRolesSectionTitle: "Admin roles",
      adminRolesHint: "",
      leaderTypeTitle: "Leader type",
      leaderTypeLabel: "Leaders",
      leaderTypeHint: "",
      usesBranchAudienceLabels: true,
    };
  }
  if (policy?.isStateBranchAudience) {
    return {
      destinationTabs: DESTINATION_TABS_STATE_BRANCH,
      typePrefix: {
        members: "Service Unit Members",
        leaders: "Service Unit Heads",
        admins: "Satellite Pastors",
      },
      pastorsSubtitle: "Satellite Pastor admins at churches within your state/region.",
      broadcastSubtitle:
        "Broadcast to service unit members, service unit heads, or satellite pastors within your state by email and/or push notification.",
      leaderModeOptions: BRANCH_AUDIENCE_LEADER_MODES,
      leaderModeDisplay: BRANCH_AUDIENCE_LEADER_DISPLAY,
      allRolesLabel: "All satellite pastors",
      adminRolesSectionTitle: "Satellite Pastors",
      adminRolesHint:
        "Only Satellite Pastor admins in your state are listed. Country and state are fixed to your branch location.",
      ...BRANCH_AUDIENCE_LEADER_UI,
      usesBranchAudienceLabels: true,
    };
  }
  if (policy?.isCountryAdmin && !policy?.actingAsState) {
    return {
      destinationTabs: DESTINATION_TABS_COUNTRY,
      typePrefix: {
        members: "Service Unit Members",
        leaders: "Service Unit Heads",
        admins: "Pastors",
      },
      pastorsSubtitle: "State Branch Pastors and Satellite Pastors",
      broadcastSubtitle:
        "Broadcast to service unit members, service unit heads, or pastors by email and/or push notification.",
      leaderModeOptions: BRANCH_AUDIENCE_LEADER_MODES,
      leaderModeDisplay: BRANCH_AUDIENCE_LEADER_DISPLAY,
      allRolesLabel: "All pastors",
      adminRolesSectionTitle: "Pastors",
      adminRolesHint: "State Branch Pastors and Satellite Pastors within your country.",
      ...BRANCH_AUDIENCE_LEADER_UI,
      usesBranchAudienceLabels: true,
    };
  }
  if (policy?.isServiceUnitLeader) {
    return {
      destinationTabs: DESTINATION_TABS_SERVICE_UNIT,
      typePrefix: {
        members: "Service Unit Members",
        leaders: "Sub Unit Leaders",
        admins: "Admins",
      },
      pastorsSubtitle: "",
      broadcastSubtitle:
        "Broadcast to service unit members or sub-unit leaders within your service unit by email and/or push notification.",
      leaderModeOptions: LEADER_MODES_SERVICE_UNIT,
      leaderModeDisplay: LEADER_DISPLAY_SERVICE_UNIT,
      allRolesLabel: "All sub-unit leaders",
      adminRolesSectionTitle: "Sub Unit Leaders",
      adminRolesHint: "",
      ...SERVICE_UNIT_LEADER_UI,
      usesBranchAudienceLabels: true,
    };
  }
  if (policy?.isSatellitePastor) {
    return {
      destinationTabs: DESTINATION_TABS_SATELLITE,
      typePrefix: {
        members: "Service Unit Members",
        leaders: "Service Unit Heads",
        admins: "Admins",
      },
      pastorsSubtitle: "",
      broadcastSubtitle:
        "Broadcast to service unit members or service unit heads by email and/or push notification.",
      leaderModeOptions: LEADER_MODES_SATELLITE,
      leaderModeDisplay: SATELLITE_LEADER_DISPLAY,
      allRolesLabel: "All admins",
      adminRolesSectionTitle: "Admin roles",
      adminRolesHint: "Only admin tiers within your satellite church are available.",
      ...SATELLITE_LEADER_UI,
      usesBranchAudienceLabels: true,
    };
  }
  return {
    destinationTabs: DESTINATION_TABS_DEFAULT,
    typePrefix: {
      members: "Members",
      leaders: "Leaders",
      admins: "Admins",
    },
    pastorsSubtitle: "",
    broadcastSubtitle: "Broadcast to members, leaders, or admins by email and/or push notification.",
    leaderModeOptions: LEADER_MODES_DEFAULT,
    leaderModeDisplay: {
      all: "All leaders",
      service_unit: "Service unit leaders",
      sub_unit: "Sub-unit leaders",
    },
    allRolesLabel: "All admins",
    adminRolesSectionTitle: "Admin roles",
    adminRolesHint: "",
    leaderTypeTitle: "Leader type",
    leaderTypeLabel: "Leaders",
    leaderTypeHint:
      "Service unit only: unit leaders. Sub-unit: pick a unit and sub-unit for sub-unit leaders.",
    usesBranchAudienceLabels: false,
  };
}

export function announcementDestinationTabs(policy) {
  return getAnnouncementDestinationLabels(policy).destinationTabs;
}

export function announcementLeaderModeOptions(policy) {
  return getAnnouncementDestinationLabels(policy).leaderModeOptions;
}

export function getAnnouncementScopePolicy(admin, viewMode) {
  const role = admin?.role || "";
  const isGlobal = isGlobalAdminRole(role) || role === "data_entry_admin";
  const isCountryAdmin = isCountrySuperAdmin(role);
  const isSatellitePastor = role === "satellite_church_admin";
  const isServiceUnitLeader = role === "service_unit_leader";
  const isSubUnitLeader = role === "sub_unit_leader";
  const isStateAdmin = isStateSuperAdmin(role);
  const actingAsState = isCountryAdmin && isActingAsStateAdmin(admin, viewMode);
  const isStateBranchAudience = isStateSuperAdmin(role) || (isCountryAdmin && actingAsState);
  const membersOnly = isSubUnitLeader;

  const lockedCountry = isGlobal
    ? ""
    : String(admin?.branch_country || "").trim().toUpperCase();
  const lockedState = isGlobal
    ? ""
    : isStateAdmin || actingAsState
      ? String(admin?.branch_state || "").trim().toUpperCase()
      : "";
  const lockedSatellite =
    role === "satellite_church_admin" ||
    ((role === "service_unit_leader" || role === "sub_unit_leader") && admin?.satellite_site)
      ? String(admin?.satellite_site || "").trim()
      : "";
  const lockedServiceUnitId =
    role === "service_unit_leader" || role === "sub_unit_leader" ? admin?.service_unit_id || "" : "";
  const lockedSubUnit = role === "sub_unit_leader" ? String(admin?.sub_unit_name || "").trim() : "";

  let adminRoleOptions = ADMIN_ROLES_GLOBAL;
  if (isStateBranchAudience) adminRoleOptions = ADMIN_ROLES_STATE_BRANCH;
  else if (isCountryAdmin) adminRoleOptions = ADMIN_ROLES_COUNTRY;
  else if (isStateAdmin || actingAsState) adminRoleOptions = ADMIN_ROLES_STATE;
  else if (role === "satellite_church_admin") adminRoleOptions = ADMIN_ROLES_SATELLITE;
  else if (role === "service_unit_leader") {
    adminRoleOptions = [{ value: "sub_unit_leader", label: "Sub Unit Leader" }];
  }
  else if (role === "sub_unit_leader") adminRoleOptions = [{ value: "sub_unit_leader", label: "Sub-unit Leader" }];

  const defaultAdminRoles = isGlobal
    ? ["general_admin", "country_super_admin", "state_super_admin", "satellite_church_admin"]
    : isStateBranchAudience
      ? ["satellite_church_admin"]
      : DEFAULT_ADMIN_ROLES_BY_SENDER[role] || ["sub_unit_leader"];

  const visibility =
    isGlobal
      ? { country: true, state: true, satellite: true, unit: true, subunit: true }
      : SCOPE_VISIBILITY_BY_ROLE[role] || { country: false, state: true, satellite: true, unit: true, subunit: true };

  const base = {
    isGlobal,
    isCountryAdmin,
    isSatellitePastor,
    isServiceUnitLeader,
    isSubUnitLeader,
    membersOnly,
    isStateBranchAudience,
    isStateAdmin: isStateAdmin || actingAsState,
    actingAsState,
    lockedCountry,
    lockedState,
    lockedSatellite,
    lockedServiceUnitId,
    lockedSubUnit,
    visibility,
    adminRoleOptions,
    defaultAdminRoles,
    usesSendAll: false,
    scopeHint: buildScopeHint({
      isGlobal,
      isCountryAdmin,
      actingAsState,
      isStateAdmin,
      isStateBranchAudience,
      role,
      lockedCountry,
      lockedState,
      lockedSatellite,
    }),
  };
  const withSendAll = { ...base, usesSendAll: usesSendAllDestination(base) };
  return { ...withSendAll, destinationLabels: getAnnouncementDestinationLabels(withSendAll) };
}

function buildScopeHint(ctx) {
  if (ctx.isGlobal) {
    return "You can target any country, state, or satellite from the church directory.";
  }
  if (ctx.role === "satellite_church_admin" && ctx.lockedSatellite) {
    return `Scoped to your satellite: ${ctx.lockedSatellite} (${branchStateLabel(ctx.lockedCountry, ctx.lockedState) || ctx.lockedState}).`;
  }
  if (ctx.isStateBranchAudience && ctx.lockedState) {
    return `All audiences are limited to ${branchStateLabel(ctx.lockedCountry, ctx.lockedState) || ctx.lockedState}, ${branchCountryLabel(ctx.lockedCountry) || ctx.lockedCountry}. Optionally narrow by satellite church within this state.`;
  }
  if (ctx.isCountryAdmin && ctx.actingAsState) {
    return `Scoped to your headquarters state only (${branchStateLabel(ctx.lockedCountry, ctx.lockedState) || ctx.lockedState}).`;
  }
  if (ctx.isCountryAdmin && ctx.lockedCountry) {
    return `Scoped to ${branchCountryLabel(ctx.lockedCountry) || ctx.lockedCountry}. Optionally narrow by state or satellite using church data.`;
  }
  if (ctx.role === "service_unit_leader") {
    const sat = ctx.lockedSatellite ? ` at ${ctx.lockedSatellite}` : "";
    return `All audiences are limited to your assigned service unit${sat}. Members and sub-unit leaders must belong to this unit.`;
  }
  if (ctx.role === "sub_unit_leader") {
    return "Announcements are sent only to approved unit members in your assigned sub-unit.";
  }
  return "Your announcement is limited to your assigned jurisdiction.";
}

/** Country dropdown options (global = all branch countries). */
export function announcementCountryOptions(lockedCountry, branchCountries) {
  if (lockedCountry) {
    const c = branchCountries.find((x) => x.code === lockedCountry);
    return [
      {
        value: lockedCountry,
        label: c?.name || branchCountryLabel(lockedCountry) || lockedCountry,
      },
    ];
  }
  return branchCountries.map((c) => ({ value: c.code, label: c.name }));
}

/** State dropdown from directory catalog (full region names, not codes). */
export function announcementStateOptions(churches, lockedCountry, lockedState, catalog = null) {
  if (lockedState) {
    const label = branchStateLabel(lockedCountry, lockedState) || lockedState;
    return [{ value: label, label }];
  }
  const cc = String(lockedCountry || "").trim().toUpperCase();
  if (!cc) return [];
  const rows = statesForCountryPicker(cc, { catalog, churches: churches || [] });
  return [{ value: "", label: "All states" }, ...stateSelectOptionsForDropdown(rows, cc)];
}

/** State rows for resolving announcement scope picks back to branch_state codes. */
export function announcementStateRows(churches, lockedCountry, catalog = null) {
  const cc = String(lockedCountry || "").trim().toUpperCase();
  if (!cc) return [];
  return statesForCountryPicker(cc, { catalog, churches: churches || [] });
}

export function announcementSatelliteOptions(churches, lockedCountry, lockedState, lockedSatellite) {
  if (lockedSatellite) {
    return [{ value: lockedSatellite, label: lockedSatellite }];
  }
  const cc = String(lockedCountry || "").trim().toUpperCase();
  const st = String(lockedState || "").trim().toUpperCase();
  if (!cc || !st) return [];
  const byName = new Map();
  for (const ch of churches || []) {
    if (String(ch.branch_country || "").toUpperCase() !== cc) continue;
    if (String(ch.branch_state || "").toUpperCase() !== st) continue;
    const name = String(ch.name || "").trim();
    if (!name || byName.has(name)) continue;
    byName.set(name, String(ch.address || "").trim());
  }
  const sites = satelliteSitesForBranch(churches, cc, st);
  for (const name of sites) {
    if (!byName.has(name)) byName.set(name, "");
  }
  return [
    { value: "", label: "All satellites" },
    ...[...byName.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, address]) => ({ value: name, label: name, meta: address })),
  ];
}

export function initialAnnouncementGeoForm(admin, policy) {
  return {
    branch_country: policy.lockedCountry || admin?.branch_country || "",
    branch_state: policy.lockedState || admin?.branch_state || "",
    satellite_site: policy.lockedSatellite || admin?.satellite_site || "",
    service_unit_id: policy.lockedServiceUnitId || admin?.service_unit_id || "",
    sub_unit: policy.lockedSubUnit || admin?.sub_unit_name || "",
  };
}

/** Force destination_config to the sender's jurisdiction before API submit. */
export function applyAnnouncementScopeLocks(destinationConfig, policy) {
  const cfg = { ...destinationConfig };
  if (policy.lockedCountry) cfg.branch_country = policy.lockedCountry;
  if (policy.lockedState) cfg.branch_state = policy.lockedState;
  if (policy.lockedSatellite) cfg.satellite_site = policy.lockedSatellite;
  if (policy.lockedServiceUnitId) cfg.service_unit_id = policy.lockedServiceUnitId;
  if (policy.lockedSubUnit) cfg.sub_unit = policy.lockedSubUnit;
  return cfg;
}
