import { isActingAsStateAdmin } from "./adminViewMode.js";
import { branchCountryLabel, branchStateLabel } from "./branchRegions.js";
import { isCountrySuperAdmin, isGlobalAdminRole, isStateSuperAdmin } from "./roles.js";
import { satelliteSitesForBranch } from "./satelliteSites.js";

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

const DESTINATION_TABS_BROADCAST = [
  { id: "members", label: "Unit members" },
  { id: "leaders", label: "Leaders" },
  { id: "admins", label: "Pastors" },
];

const DESTINATION_TABS_DEFAULT = DESTINATION_TABS_BROADCAST;

const DESTINATION_TABS_COUNTRY = DESTINATION_TABS_BROADCAST;

/** Satellite Pastor — unit members, leaders, and Send all. */
const DESTINATION_TABS_SATELLITE = [
  { id: "members", label: "Unit members" },
  { id: "leaders", label: "Leaders" },
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

const DESTINATION_TABS_STATE_BRANCH = DESTINATION_TABS_BROADCAST;

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

export const DESTINATION_TAB_SEND_ALL = { id: "send_all", label: "Send all" };

/** Send-all audience checkboxes (Send all destination tab). */
export const SEND_ALL_AUDIENCE_OPTIONS = [
  { value: "members", label: "Unit members" },
  { value: "service_unit_leaders", label: "Service unit leaders" },
  { value: "sub_unit_leaders", label: "Sub unit leaders" },
  { value: "satellite_pastors", label: "Satellite pastors" },
  { value: "state_branch_pastors", label: "State branch pastors" },
];

export function usesSendAllDestination(_policy) {
  return false;
}

/** Global, country, state branch, and satellite admin: Send all destination tab. */
export function showSendAllDestinationTab(policy) {
  if (policy?.membersOnly) return false;
  if (policy?.isGlobal) return true;
  if (policy?.isCountryAdmin && !policy?.actingAsState) return true;
  if (policy?.isStateBranchAudience) return true;
  if (policy?.isSatellitePastor) return true;
  return false;
}

/** Shared audience scope (country / state / satellite only — no units) across destination tabs. */
export function usesUnifiedAnnouncementGeo(policy) {
  return showSendAllDestinationTab(policy);
}

export function announcementDestinationTabsForPolicy(policy) {
  const tabs = getAnnouncementDestinationLabels(policy).destinationTabs;
  if (showSendAllDestinationTab(policy)) {
    return [...tabs, DESTINATION_TAB_SEND_ALL];
  }
  return tabs;
}

export function sendAllAudienceOptionsForPolicy(policy) {
  if (policy?.isSatellitePastor) {
    return SEND_ALL_AUDIENCE_OPTIONS.filter((a) =>
      ["members", "service_unit_leaders", "sub_unit_leaders"].includes(a.value),
    );
  }
  if (policy?.isGlobal || (policy?.isCountryAdmin && !policy?.actingAsState)) {
    return SEND_ALL_AUDIENCE_OPTIONS;
  }
  if (policy?.isStateBranchAudience) {
    return SEND_ALL_AUDIENCE_OPTIONS.filter((a) => a.value !== "state_branch_pastors");
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
      members: "Unit members",
      leaders: "Leaders",
      admins: "Pastors",
    },
    pastorsSubtitle: "",
    broadcastSubtitle: "Broadcast to unit members, leaders, or pastors by email and/or push notification.",
    leaderModeOptions: LEADER_MODES_SATELLITE,
    leaderModeDisplay: SATELLITE_LEADER_DISPLAY,
    allRolesLabel: "All admins",
    adminRolesSectionTitle: "Admin roles",
    adminRolesHint: "",
    ...SATELLITE_LEADER_UI,
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
    : isStateAdmin || actingAsState || role === "satellite_church_admin"
      ? String(admin?.branch_state || "").trim()
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
  return {
    ...withSendAll,
    showSendAllTab: showSendAllDestinationTab(withSendAll),
    useUnifiedGeo: usesUnifiedAnnouncementGeo(withSendAll),
    destinationLabels: getAnnouncementDestinationLabels(withSendAll),
  };
}

function buildScopeHint(ctx) {
  if (ctx.isGlobal) {
    return "Target all countries or narrow by country, state, and satellite. Send all reaches every selected audience tier within the scope you set.";
  }
  if (ctx.role === "satellite_church_admin" && ctx.lockedSatellite) {
    return `Scoped to your satellite: ${ctx.lockedSatellite} (${branchStateLabel(ctx.lockedCountry, ctx.lockedState) || ctx.lockedState}). Use Send all to reach unit members and leaders within this church.`;
  }
  if (ctx.isStateBranchAudience && ctx.lockedState) {
    return `All audiences are limited to ${branchStateLabel(ctx.lockedCountry, ctx.lockedState) || ctx.lockedState}, ${branchCountryLabel(ctx.lockedCountry) || ctx.lockedCountry}. Narrow by satellite or use Send all with audience checkboxes.`;
  }
  if (ctx.isCountryAdmin && ctx.actingAsState) {
    return `Scoped to your headquarters state only (${branchStateLabel(ctx.lockedCountry, ctx.lockedState) || ctx.lockedState}).`;
  }
  if (ctx.isCountryAdmin && ctx.lockedCountry) {
    return `Scoped to ${branchCountryLabel(ctx.lockedCountry) || ctx.lockedCountry}. Narrow by state or satellite, or use Send all with audience checkboxes.`;
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

/** Country dropdown options (global = all branch countries; optional all-countries row). */
export function announcementCountryOptions(lockedCountry, branchCountries, { allowAllCountries = false } = {}) {
  if (lockedCountry) {
    const c = branchCountries.find((x) => x.code === lockedCountry);
    return [
      {
        value: lockedCountry,
        label: c?.name || branchCountryLabel(lockedCountry) || lockedCountry,
      },
    ];
  }
  const options = branchCountries.map((c) => ({ value: c.code, label: c.name }));
  if (allowAllCountries) {
    return [{ value: "", label: "All countries" }, ...options];
  }
  return options;
}

/** State dropdown from church directory for locked country. */
export function announcementStateOptions(churches, lockedCountry, lockedState) {
  if (lockedState) {
    return [
      {
        value: lockedState,
        label: branchStateLabel(lockedCountry, lockedState) || lockedState,
      },
    ];
  }
  const cc = String(lockedCountry || "").trim().toUpperCase();
  if (!cc) return [];
  const fromChurches = new Map();
  for (const ch of churches || []) {
    if (String(ch.branch_country || "").toUpperCase() !== cc) continue;
    const st = String(ch.branch_state || "").trim().toUpperCase();
    if (!st) continue;
    if (!fromChurches.has(st)) {
      fromChurches.set(st, branchStateLabel(cc, st) || st);
    }
  }
  return [
    { value: "", label: "All states" },
    ...[...fromChurches.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([value, label]) => ({ value, label })),
  ];
}

export function announcementSatelliteOptions(churches, lockedCountry, lockedState, lockedSatellite) {
  if (lockedSatellite) {
    return [{ value: lockedSatellite, label: lockedSatellite }];
  }
  const cc = String(lockedCountry || "").trim().toUpperCase();
  const st = String(lockedState || "").trim().toUpperCase();
  if (!cc) return [];
  const byName = new Map();
  for (const ch of churches || []) {
    if (String(ch.branch_country || "").toUpperCase() !== cc) continue;
    if (st && String(ch.branch_state || "").trim().toUpperCase() !== st) continue;
    const name = String(ch.name || "").trim();
    if (!name || byName.has(name)) continue;
    byName.set(name, String(ch.address || "").trim());
  }
  if (st) {
    const sites = satelliteSitesForBranch(churches, cc, st);
    for (const name of sites) {
      if (!byName.has(name)) byName.set(name, "");
    }
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
