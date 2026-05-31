/** Shared helpers for Country Admin → State Branch Admin accounts. */

import { branchStatesForCountry } from "./branchRegions.js";

const PENDING = new Set(["open", "in_review"]);

function adminFromRequestPayload(req) {
  const payload = req?.payload && typeof req.payload === "object" ? req.payload : {};
  return payload.admin && typeof payload.admin === "object" ? payload.admin : {};
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

export function availableStatesForCountryAdmin(countryCode, admins, pendingRequests, excludeAdminId) {
  const taken = occupiedStateCodes(admins, pendingRequests, countryCode, excludeAdminId);
  return branchStatesForCountry(countryCode).filter((s) => !taken.has(String(s.code).toUpperCase()));
}

/** States available for Country Admin to set as headquarters (dual role). */
export function availableHomeStatesForCountryAdmin(countryCode, admins, pendingRequests, countryAdminId) {
  const cc = String(countryCode || "").toUpperCase();
  const taken = occupiedStateCodes(admins, pendingRequests, countryCode, countryAdminId);
  return branchStatesForCountry(countryCode).filter((s) => {
    const code = String(s.code).toUpperCase();
    if (!taken.has(code)) return true;
    const me = (admins || []).find((a) => Number(a.id) === Number(countryAdminId));
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

export function validateStateBranchAdminForm(form, { countryCode, takenStates, isEdit } = {}) {
  if (!String(form.full_name || "").trim()) return "Full name is required.";
  if (!isEdit && !String(form.username || "").trim()) return "Username is required.";
  if (!String(form.email || "").trim()) return "Email is required.";
  if (!isEdit && (!form.password || String(form.password).length < 8)) {
    return "Password is required (minimum 8 characters).";
  }
  const cc = String(countryCode || form.branch_country || "").trim();
  if (!cc) return "Country is not configured on your account.";
  const st = String(form.branch_state || "").trim();
  if (!st) return "Select a state / region.";
  if (!isEdit && takenStates?.has(String(st).toUpperCase())) {
    return "This state already has a State Branch Admin.";
  }
  return "";
}
