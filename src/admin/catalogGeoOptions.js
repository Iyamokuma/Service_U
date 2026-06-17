/**
 * Country / state options from the branch catalog (directory_countries + directory_states),
 * merged with static branchRegions for backward compatibility.
 */

import {
  BRANCH_COUNTRIES,
  branchCountryLabel,
  branchStateLabel,
  branchStatesForCountry,
} from "./branchRegions.js";
import { satelliteSitesForBranch, satelliteSitesForCountry } from "./satelliteSites.js";

function normUp(s) {
  return String(s ?? "").trim().toUpperCase();
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
  const cc = normUp(countryCode);
  if (!cc) return [];
  const country = (catalog?.countries || []).find((c) => normUp(c.branch_country_code) === cc);
  if (country) {
    const rows = (catalog?.states || [])
      .filter((s) => Number(s.country_id) === Number(country.id))
      .map((s) => ({
        code: normUp(s.branch_state_code),
        name: String(s.name || "").trim() || branchStateLabel(cc, s.branch_state_code),
      }))
      .filter((s) => s.code);
    if (rows.length) {
      return rows.sort((a, b) => a.name.localeCompare(b.name));
    }
  }
  return branchStatesForCountry(cc);
}

export function defaultHeadquartersStateFromCatalog(catalog, countryCode) {
  return statesFromCatalog(catalog, countryCode)[0]?.code || "";
}

export function coerceStateForCatalog(catalog, countryCode, stateCode) {
  const sc = normUp(stateCode);
  if (!sc) return "";
  const valid = statesFromCatalog(catalog, countryCode).some((s) => s.code === sc);
  return valid ? sc : "";
}

/** Satellite church names from the admin church catalog for a country and optional state. */
export function satellitesFromChurches(churches, countryCode, stateCode = "") {
  const cc = normUp(countryCode);
  if (!cc) return [];
  const st = normUp(stateCode);
  if (st) return satelliteSitesForBranch(churches, cc, st);
  return satelliteSitesForCountry(churches, cc, "");
}

const HQ_CHURCH_SEP = "::";

/** Country Admin HQ picker: one option per church (state label · church name). */
export function headquartersChurchOptions(churches, countryCode, { allowedStateCodes } = {}) {
  const cc = normUp(countryCode);
  if (!cc) return [];
  const allowed = allowedStateCodes?.length
    ? new Set(allowedStateCodes.map((c) => normUp(c)))
    : null;
  const rows = [];
  for (const ch of churches || []) {
    if (normUp(ch.branch_country) !== cc) continue;
    const st = normUp(ch.branch_state);
    const name = String(ch.name || "").trim();
    if (!st || !name) continue;
    if (allowed && !allowed.has(st)) continue;
    const stateLabel = branchStateLabel(cc, st);
    rows.push({
      value: `${st}${HQ_CHURCH_SEP}${name}`,
      label: `${stateLabel} · ${name}`,
    });
  }
  return rows.sort((a, b) => a.label.localeCompare(b.label));
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
