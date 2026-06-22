/**
 * Country / state options from the branch catalog (directory_countries + directory_states + churches).
 */

import { branchCountryLabel, branchStateLabel, mergeStateOptions } from "./branchRegions.js";
import { churchesInBranch, satelliteSitesForBranch, satelliteSitesForCountry } from "./satelliteSites.js";

function normUp(s) {
  return String(s ?? "").trim().toUpperCase();
}

/** True when a display name is just the branch_state code (abbreviation), not a full region name. */
export function isAbbreviatedStateName(name, code) {
  const n = normUp(name);
  const c = normUp(code);
  if (!c) return true;
  if (!n) return true;
  if (n === c) return true;
  return false;
}

/** Resolve a human-readable state name; never prefer bare codes over directory labels. */
export function resolveStateDisplayName(countryCode, code, nameFromRow, stateRows = []) {
  const cc = normUp(countryCode);
  const sc = normUp(code);
  if (!sc) return "";

  const candidates = [
    String(nameFromRow || "").trim(),
    String((stateRows || []).find((s) => normUp(s.code) === sc)?.name || "").trim(),
    String(branchStateLabel(cc, sc) || "").trim(),
  ];

  for (const name of candidates) {
    if (name && !isAbbreviatedStateName(name, sc)) return name;
  }
  return candidates.find(Boolean) || "";
}

/** Dropdown options using full state/region names (not branch_state codes). */
export function stateSelectOptionsForDropdown(stateRows, countryCode = "") {
  const cc = normUp(countryCode);
  return (stateRows || [])
    .map((s) => {
      const code = normUp(s.code);
      const name = resolveStateDisplayName(cc, code, s.name, stateRows);
      if (!name || isAbbreviatedStateName(name, code)) return null;
      return { value: name, label: name };
    })
    .filter(Boolean);
}

/** Resolve a picked state name (or legacy code) to branch_state code. */
export function resolveStateCodeFromSelection(selection, stateRows) {
  const raw = String(selection ?? "").trim();
  if (!raw) return "";
  const up = normUp(raw);
  for (const s of stateRows || []) {
    const code = normUp(s.code);
    const name = normUp(s.name);
    if (code === up || name === up) return code;
  }
  return up;
}

/** Map stored branch_state code to the directory name shown in dropdowns. */
export function stateSelectionValueForCode(stateCode, stateRows, countryCode = "") {
  const code = normUp(stateCode);
  if (!code) return "";
  const row = (stateRows || []).find((s) => normUp(s.code) === code);
  const name = resolveStateDisplayName(countryCode, code, row?.name, stateRows);
  return name || "";
}

/** Include a fallback row when editing/filtering with a code missing from directory rows. */
export function ensureStateRowForCode(stateRows, countryCode, stateCode) {
  const rows = [...(stateRows || [])];
  const code = normUp(stateCode);
  if (!code) return rows;
  if (rows.some((s) => normUp(s.code) === code)) return rows;
  const name = branchStateLabel(countryCode, code);
  if (!name || normUp(name) === code) return rows;
  return [...rows, { code, name }];
}

