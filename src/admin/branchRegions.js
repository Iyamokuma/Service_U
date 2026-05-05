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
];

function normCode(v) {
  return String(v ?? "").trim().toUpperCase();
}

export function branchStatesForCountry(countryCode) {
  const c = BRANCH_COUNTRIES.find((x) => x.code === normCode(countryCode));
  const states = c?.states || [];
  return [...states].sort((a, b) => a.name.localeCompare(b.name));
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
