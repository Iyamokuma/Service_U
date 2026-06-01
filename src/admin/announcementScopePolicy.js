import { isActingAsStateAdmin } from "./adminViewMode.js";
import { branchCountryLabel, branchStateLabel, branchStatesForCountry } from "./branchRegions.js";
import { isCountrySuperAdmin, isGlobalAdminRole, isStateSuperAdmin } from "./roles.js";
import { satelliteSitesForBranch } from "./satelliteSites.js";

const ADMIN_ROLES_GLOBAL = [
  { value: "general_admin", label: "General Admin" },
  { value: "country_super_admin", label: "Country Admin" },
  { value: "state_super_admin", label: "State Branch Admin" },
  { value: "satellite_church_admin", label: "Satellite Pastor Admin" },
];

const ADMIN_ROLES_COUNTRY = [
  { value: "state_super_admin", label: "State Branch Admin" },
  { value: "satellite_church_admin", label: "Satellite Pastor Admin" },
];

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
  state_super_admin: ["satellite_church_admin", "service_unit_leader", "sub_unit_leader"],
  satellite_church_admin: ["service_unit_leader", "sub_unit_leader"],
  service_unit_leader: ["sub_unit_leader"],
  sub_unit_leader: ["sub_unit_leader"],
};

export function getAnnouncementScopePolicy(admin, viewMode) {
  const role = admin?.role || "";
  const isGlobal = isGlobalAdminRole(role) || role === "data_entry_admin";
  const isCountryAdmin = isCountrySuperAdmin(role);
  const isStateAdmin = isStateSuperAdmin(role);
  const actingAsState = isCountryAdmin && isActingAsStateAdmin(admin, viewMode);

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
  if (isCountryAdmin) adminRoleOptions = ADMIN_ROLES_COUNTRY;
  else if (isStateAdmin || actingAsState) adminRoleOptions = ADMIN_ROLES_STATE;
  else if (role === "satellite_church_admin") adminRoleOptions = ADMIN_ROLES_SATELLITE;
  else if (role === "service_unit_leader") adminRoleOptions = ADMIN_ROLES_SATELLITE.filter((r) => r.value !== "satellite_church_admin");
  else if (role === "sub_unit_leader") adminRoleOptions = [{ value: "sub_unit_leader", label: "Sub-unit Leader" }];

  const defaultAdminRoles = isGlobal
    ? ["general_admin", "country_super_admin", "state_super_admin", "satellite_church_admin"]
    : DEFAULT_ADMIN_ROLES_BY_SENDER[role] || ["sub_unit_leader"];

  const visibility =
    isGlobal
      ? { country: true, state: true, satellite: true, unit: true, subunit: true }
      : SCOPE_VISIBILITY_BY_ROLE[role] || { country: false, state: true, satellite: true, unit: true, subunit: true };

  return {
    isGlobal,
    isCountryAdmin,
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
    scopeHint: buildScopeHint({ isGlobal, isCountryAdmin, actingAsState, isStateAdmin, role, lockedCountry, lockedState, lockedSatellite }),
  };
}

function buildScopeHint(ctx) {
  if (ctx.isGlobal) {
    return "You can target any country, state, or satellite from the church directory.";
  }
  if (ctx.role === "satellite_church_admin" && ctx.lockedSatellite) {
    return `Scoped to your satellite: ${ctx.lockedSatellite} (${branchStateLabel(ctx.lockedCountry, ctx.lockedState) || ctx.lockedState}).`;
  }
  if (ctx.isStateAdmin && ctx.lockedState) {
    return `Scoped to ${branchStateLabel(ctx.lockedCountry, ctx.lockedState) || ctx.lockedState}, ${branchCountryLabel(ctx.lockedCountry) || ctx.lockedCountry}. Satellites come from the church directory for this state.`;
  }
  if (ctx.isCountryAdmin && ctx.actingAsState) {
    return `Scoped to your headquarters state only (${branchStateLabel(ctx.lockedCountry, ctx.lockedState) || ctx.lockedState}).`;
  }
  if (ctx.isCountryAdmin && ctx.lockedCountry) {
    return `Scoped to ${branchCountryLabel(ctx.lockedCountry) || ctx.lockedCountry}. Optionally narrow by state or satellite using church data.`;
  }
  if (ctx.role === "service_unit_leader") {
    return "Scoped to your service unit and branch location.";
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

/** State dropdown from church directory + branch regions for locked country. */
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
  const fromRegions = branchStatesForCountry(cc).map((s) => ({ value: s.code, label: s.name }));
  const fromChurches = new Map();
  for (const ch of churches || []) {
    if (String(ch.branch_country || "").toUpperCase() !== cc) continue;
    const st = String(ch.branch_state || "").trim().toUpperCase();
    if (!st) continue;
    if (!fromChurches.has(st)) {
      fromChurches.set(st, branchStateLabel(cc, st) || st);
    }
  }
  const merged = new Map(fromRegions.map((s) => [s.value, s.label]));
  for (const [code, label] of fromChurches) {
    if (!merged.has(code)) merged.set(code, label);
  }
  return [{ value: "", label: "All states" }, ...[...merged.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([value, label]) => ({ value, label }))];
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
