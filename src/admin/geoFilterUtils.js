import { announcementStateOptions, announcementSatelliteOptions } from "./announcementScopePolicy.js";
import { branchCountryCodeFromIso2, branchStateCodeForLocationPublish } from "./branchRegions.js";
import { parseRequestPayload } from "./requestPayload.js";

/** API query fields used by queue, members, and stats. */
export function geoFilterApiParams(filters) {
  const country = String(filters?.country || "").trim();
  const state = String(filters?.state || "").trim();
  const satellite = String(filters?.satellite || "").trim();
  return {
    ...(country ? { filter_country: country } : {}),
    ...(state ? { filter_state: state } : {}),
    ...(satellite ? { filter_branch: satellite } : {}),
  };
}

export function hasGeoFilters(filters) {
  return !!(filters?.country || filters?.state || filters?.satellite);
}

export function matchesAdminGeo(adminRow, filters) {
  if (!hasGeoFilters(filters)) return true;
  const cc = String(adminRow?.branch_country || "").trim().toUpperCase();
  const st = String(adminRow?.branch_state || "").trim().toUpperCase();
  const sat = String(adminRow?.satellite_site || "").trim();
  if (filters.country && cc !== String(filters.country).trim().toUpperCase()) return false;
  if (filters.state && st !== String(filters.state).trim().toUpperCase()) return false;
  if (filters.satellite && sat !== String(filters.satellite).trim()) return false;
  return true;
}

export function matchesRegistrationGeo(row, filters) {
  if (!hasGeoFilters(filters)) return true;
  const cc = String(row?.branch_country || "").trim().toUpperCase();
  const st = String(row?.branch_state || "").trim().toUpperCase();
  const sat = String(row?.satellite_site || "").trim();
  if (filters.country && cc !== String(filters.country).trim().toUpperCase()) return false;
  if (filters.state && st !== String(filters.state).trim().toUpperCase()) return false;
  if (filters.satellite && sat !== String(filters.satellite).trim()) return false;
  return true;
}

export function stateOptionsForGeoFilter(churches, countryCode) {
  return announcementStateOptions(churches, countryCode, "");
}

export function satelliteOptionsForGeoFilter(churches, countryCode, stateCode) {
  return announcementSatelliteOptions(churches, countryCode, stateCode, "")
    .filter((o) => o.value)
    .map((o) => o.value);
}

/** Client-side filter for admin requests (super admin Requests table). */
export function matchesRequestGeo(req, filters) {
  if (!hasGeoFilters(filters)) return true;
  const p = parseRequestPayload(req?.payload) || {};
  if (req?.request_type === "admin_account" && p.admin) {
    return matchesAdminGeo(p.admin, filters);
  }
  let country = String(p.branchCountry || p.admin?.branch_country || "").trim();
  let state = String(p.branchState || p.admin?.branch_state || "").trim();
  let satellite = String(p.satelliteSite || p.admin?.satellite_site || "").trim();
  if (req?.request_type === "location_catalog" && p.countryIso2) {
    const cc = branchCountryCodeFromIso2(p.countryIso2);
    country = cc || country;
    if (cc && p.stateName) {
      state = branchStateCodeForLocationPublish(cc, p.stateName) || state;
    }
  }
  if (req?.request_type === "location_catalog_delete") {
    country = String(p.branchCountry || country).trim();
    state = String(p.branchState || state).trim();
    return matchesRegistrationGeo(
      { branch_country: country, branch_state: state, satellite_site: "" },
      { country: filters.country, state: filters.state, satellite: "" },
    );
  }
  return matchesRegistrationGeo(
    { branch_country: country, branch_state: state, satellite_site: satellite },
    filters,
  );
}
