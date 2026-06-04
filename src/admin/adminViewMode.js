/** Country Admin ↔ State Branch Admin dashboard switch (HQ dual role). */

import { countryAdminHomeState, isCountrySuperAdmin } from "./roles.js";

export const VIEW_MODE_STORAGE_KEY = "sm_admin_view_mode";

/**
 * Only the Country Admin account (created by Super Admin — one per country) may switch.
 * State Branch Admins for other states never get this control.
 */
export function canSwitchAdminView(admin) {
  return isCountrySuperAdmin(admin?.role) && !!countryAdminHomeState(admin);
}

export function viewModeStorageKey(adminId) {
  return adminId ? `${VIEW_MODE_STORAGE_KEY}_${adminId}` : VIEW_MODE_STORAGE_KEY;
}

export function readAdminViewMode(adminId) {
  try {
    const key = viewModeStorageKey(adminId);
    return sessionStorage.getItem(key) === "state" ? "state" : "country";
  } catch {
    return "country";
  }
}

export function writeAdminViewMode(adminId, mode) {
  try {
    sessionStorage.setItem(viewModeStorageKey(adminId), mode === "state" ? "state" : "country");
  } catch {
    /* ignore */
  }
}

/** UI nav / page routing — state view mimics State Branch Admin. */
export function effectiveUiRole(admin, viewMode) {
  if (canSwitchAdminView(admin) && viewMode === "state") return "state_super_admin";
  return admin?.role || "";
}

/** Sent to API as scope_mode for server-side data scoping. */
export function apiScopeMode(admin, viewMode) {
  if (canSwitchAdminView(admin) && viewMode === "state") return "state";
  return undefined;
}

/** Merge scope_mode into admin API payloads when Country Admin switches country ↔ state view. */
export function adminApiScopeParams(admin) {
  if (!canSwitchAdminView(admin)) return {};
  return { scope_mode: readAdminViewMode(admin.id) === "state" ? "state" : "country" };
}

const COUNTRY_PAGES = [
  "overview",
  "oversight",
  "users",
  "requests",
  "locations",
  "activity",
  "announcements",
  "profile",
];

export const STATE_LEVEL_PAGES = [
  "overview",
  "oversight",
  "users",
  "requests",
  "activity",
  "announcements",
  "profile",
];

const STATE_PAGES = STATE_LEVEL_PAGES;

/** Normalize page id for State Branch Admin nav (including Country Admin in state view). */
export function normalizeStateAdminPage(page) {
  if (page === "admins" || page === "workforce" || page === "members") return "users";
  if (STATE_LEVEL_PAGES.includes(page)) return page;
  return "overview";
}

export const SERVICE_UNIT_LEADER_PAGES = [
  "overview",
  "queue",
  "users",
  "announcements",
  "activity",
  "profile",
];

export const SUB_UNIT_LEADER_PAGES = [
  "overview",
  "queue",
  "users",
  "announcements",
  "profile",
];

const SATELLITE_ADMIN_PAGES = [
  "role-dashboard",
  "oversight",
  "users",
  "requests",
  "announcements",
  "profile",
];

/** Normalize page id for Satellite Pastor Admin nav. */
export function normalizeSatelliteAdminPage(page) {
  if (page === "admins" || page === "workforce" || page === "members") return "users";
  if (SATELLITE_ADMIN_PAGES.includes(page)) return page;
  return "role-dashboard";
}

export function normalizeServiceUnitLeaderPage(page) {
  if (page === "admins" || page === "workforce" || page === "members") return "users";
  if (SERVICE_UNIT_LEADER_PAGES.includes(page)) return page;
  return "overview";
}

export function normalizeSubUnitLeaderPage(page) {
  if (page === "members" || page === "admins" || page === "workforce") return "users";
  if (SUB_UNIT_LEADER_PAGES.includes(page)) return page;
  return "overview";
}

/** Map sidebar page when switching Country ↔ State view (keep the closest equivalent). */
export function normalizePageForViewMode(page, admin, viewMode) {
  if (!canSwitchAdminView(admin)) return page;
  const allowed = viewMode === "state" ? STATE_PAGES : COUNTRY_PAGES;
  if (page === "admins" || page === "workforce") return "users";
  if (allowed.includes(page)) return page;
  if (viewMode === "state") {
    if (page === "locations" || page === "units") return "users";
    if (page === "queue") return "oversight";
  } else {
    if (page === "members" || page === "units") return "users";
    if (page === "queue") return "oversight";
  }
  return "overview";
}

export function isStateLevelUi(admin, viewMode) {
  return effectiveUiRole(admin, viewMode) === "state_super_admin";
}

export function isActingAsStateAdmin(admin, viewMode) {
  return canSwitchAdminView(admin) && viewMode === "state";
}
