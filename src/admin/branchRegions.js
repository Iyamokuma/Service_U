/** Location labels and helpers — countries/states live in the database (data entry), not here. */

export const BRANCH_COUNTRIES = [];

const countryLabels = new Map();
const stateLabels = new Map();

function normCode(v) {
  return String(v ?? "").trim().toUpperCase();
}

/** Populate human-readable labels from admin catalogList() payload. */
export function hydrateBranchLabelsFromCatalog(catalog) {
  if (!catalog) return;
  for (const c of catalog.countries || []) {
    const code = normCode(c.branch_country_code);
    const name = String(c.name || "").trim();
    if (code && name) countryLabels.set(code, name);
  }
  const countryById = new Map(
    (catalog.countries || []).map((c) => [Number(c.id), normCode(c.branch_country_code)]),
  );
  for (const s of catalog.states || []) {
    const cc = countryById.get(Number(s.country_id)) || "";
    const sc = normCode(s.branch_state_code);
    const name = String(s.name || "").trim();
    if (cc && sc && name) stateLabels.set(`${cc}|${sc}`, name);
  }
}

/** Populate labels from public directory_countries rows. */
export function hydrateBranchLabelsFromDirectoryCountries(rows) {
  for (const c of rows || []) {
    const code = normCode(c.branch_country_code);
    const name = String(c.name || "").trim();
    if (code && name) countryLabels.set(code, name);
  }
}

/** Populate labels from public directory_states rows for one country. */
export function hydrateBranchLabelsFromDirectoryStates(countryCode, rows) {
  const cc = normCode(countryCode);
  for (const s of rows || []) {
    const sc = normCode(s.branch_state_code);
    const name = String(s.name || "").trim();
    if (cc && sc && name) stateLabels.set(`${cc}|${sc}`, name);
  }
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
  if (stateLabels.has(`${cc}|${sc}`)) return true;
  return /^[A-Z0-9]{1,12}$/.test(sc);
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
  const cc = normCode(code);
  return countryLabels.get(cc) || cc;
}

export function branchStateLabel(countryCode, stateCode) {
  if (!stateCode) return "—";
  const cc = normCode(countryCode);
  const sc = normCode(stateCode);
  return stateLabels.get(`${cc}|${sc}`) || sc;
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
  const canonical = rawCode || resolveStateCodeByName(cc, rawName);
  if (!cc || !canonical) return null;
  const labelFromCache = stateLabels.get(`${cc}|${canonical}`);
  const display = String(displayName || "").trim();
  return {
    code: canonical,
    name: labelFromCache || display || branchStateLabel(cc, canonical) || canonical,
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
  if (countryLabels.has(c)) return c;
  if (/^[A-Z]{2,8}$/.test(c)) return c;
  return "";
}
