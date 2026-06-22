/** Shared helpers for Country Admin → State Branch Admin accounts. */

import { branchStateLabel, mergeStateOptions } from "./branchRegions.js";
import { directoryStateOptionsFromRows, statesFromCatalogAndChurches } from "./catalogGeoOptions.js";
import { satelliteSitesForBranch } from "./satelliteSites.js";

const PENDING = new Set(["open", "in_review"]);

function adminFromRequestPayload(req) {
  const payload = req?.payload && typeof req.payload === "object" ? req.payload : {};
  return payload.admin && typeof payload.admin === "object" ? payload.admin : {};
}

/** True when this admin account covers a state branch (dedicated or Country Admin HQ). */
export function isStateBranchLeader(admin) {
  if (!admin || Number(admin.is_active) !== 1) return false;
  if (admin.role === "state_super_admin") return true;
  return admin.role === "country_super_admin" && !!String(admin.branch_state || "").trim();
}

/** Count admins who lead a state branch in a country (includes Country Admin HQ). */
export function countStateBranchLeaders(admins, countryCode) {
  const cc = String(countryCode || "").toUpperCase();
  return (admins || []).filter(
    (a) =>
      isStateBranchLeader(a) &&
      String(a.branch_country || "").toUpperCase() === cc,
  ).length;
}

/** States that already have an active or pending State Branch Admin (or Country Admin HQ) in this country. */
export function occupiedStateCodes(admins, pendingRequests, countryCode, excludeAdminId) {
  const cc = String(countryCode || "").toUpperCase();
  const set = new Set();
  for (const a of admins || []) {
    if (excludeAdminId != null && Number(a.id) === Number(excludeAdminId)) continue;
    if (Number(a.is_active) !== 1) continue;
    if (String(a.branch_country || "").toUpperCase() !== cc || !a.branch_state) continue;
    if (a.role === "state_super_admin") {
      set.add(String(a.branch_state).toUpperCase());
    }
    if (a.role === "country_super_admin") {
      set.add(String(a.branch_state).toUpperCase());
    }
  }
  for (const req of pendingRequests || []) {
    if (!PENDING.has(req.status)) continue;
    const admin = adminFromRequestPayload(req);
    if (
      admin.role === "state_super_admin" &&
      String(admin.branch_country || "").toUpperCase() === cc &&
      admin.branch_state
    ) {
      set.add(String(admin.branch_state).toUpperCase());
    }
  }
  return set;
}

/** All states/regions in a country from directory, catalog cache, and church rows. */
export function allStatesInCountry(countryCode, { catalog, churches, directoryStates } = {}) {
  const cc = String(countryCode || "").toUpperCase();
  if (!cc) return [];
  return mergeStateOptions(
    cc,
    statesFromCatalogAndChurches(catalog, cc, churches || []),
    directoryStateOptionsFromRows(cc, directoryStates || []),
  );
}

export function availableStatesForCountryAdmin(
  countryCode,
  admins,
  pendingRequests,
  excludeAdminId,
  { catalog, churches, directoryStates } = {},
) {
  const cc = String(countryCode || "").toUpperCase();
  const taken = occupiedStateCodes(admins, pendingRequests, countryCode, excludeAdminId);
  const stateRows = allStatesInCountry(cc, { catalog, churches, directoryStates });
  return stateRows.filter((s) => !taken.has(String(s.code).toUpperCase()));
}

/** States available for Country Admin to set as headquarters (dual role). */
export function availableHomeStatesForCountryAdmin(
  countryCode,
  admins,
  pendingRequests,
  countryAdminId,
  { catalog, churches, directoryStates } = {},
) {
  const cc = String(countryCode || "").toUpperCase();
  const taken = occupiedStateCodes(admins, pendingRequests, countryCode, countryAdminId);
  const me = (admins || []).find((a) => Number(a.id) === Number(countryAdminId));
  const stateRows = allStatesInCountry(cc, { catalog, churches, directoryStates });
  return stateRows.filter((s) => {
    const code = String(s.code).toUpperCase();
    if (!taken.has(code)) return true;
    return me?.role === "country_super_admin" && String(me.branch_state || "").toUpperCase() === code;
  });
}

