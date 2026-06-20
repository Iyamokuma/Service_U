/**
 * Country / state options from the branch catalog (directory_countries + directory_states),
 * merged with static branchRegions for backward compatibility.
 */

import {
  BRANCH_COUNTRIES,
  branchCountryLabel,
  branchStateLabel,
  branchStatesForCountry,
  mergeStateOptions,
} from "./branchRegions.js";
import { satelliteSitesForBranch, satelliteSitesForCountry } from "./satelliteSites.js";

function normUp(s) {
  return String(s ?? "").trim().toUpperCase();
}

/** Countries whose admin flow picks a church directly (no regional state dropdown). */
const REGIONAL_STATE_COUNTRIES = new Set(["US"]);

export function isRegionalBranchCountry(countryCode) {
  return REGIONAL_STATE_COUNTRIES.has(normUp(countryCode));
}

function statesFromChurchesForDropdown(countryCode, churches) {
  const cc = normUp(countryCode);
  if (REGIONAL_STATE_COUNTRIES.has(cc)) return [];
  return statesFromChurches(churches, cc);
}

/** All countries: catalog first, then any static entries not yet in the directory. */
export function countriesFromCatalog(catalog) {
  const rows = [];
  const seen = new Set();
  for (const c of catalog?.countries || []) {
    const code = normUp(c.branch_country_code);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    rows.push({
      code,
      name: String(c.name || "").trim() || branchCountryLabel(code),
      id: c.id,
    });
  }
  for (const c of BRANCH_COUNTRIES) {
    if (!seen.has(c.code)) {
      rows.push({ code: c.code, name: c.name });
      seen.add(c.code);
    }
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

/** States for a country from catalog; falls back to static branchRegions when directory has none. */
export function statesFromCatalog(catalog, countryCode) {
  return statesFromCatalogAndChurches(catalog, countryCode, []);
}

function statesFromChurches(churches, countryCode) {
  const cc = normUp(countryCode);
  if (!cc) return [];
  const rows = [];
  const seen = new Set();
  for (const ch of churches || []) {
    if (normUp(ch.branch_country) !== cc) continue;
    const code = normUp(ch.branch_state);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    rows.push({
      code,
      name: branchStateLabel(cc, code) || code,
    });
  }
  return rows;
}

/**
 * States from directory + live church rows (e.g. US churches under TX while directory shows North America).
 */
export function statesFromCatalogAndChurches(catalog, countryCode, churches = []) {
  const cc = normUp(countryCode);
  if (!cc) return [];

  const catalogRows = [];
  const country = (catalog?.countries || []).find((c) => normUp(c.branch_country_code) === cc);
  if (country) {
    for (const s of catalog?.states || []) {
      if (Number(s.country_id) !== Number(country.id)) continue;
      const code = normUp(s.branch_state_code);
      if (!code) continue;
      catalogRows.push({
        code,
        name: String(s.name || "").trim() || branchStateLabel(cc, code),
      });
    }
  }

  const merged = mergeStateOptions(
    cc,
    catalogRows,
    statesFromChurchesForDropdown(cc, churches),
    branchStatesForCountry(cc),
  );
  if (merged.length) return merged;
  return branchStatesForCountry(cc);
}

/** States from directory_states rows only (database records for one country). */
export function directoryStateOptionsFromRows(countryCode, rows) {
  const cc = normUp(countryCode);
  if (!cc) return [];
  const seen = new Set();
  const out = [];
  for (const s of rows || []) {
    const code = normUp(s.branch_state_code ?? s.code);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    out.push({
      code,
      name: String(s.name || "").trim() || branchStateLabel(cc, code) || code,
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Filter cached catalog to directory_states for one country (no static/church merge). */
export function statesFromDirectoryOnly(catalog, countryCode) {
  const cc = normUp(countryCode);
  if (!cc || !catalog) return [];
  const country = (catalog?.countries || []).find((c) => normUp(c.branch_country_code) === cc);
  if (!country) return [];
  const rows = (catalog?.states || []).filter((s) => Number(s.country_id) === Number(country.id));
  return directoryStateOptionsFromRows(cc, rows);
}

export function defaultHeadquartersStateFromCatalog(catalog, countryCode) {
  return statesFromCatalog(catalog, countryCode)[0]?.code || "";
}

export function coerceStateForCatalog(catalog, countryCode, stateCode, churches = []) {
  const sc = normUp(stateCode);
  if (!sc) return "";
  const valid = statesFromCatalogAndChurches(catalog, countryCode, churches).some((s) => s.code === sc);
  if (valid) return sc;
  return coerceStateForCountry(countryCode, stateCode) ? sc : "";
}

/** Satellite church names from the admin church catalog for a country and optional state. */
export function satellitesFromChurches(churches, countryCode, stateCode = "") {
  const cc = normUp(countryCode);
  if (!cc) return [];
  const st = normUp(stateCode);
  if (st) {
    const inState = satelliteSitesForBranch(churches, cc, st);
    if (inState.length) return inState;
    // Regional directory bucket (e.g. US / "North America" while churches use TX, CA, …)
    if (st === cc) return satelliteSitesForCountry(churches, cc, "");
    return [];
  }
  return satelliteSitesForCountry(churches, cc, "");
}

const HQ_CHURCH_SEP = "::";

/** Searchable church branch options (value encodes state + church name). */
export function churchBranchSelectOptions(churches, countryCode, { allowedStateCodes, countryWide = false } = {}) {
  const cc = normUp(countryCode);
  if (!cc) return [];
  const listAllInCountry = countryWide || isRegionalBranchCountry(cc);
  const allowed = listAllInCountry
    ? null
    : allowedStateCodes?.length
      ? new Set(allowedStateCodes.map((c) => normUp(c)))
      : null;
  const rows = [];
  for (const ch of churches || []) {
    if (normUp(ch.branch_country) !== cc) continue;
    const st = normUp(ch.branch_state);
    const name = String(ch.name || "").trim();
    if (!st || !name) continue;
    if (allowed && !allowed.has(st)) {
      if (!allowed.has(cc)) continue;
    }
    const stateLabel = branchStateLabel(cc, st);
    rows.push({
      value: `${st}${HQ_CHURCH_SEP}${name}`,
      label: listAllInCountry ? name : `${stateLabel} · ${name}`,
    });
  }
  return rows.sort((a, b) => a.label.localeCompare(b.label));
}

/** Country Admin HQ picker: one option per church (state label · church name). */
export function headquartersChurchOptions(churches, countryCode, { allowedStateCodes } = {}) {
  return churchBranchSelectOptions(churches, countryCode, { allowedStateCodes });
}

export function hqChurchValueFromForm(branchState, satelliteSite) {
  const st = normUp(branchState);
  const name = String(satelliteSite || "").trim();
  if (!st || !name) return "";
  return `${st}${HQ_CHURCH_SEP}${name}`;
}

export function parseHqChurchValue(value) {
  const raw = String(value || "");
  const idx = raw.indexOf(HQ_CHURCH_SEP);
  if (idx < 0) {
    return { branch_state: normUp(raw), satellite_site: "" };
  }
  return {
    branch_state: normUp(raw.slice(0, idx)),
    satellite_site: raw.slice(idx + HQ_CHURCH_SEP.length).trim(),
  };
}
