/** Hardcoded church branch geography (codes are stable for localStorage matching). */

/** Nigeria: 36 states + Federal Capital Territory (alphabetical by name). Codes uppercase; avoid NG/NIG (country conflict). */
const NIGERIA_STATES = [
  { code: "ABI", name: "Abia" },
  { code: "ADM", name: "Adamawa" },
  { code: "AKB", name: "Akwa Ibom" },
  { code: "ANA", name: "Anambra" },
  { code: "BAU", name: "Bauchi" },
  { code: "BAY", name: "Bayelsa" },
  { code: "BEN", name: "Benue" },
  { code: "BOR", name: "Borno" },
  { code: "CRV", name: "Cross River" },
  { code: "DE", name: "Delta" },
  { code: "EBY", name: "Ebonyi" },
  { code: "EDO", name: "Edo" },
  { code: "EKI", name: "Ekiti" },
  { code: "ENU", name: "Enugu" },
  { code: "FCT", name: "Federal Capital Territory" },
  { code: "GOM", name: "Gombe" },
  { code: "IMO", name: "Imo" },
  { code: "JIG", name: "Jigawa" },
  { code: "KAD", name: "Kaduna" },
  { code: "KAN", name: "Kano" },
  { code: "KAT", name: "Katsina" },
  { code: "KEB", name: "Kebbi" },
  { code: "KOG", name: "Kogi" },
  { code: "KWA", name: "Kwara" },
  { code: "LA", name: "Lagos" },
  { code: "NAS", name: "Nasarawa" },
  { code: "NIE", name: "Niger" },
  { code: "OGU", name: "Ogun" },
  { code: "OND", name: "Ondo" },
  { code: "OSU", name: "Osun" },
  { code: "OYO", name: "Oyo" },
  { code: "PLA", name: "Plateau" },
  { code: "RI", name: "Rivers" },
  { code: "SOK", name: "Sokoto" },
  { code: "TAR", name: "Taraba" },
  { code: "YOB", name: "Yobe" },
  { code: "ZAM", name: "Zamfara" },
];

export const BRANCH_COUNTRIES = [
  {
    code: "NG",
    name: "Nigeria",
    states: NIGERIA_STATES,
  },
  {
    code: "GH",
    name: "Ghana",
    states: [
      { code: "GA", name: "Greater Accra" },
      { code: "AS", name: "Ashanti" },
    ],
  },
  {
    code: "US",
    name: "United States",
    states: [
      { code: "TX", name: "Texas" },
      { code: "CA", name: "California" },
    ],
  },
  // Salvation Ministries directory (single “national” state = country code until subdivided)
  { code: "ASIA", name: "Asia Region", states: [{ code: "ASIA", name: "Asia Region" }] },
  { code: "BJ", name: "Benin Republic", states: [{ code: "BJ", name: "National" }] },
  { code: "CM", name: "Cameroon", states: [{ code: "CM", name: "National" }] },
  { code: "GM", name: "Gambia", states: [{ code: "GM", name: "National" }] },
  { code: "CH", name: "Switzerland", states: [{ code: "CH", name: "National" }] },
  { code: "AE", name: "United Arab Emirates", states: [{ code: "AE", name: "National" }] },
  { code: "GB", name: "United Kingdom", states: [{ code: "GB", name: "National" }] },
];

function normCode(v) {
  return String(v ?? "").trim().toUpperCase();
}

export function branchStatesForCountry(countryCode) {
  const c = BRANCH_COUNTRIES.find((x) => x.code === normCode(countryCode));
  const states = c?.states || [];
  return [...states].sort((a, b) => a.name.localeCompare(b.name));
}

/** Default headquarters state for a Country Admin (first state in dataset). */
export function defaultHeadquartersStateForCountry(countryCode) {
  const states = branchStatesForCountry(countryCode);
  return states[0]?.code || "";
}

/** True if stateCode exists for country (codes compared uppercase). */
export function isStateValidForCountry(countryCode, stateCode) {
  const sc = normCode(stateCode);
  if (!normCode(countryCode) || !sc) return false;
  return branchStatesForCountry(countryCode).some((s) => s.code === sc);
}