function statesFromChurchesForDropdown(countryCode, churches, catalog) {
  return statesFromChurches(churches, countryCode, catalog);
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
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

/** States for a country from catalog; falls back to static branchRegions when directory has none. */
export function statesFromCatalog(catalog, countryCode) {
  return statesFromCatalogAndChurches(catalog, countryCode, []);
}

function stateNameFromCatalog(catalog, countryCode, stateCode) {
  const cc = normUp(countryCode);
  const sc = normUp(stateCode);
  const country = (catalog?.countries || []).find((c) => normUp(c.branch_country_code) === cc);
  if (!country) return "";
  const row = (catalog?.states || []).find(
    (s) => Number(s.country_id) === Number(country.id) && normUp(s.branch_state_code) === sc,
  );
  return String(row?.name || "").trim();
}

function statesFromChurches(churches, countryCode, catalog = null) {
  const cc = normUp(countryCode);
  if (!cc) return [];
  const rows = [];
  const seen = new Set();
  for (const ch of churches || []) {
    if (normUp(ch.branch_country) !== cc) continue;
    const code = normUp(ch.branch_state);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    const name = resolveStateDisplayName(
      cc,
      code,
      stateNameFromCatalog(catalog, cc, code) || branchStateLabel(cc, code),
      rows,
    );
    if (!name || isAbbreviatedStateName(name, code)) continue;
    rows.push({ code, name });
  }
  return rows;
}

/**
 * States from directory + live church rows (full names in UI; codes stored in DB).
 */
export function statesFromCatalogAndChurches(catalog, countryCode, churches = [], directoryStates = null) {
  return statesForCountryPicker(countryCode, {
    catalog,
    churches,
    directoryStates: directoryStates ?? [],
  });
}

/** States for admin pickers: directory API/catalog first, churches only as fallback. */
export function statesForCountryPicker(countryCode, { catalog, churches, directoryStates } = {}) {
  const cc = normUp(countryCode);
  if (!cc) return [];

  let fromDirectory = directoryStateOptionsFromRows(cc, directoryStates || []);
  // Legacy Ghana catch-all row (code GH) — prefer regional states from catalog/churches.
  if (cc === "GH" && fromDirectory.length === 1 && normUp(fromDirectory[0]?.code) === "GH") {
    fromDirectory = [];
  }
  if (fromDirectory.length > 0) {
    return fromDirectory;
  }

  const fromCatalog = statesFromDirectoryOnly(catalog, cc);
  if (fromCatalog.length > 0) {
    return fromCatalog;
  }

  if (cc === "GH") {
    const churchCodes = new Set();
    for (const ch of churches || []) {
      if (normUp(ch.branch_country) === "GH") {
        const st = normUp(ch.branch_state);
        if (st) churchCodes.add(st);
      }
    }
    if (churchCodes.size > 0) {
      const canonical = [
        { code: "AS", name: "Ashanti Region" },
        { code: "CR", name: "Central Region" },
        { code: "GA", name: "Greater Accra" },
        { code: "WR", name: "Western Region" },
      ];
      const rows = canonical.filter((r) => churchCodes.has(r.code));
      if (rows.length) return rows;
    }
  }

  return mergeStateOptions(cc, statesFromChurches(churches, cc, catalog));
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
    const name = resolveStateDisplayName(
      cc,
      code,
      String(s.name || "").trim() || branchStateLabel(cc, code),
      out,
    );
    if (!name || isAbbreviatedStateName(name, code)) continue;
    out.push({ code, name });
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
  return valid ? sc : "";
}

/** Satellite church names from the admin church catalog for a country and optional state. */
export function satellitesFromChurches(churches, countryCode, stateCode = "") {
  const cc = normUp(countryCode);
  if (!cc) return [];
  const st = normUp(stateCode);
  if (!st) return [];
  return satelliteSitesForBranch(churches, cc, st);
}

const HQ_CHURCH_SEP = "::";

/** Searchable church branch options (value encodes state + church name). */
export function churchBranchSelectOptions(churches, countryCode, { allowedStateCodes, countryWide = false } = {}) {
  const cc = normUp(countryCode);
  if (!cc) return [];
  const scopedChurches =
    allowedStateCodes?.length && !countryWide
      ? allowedStateCodes.flatMap((code) => churchesInBranch(churches, cc, code))
      : countryWide
        ? (churches || []).filter((ch) => normUp(ch.branch_country) === cc)
        : [];
  const seen = new Set();
  const listAllInCountry = countryWide && !allowedStateCodes?.length;
  const rows = [];
  for (const ch of scopedChurches) {
    const st = normUp(ch.branch_state);
    const name = String(ch.name || "").trim();
    if (!st || !name) continue;
    const key = `${st}:${name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
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
