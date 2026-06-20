/** Mirrors src/admin/branchRegions.js — directory is the source of truth for locations. */

const BRANCH_COUNTRIES: { code: string; name: string; states: { code: string; name: string }[] }[] = [];

function normCode(v: unknown): string {
  return String(v ?? "").trim().toUpperCase();
}

export function branchStatesForCountry(countryCode: string) {
  void countryCode;
  return [] as { code: string; name: string }[];
}

export function defaultHeadquartersStateForCountry(countryCode: string): string {
  void countryCode;
  return "";
}

export function isStateValidForCountry(countryCode: string, stateCode: string): boolean {
  const sc = normCode(stateCode);
  const cc = normCode(countryCode);
  if (!cc || !sc) return false;
  if (cc === "US" && sc !== "US" && /^[A-Z0-9]{2,12}$/.test(sc)) return true;
  return false;
}

export function assertStateBelongsToCountry(countryCode: unknown, stateCode: unknown): void {
  const cc = normCode(countryCode);
  const sc = normCode(stateCode);
  if (!cc) throw new Error("Country is required.");
  if (!sc) throw new Error("State / region is required.");
  if (!isStateValidForCountry(cc, sc)) {
    throw new Error("State does not match the selected country. Choose a state from the dropdown.");
  }
}

export function resolveStateCodeByName(countryCode: string, stateName: string): string {
  void countryCode;
  const raw = String(stateName ?? "").trim();
  if (!raw) return "";
  return normCode(raw).replace(/[^A-Z0-9]/g, "").slice(0, 12);
}

export function branchStateCodeForLocationPublish(countryCode: string, stateName: string): string {
  void countryCode;
  const slug = normCode(stateName).replace(/[^A-Z0-9]/g, "").slice(0, 12);
  return slug.length >= 1 ? slug : "REG";
}

export function branchCountryCodeFromIso2(iso2: unknown): string {
  const c = normCode(iso2);
  if (!c) return "";
  if (/^[A-Z]{2}$/.test(c)) return c;
  if (BRANCH_COUNTRIES.some((x) => x.code === c)) return c;
  return "";
}