/** Throws a clear Error if state is missing or not in the country list (fixes invalid state admin saves). */
export function assertStateBelongsToCountry(countryCode, stateCode) {
  const cc = normCode(countryCode);
  const sc = normCode(stateCode);
  if (!cc) throw new Error("Country is required.");
  if (!sc) throw new Error("State / region is required.");
  if (!isStateValidForCountry(cc, sc)) {
    throw new Error("State does not match the selected country. Choose a state from the dropdown.");
  }
}

/** Keep state only if it belongs to country; otherwise "". */
export function coerceStateForCountry(countryCode, stateCode) {
  const sc = normCode(stateCode);
  if (!sc) return "";
  return isStateValidForCountry(countryCode, sc) ? sc : "";
}

export function branchCountryLabel(code) {
  if (!code) return "—";
  return BRANCH_COUNTRIES.find((c) => c.code === normCode(code))?.name || code;
}

export function branchStateLabel(countryCode, stateCode) {
  if (!countryCode || !stateCode) return "—";
  const cc = normCode(countryCode);
  const sc = normCode(stateCode);
  const st = (BRANCH_COUNTRIES.find((x) => x.code === cc)?.states || []).find((s) => s.code === sc);
  return st?.name || stateCode;
}

/** Resolve catalog state code from a display name (e.g. API "Lagos" → "LA"). */
export function resolveStateCodeByName(countryCode, stateName) {
  const raw = String(stateName ?? "").trim();
  if (!raw || !normCode(countryCode)) return "";
  const states = branchStatesForCountry(countryCode);
  const lower = raw.toLowerCase();
  const stripped = lower.replace(/\s+state\s*$/i, "").replace(/\s+province\s*$/i, "").trim();

  let hit = states.find((s) => s.name.trim().toLowerCase() === lower);
  if (!hit) hit = states.find((s) => s.name.trim().toLowerCase() === stripped);
  if (!hit) {
    hit = states.find((s) => {
      const sn = s.name.trim().toLowerCase().replace(/\s+state\s*$/i, "").replace(/\s+province\s*$/i, "").trim();
      return sn === stripped || sn === lower;
    });
  }
  if (!hit && stripped.length >= 4) {
    hit = states.find((s) => {
      const sn = s.name.trim().toLowerCase().replace(/\s+state\s*$/i, "").trim();
      return sn.startsWith(stripped) || stripped.startsWith(sn);
    });
  }
  return hit?.code || "";
}

/** Match server: catalog code when label matches, else A–Z/0–9 slug (max 12) for publishing. */
/** One canonical state code + label (merges Abia / Abia State / ABIASTATE → ABI). */
export function canonicalStateOption(countryCode, codeOrName, displayName) {
  const cc = normCode(countryCode);
  const rawCode = normCode(codeOrName);
  const rawName = String(displayName ?? codeOrName ?? "").trim();
  const canonical =
    resolveStateCodeByName(cc, rawName) ||
    resolveStateCodeByName(cc, rawCode) ||
    rawCode;
  if (!cc || !canonical) return null;
  const catalogName = branchStatesForCountry(cc).find((s) => normCode(s.code) === canonical)?.name;
  return {
    code: canonical,
    name: catalogName || String(displayName || "").trim() || branchStateLabel(cc, canonical) || canonical,
  };
}

/** Dedupe state dropdown rows by canonical code (directory + churches + catalog). */
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
  const fromCatalog = resolveStateCodeByName(countryCode, stateName);
  if (fromCatalog) return fromCatalog;
  const slug = normCode(stateName).replace(/[^A-Z0-9]/g, "").slice(0, 12);
  return slug.length >= 1 ? slug : "REG";
}

/** Map common ISO 3166-1 alpha-2 codes to internal branch country codes (catalog). */
export function branchCountryCodeFromIso2(iso2) {
  const c = normCode(iso2);
  if (!c) return "";
  if (/^[A-Z]{2}$/.test(c)) return c;
  if (BRANCH_COUNTRIES.some((x) => x.code === c)) return c;
  return "";
}