/** Who leads a state: dedicated State Branch Admin or Country Admin with HQ in that state. */
export function stateLeaderForCode(admins, countryCode, stateCode) {
  const cc = String(countryCode || "").toUpperCase();
  const st = String(stateCode || "").toUpperCase();
  if (!cc || !st) return null;

  const stateAdmin = (admins || []).find(
    (a) =>
      a.role === "state_super_admin" &&
      Number(a.is_active) === 1 &&
      String(a.branch_country || "").toUpperCase() === cc &&
      String(a.branch_state || "").toUpperCase() === st,
  );
  if (stateAdmin) {
    return { kind: "state_admin", admin: stateAdmin };
  }

  const countryAdmin = (admins || []).find(
    (a) =>
      a.role === "country_super_admin" &&
      Number(a.is_active) === 1 &&
      String(a.branch_country || "").toUpperCase() === cc &&
      String(a.branch_state || "").toUpperCase() === st,
  );
  if (countryAdmin) {
    return { kind: "country_hq", admin: countryAdmin };
  }

  return null;
}

/** List state branches covered in a country (directory + admin accounts, incl. Country HQ). */
export function listStateBranchesForCountry(countryCode, admins, directoryStates = []) {
  const cc = String(countryCode || "").toUpperCase();
  if (!cc) return [];
  const byState = new Map();

  for (const s of directoryStates || []) {
    const st = String(s.branch_state_code || s.code || "").toUpperCase();
    if (!st) continue;
    const country = s.country_id != null
      ? String(s.branch_country_code || "").toUpperCase()
      : cc;
    if (country && country !== cc) continue;
    byState.set(st, {
      stateCode: st,
      stateLabel: s.name || branchStateLabel(cc, st),
      admin: null,
      kind: null,
    });
  }

  for (const a of admins || []) {
    if (!isStateBranchLeader(a)) continue;
    if (String(a.branch_country || "").toUpperCase() !== cc) continue;
    const st = String(a.branch_state || "").toUpperCase();
    if (!st) continue;
    const kind = a.role === "country_super_admin" ? "country_hq" : "state_admin";
    const existing = byState.get(st);
    byState.set(st, {
      stateCode: st,
      stateLabel: existing?.stateLabel || branchStateLabel(cc, st),
      admin: a,
      kind,
    });
  }

  return [...byState.values()]
    .filter((row) => row.admin || row.stateLabel)
    .sort((a, b) => String(a.stateLabel).localeCompare(String(b.stateLabel)));
}

export function stateBranchKindLabel(kind) {
  if (kind === "country_hq") return "Country & State (HQ)";
  if (kind === "state_admin") return "State Branch Admin";
  return "Vacant";
}

export function stateLeaderLabel(leader) {
  if (!leader) return "Vacant";
  if (leader.kind === "country_hq") return "Country & State (HQ)";
  return "State Branch Admin";
}

export function suggestedStateAdminUsername(countryCode, stateCode) {
  const cc = String(countryCode || "").trim().toLowerCase();
  const st = String(stateCode || "").trim().toLowerCase();
  return cc && st ? `${cc}.${st}.admin` : "";
}

export function validateStateBranchAdminForm(
  form,
  { countryCode, takenStates, isEdit, inviteCreate, churches } = {},
) {
  if (!String(form.full_name || "").trim()) return "Full name is required.";
  if (!isEdit && !inviteCreate && !String(form.username || "").trim()) return "Username is required.";
  if (!String(form.email || "").trim()) return "Email is required.";
  if (!isEdit && !inviteCreate && (!form.password || String(form.password).length < 8)) {
    return "Password is required (minimum 8 characters).";
  }
  const cc = String(countryCode || form.branch_country || "").trim();
  if (!cc) return "Country is not configured on your account.";
  const st = String(form.branch_state || "").trim();
  if (!st) return "Select a state / region.";
  if (!isEdit && takenStates?.has(String(st).toUpperCase())) {
    return "This state already has a State Branch Admin or Country Admin headquarters.";
  }
  const sites = satelliteSitesForBranch(churches || [], cc, st);
  if (!isEdit && sites.length > 0 && !String(form.satellite_site || "").trim()) {
    return "Select a church branch for this State Branch Admin.";
  }
  const sat = String(form.satellite_site || "").trim();
  if (sat && sites.length > 0 && !sites.includes(sat)) {
    return "This church branch is not in the selected state.";
  }
  return "";
}
