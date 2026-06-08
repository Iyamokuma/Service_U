/** Shared helpers for State Branch Admin → Satellite Pastor Admin accounts. */

import { satelliteSitesForBranch } from "./satelliteSites.js";

const PENDING = new Set(["open", "in_review"]);

function adminFromRequestPayload(req) {
  const payload = req?.payload && typeof req.payload === "object" ? req.payload : {};
  return payload.admin && typeof payload.admin === "object" ? payload.admin : {};
}

function sameState(a, countryCode, stateCode) {
  return (
    String(a.branch_country || "").toUpperCase() === String(countryCode || "").toUpperCase() &&
    String(a.branch_state || "").toUpperCase() === String(stateCode || "").toUpperCase()
  );
}

/** Satellite sites in this state that already have an active or pending Satellite Pastor Admin. */
export function occupiedSatelliteSites(admins, pendingRequests, countryCode, stateCode, excludeAdminId) {
  const cc = String(countryCode || "").toUpperCase();
  const st = String(stateCode || "").toUpperCase();
  const set = new Set();
  for (const a of admins || []) {
    if (excludeAdminId != null && Number(a.id) === Number(excludeAdminId)) continue;
    if (Number(a.is_active) !== 1) continue;
    if (a.role !== "satellite_church_admin") continue;
    if (!sameState(a, cc, st) || !a.satellite_site) continue;
    set.add(String(a.satellite_site).trim());
  }
  for (const req of pendingRequests || []) {
    if (!PENDING.has(req.status)) continue;
    const admin = adminFromRequestPayload(req);
    if (admin.role !== "satellite_church_admin") continue;
    if (!sameState(admin, cc, st) || !admin.satellite_site) continue;
    set.add(String(admin.satellite_site).trim());
  }
  return set;
}

export function availableSatellitesForState(churches, countryCode, stateCode, admins, pendingRequests, excludeAdminId) {
  const taken = occupiedSatelliteSites(admins, pendingRequests, countryCode, stateCode, excludeAdminId);
  return satelliteSitesForBranch(churches, countryCode, stateCode)
    .filter((name) => !taken.has(String(name).trim()))
    .map((name) => ({ name, code: name }));
}

export function satellitePastorForSite(admins, countryCode, stateCode, siteName) {
  const cc = String(countryCode || "").toUpperCase();
  const st = String(stateCode || "").toUpperCase();
  const sat = String(siteName || "").trim();
  if (!cc || !st || !sat) return null;
  return (
    (admins || []).find(
      (a) =>
        a.role === "satellite_church_admin" &&
        Number(a.is_active) === 1 &&
        sameState(a, cc, st) &&
        String(a.satellite_site || "").trim() === sat,
    ) || null
  );
}

function slugPart(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 12);
}

export function suggestedSatellitePastorUsername(countryCode, stateCode, satelliteSite) {
  const cc = slugPart(countryCode);
  const st = slugPart(stateCode);
  const sat = slugPart(satelliteSite);
  return cc && st && sat ? `${cc}.${st}.${sat}.pastor` : "";
}

export function validateSatellitePastorAdminForm(
  form,
  { countryCode, stateCode, takenSites, isEdit, churches, inviteCreate } = {},
) {
  if (!String(form.full_name || "").trim()) return "Full name is required.";
  if (!isEdit && !inviteCreate && !String(form.username || "").trim()) return "Username is required.";
  if (!String(form.email || "").trim()) return "Email is required.";
  if (!isEdit && !inviteCreate && (!form.password || String(form.password).length < 8)) {
    return "Password is required (minimum 8 characters).";
  }
  const cc = String(countryCode || form.branch_country || "").trim();
  const st = String(stateCode || form.branch_state || "").trim();
  if (!cc || !st) return "State scope is not configured on your account.";
  const sat = String(form.satellite_site || "").trim();
  if (!sat) return "Select a satellite church.";
  const sites = satelliteSitesForBranch(churches, cc, st);
  if (sites.length && !sites.includes(sat)) {
    return "This satellite is not in your state dataset.";
  }
  if (!isEdit && takenSites?.has(sat)) {
    return "This satellite already has a Satellite Pastor Admin.";
  }
  return "";
}
