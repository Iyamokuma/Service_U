import { branchStateLabel } from "./branchRegions.js";

const HQ_CHURCH_SEP = "::";

export function branchStateMatches(countryCode, churchState, filterState) {
  const cc = String(countryCode || "").trim().toUpperCase();
  const st = String(churchState || "").trim().toUpperCase();
  const fs = String(filterState || "").trim().toUpperCase();
  if (!cc || !st || !fs) return false;
  if (st === fs) return true;
  const filterLabel = branchStateLabel(cc, fs);
  return filterLabel && st === String(filterLabel).trim().toUpperCase();
}

export function satelliteSitesForBranch(churches, branchCountry, branchState) {
  const cc = String(branchCountry || "").trim().toUpperCase();
  const st = String(branchState || "").trim().toUpperCase();
  if (!cc || !st) return [];
  const names = new Set();
  for (const ch of churches || []) {
    if (String(ch.branch_country || "").toUpperCase() !== cc) continue;
    if (!branchStateMatches(cc, ch.branch_state, st)) continue;
    const n = String(ch.name || "").trim();
    if (n) names.add(n);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

/** Satellite church names in a country, optionally limited to one state. */
export function satelliteSitesForCountry(churches, branchCountry, branchState = "") {
  const cc = String(branchCountry || "").trim().toUpperCase();
  const st = String(branchState || "").trim().toUpperCase();
  if (!cc) return [];
  const names = new Set();
  for (const ch of churches || []) {
    if (String(ch.branch_country || "").toUpperCase() !== cc) continue;
    if (st && !branchStateMatches(cc, ch.branch_state, st)) continue;
    const n = String(ch.name || "").trim();
    if (n) names.add(n);
  }
  return [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

/** Church catalog rows for one country + state (codes or directory names). */
export function churchesInBranch(churches, branchCountry, branchState) {
  const cc = String(branchCountry || "").trim().toUpperCase();
  const st = String(branchState || "").trim().toUpperCase();
  if (!cc || !st) return [];
  return (churches || []).filter((ch) => {
    if (String(ch.branch_country || "").toUpperCase() !== cc) return false;
    return branchStateMatches(cc, ch.branch_state, st);
  });
}

/** Searchable options for admin church pickers scoped to one state. */
export function churchSelectOptionsForBranch(churches, branchCountry, branchState) {
  const cc = String(branchCountry || "").trim().toUpperCase();
  return churchesInBranch(churches, cc, branchState)
    .map((ch) => {
      const st = String(ch.branch_state || "").trim().toUpperCase();
      const name = String(ch.name || "").trim();
      if (!st || !name) return null;
      return {
        value: `${st}${HQ_CHURCH_SEP}${name}`,
        label: `${branchStateLabel(cc, st)} · ${name}`,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.label.localeCompare(b.label));
}
