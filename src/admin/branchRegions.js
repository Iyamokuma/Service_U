/** Location labels and helpers — countries/states live in the database (data entry), not here. */

export const BRANCH_COUNTRIES = [];

function normCode(v) {
  return String(v ?? "").trim().toUpperCase();
}

export function branchStatesForCountry(countryCode) {
  void countryCode;
  return [];
}

export function defaultHeadquartersStateForCountry(countryCode) {
  void countryCode;
  return "";
}

export function isStateValidForCountry(countryCode, stateCode) {
  const sc = normCode(stateCode);
  const cc = normCode(countryCode);
  if (!cc || !sc) return false;
  if (cc === "US" && sc !== "US" && /^[A-Z0-9]{2,12}$/.test(sc)) return true;
  return false;
}

export function assertStateBelongsToCountry(countryCode, stateCode) {
  const cc = normCode(countryCode);
  const sc = normCode(stateCode);
  if (!cc) throw new Error("Country is required.");
  if (!sc) throw new Error("State / region is required.");
  if (!isStateValidForCountry(cc, sc)) {
    throw new Error("State does not match the selected country. Choose a state from the dropdown.");
  }
}

export function coerceStateForCountry(countryCode, stateCode) {
  const sc = normCode(stateCode);
  if (!sc) return "";
  return isStateValidForCountry(countryCode, sc) ? sc : "";
}

export function branchCountryLabel(code) {
  if (!code) return "—";
  return code;
}

export function branchStateLabel(countryCode, stateCode) {
  void countryCode;
  if (!stateCode) return "—";
  return stateCode;
}

export function resolveStateCodeByName(countryCode, stateName) {
  void countryCode;
  const raw = String(stateName ?? "").trim();
  if (!raw) return "";
  return normCode(raw).replace(/[^A-Z0-9]/g, "").slice(0, 12);
}

export function canonicalStateOption(countryCode, codeOrName, displayName) {
  const cc = normCode(countryCode);
  const rawCode = normCode(codeOrName);
  const rawName = String(displayName ?? codeOrName ?? "").trim();
  const canonical = resolveStateCodeByName(cc, rawName) || rawCode;
  if (!cc || !canonical) return null;
  return {
    code: canonical,
    name: String(displayName || "").trim() || canonical,
  };
}

export function mergeStateOptions(countryCode, ...lists) {
  const byCode = new Map();
  for (const list of lists) {
    for (const item of list || []) {
      const opt = canonicalStateOption(countryCode, item.code ?? item.branch_state_code, item.name);
      if (!opt) continue;
      const prev = byCode.get(opt.code);
      if (!prev || (prev.name === prev.code && opt.name !== opt.code)) {
        byCode.set(opt.code, opt);
      }
    }
  }
  return [...byCode.values()].sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

export function branchStateCodeForLocationPublish(countryCode, stateName) {
  void countryCode;
  const slug = normCode(stateName).replace(/[^A-Z0-9]/g, "").slice(0, 12);
  return slug.length >= 1 ? slug : "REG";
}

export function branchCountryCodeFromIso2(iso2) {
  const c = normCode(iso2);
  if (!c) return "";
  if (/^[A-Z]{2}$/.test(c)) return c;
  return "";
}
