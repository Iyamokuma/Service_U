/** Mirrors src/admin/branchRegions.js for server-side validation. */

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

const BRANCH_COUNTRIES = [
  { code: "NG", name: "Nigeria", states: NIGERIA_STATES },
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
  { code: "ASIA", name: "Asia Region", states: [{ code: "ASIA", name: "Asia Region" }] },
  { code: "BJ", name: "Benin Republic", states: [{ code: "BJ", name: "National" }] },
  { code: "CM", name: "Cameroon", states: [{ code: "CM", name: "National" }] },
  { code: "GM", name: "Gambia", states: [{ code: "GM", name: "National" }] },
  { code: "CH", name: "Switzerland", states: [{ code: "CH", name: "National" }] },
  { code: "AE", name: "United Arab Emirates", states: [{ code: "AE", name: "National" }] },
  { code: "GB", name: "United Kingdom", states: [{ code: "GB", name: "National" }] },
];

function normCode(v: unknown): string {
  return String(v ?? "").trim().toUpperCase();
}

export function branchStatesForCountry(countryCode: string) {
  const c = BRANCH_COUNTRIES.find((x) => x.code === normCode(countryCode));
  const states = c?.states || [];
  return [...states].sort((a, b) => a.name.localeCompare(b.name));
}

export function isStateValidForCountry(countryCode: string, stateCode: string): boolean {
  const sc = normCode(stateCode);
  if (!normCode(countryCode) || !sc) return false;
  return branchStatesForCountry(countryCode).some((s) => s.code === sc);
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

/** For location-catalog publish: use catalog state code when the label matches; else A–Z/0–9 slug (max 12). */
export function branchStateCodeForLocationPublish(countryCode: string, stateName: string): string {
  const fromCatalog = resolveStateCodeByName(countryCode, stateName);
  if (fromCatalog) return fromCatalog;
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
