/** Server-side geography for admin data-entry flows (CountriesNow + ISO region map). */

const ISO_COUNTRIES_URL =
  "https://cdn.jsdelivr.net/gh/lukes/ISO-3166-Countries-with-Regional-Codes@master/all/all.json";
const CN_BASE = "https://countriesnow.space/api/v0.1";

const PRIORITY_ISO2 = ["NG", "GH", "CM", "GM", "BJ", "AE", "GB", "CH", "US"];

type CountriesNowResponse<T> = {
  error?: boolean;
  msg?: string;
  data?: T;
};

type IsoCountryRow = {
  name?: string;
  "alpha-2"?: string;
  region?: string;
};

type CnIsoRow = {
  name?: string;
  Iso2?: string;
  iso2?: string;
};

let isoRegionByCode: Map<string, string> | null = null;
let countriesNowCache: { iso2: string; name: string }[] | null = null;

function normContinent(c: unknown): string {
  const x = String(c ?? "").trim();
  return x || "Other";
}

function sortCountriesWithPriority(list: { iso2: string; name: string }[]) {
  return [...list].sort((a, b) => {
    const pa = PRIORITY_ISO2.indexOf(a.iso2);
    const pb = PRIORITY_ISO2.indexOf(b.iso2);
    if (pa !== -1 || pb !== -1) {
      if (pa === -1) return 1;
      if (pb === -1) return -1;
      return pa - pb;
    }
    return a.name.localeCompare(b.name);
  });
}

async function countriesNowGet<T>(path: string): Promise<T> {
  const res = await fetch(`${CN_BASE}${path}`);
  const j = await res.json() as CountriesNowResponse<T>;
  if (!res.ok || j.error) {
    throw new Error(j.msg || "Geography lookup failed.");
  }
  if (j.data === undefined || j.data === null) {
    throw new Error(j.msg || "Geography lookup returned no data.");
  }
  return j.data;
}

async function loadIsoRegionByCode(): Promise<Map<string, string>> {
  if (isoRegionByCode) return isoRegionByCode;
  const res = await fetch(ISO_COUNTRIES_URL);
  if (!res.ok) throw new Error("Could not load country directory.");
  const rows = await res.json() as IsoCountryRow[];
  if (!Array.isArray(rows)) throw new Error("Could not load country directory.");
  const map = new Map<string, string>();
  for (const row of rows) {
    const iso2 = String(row["alpha-2"] || "").toUpperCase();
    if (!iso2) continue;
    map.set(iso2, normContinent(row.region));
  }
  isoRegionByCode = map;
  return map;
}

async function fetchCountriesNowIso(): Promise<{ iso2: string; name: string }[]> {
  if (countriesNowCache) return countriesNowCache;
  const rows = await countriesNowGet<CnIsoRow[]>("/countries/iso");
  if (!Array.isArray(rows)) throw new Error("Could not load country directory.");
  countriesNowCache = rows
    .map((r) => ({
      iso2: String(r.Iso2 || r.iso2 || "").toUpperCase(),
      name: String(r.name || "").trim(),
    }))
    .filter((c) => c.iso2 && c.name);
  return countriesNowCache;
}

export async function geoFetchContinents(): Promise<{ code: string; label: string }[]> {
  const [countries, regionMap] = await Promise.all([fetchCountriesNowIso(), loadIsoRegionByCode()]);
  const set = new Map<string, { code: string; label: string }>();
  for (const c of countries) {
    const label = regionMap.get(c.iso2) || "Other";
    const code = label.toUpperCase().replace(/\s+/g, "_").slice(0, 16);
    if (!set.has(label)) set.set(label, { code, label });
  }
  return [...set.values()].sort((a, b) => a.label.localeCompare(b.label));
}

export async function geoFetchCountriesForContinent(continentLabel: string) {
  const want = String(continentLabel || "").trim().toLowerCase();
  const [countries, regionMap] = await Promise.all([fetchCountriesNowIso(), loadIsoRegionByCode()]);
  const filtered = countries
    .filter((c) => (regionMap.get(c.iso2) || "Other").toLowerCase() === want)
    .map(({ iso2, name }) => ({ iso2, name }));
  return sortCountriesWithPriority(filtered);
}

export async function geoFetchStatesForCountryName(countryName: string): Promise<string[]> {
  const country = String(countryName || "").trim();
  if (!country) return [];
  const data = await countriesNowGet<{ states?: unknown[] }>(
    `/countries/states/q?country=${encodeURIComponent(country)}`,
  );
  const states = data?.states;
  if (!Array.isArray(states)) return [];
  return states.map((s) => (typeof s === "string" ? s : (s as { name?: string }).name || String(s))).filter(Boolean);
}

export async function geoFetchLgasOrCities(countryName: string, stateName: string): Promise<string[]> {
  const country = String(countryName || "").trim().toLowerCase();
  const state = String(stateName || "").trim();
  if (!country || !state) return [];
  const cities = await countriesNowGet<unknown[]>(
    `/countries/state/cities/q?country=${encodeURIComponent(country)}&state=${encodeURIComponent(state)}`,
  );
  if (!Array.isArray(cities)) return [];
  return cities.map((c) => String(c)).filter(Boolean).sort((a, b) => a.localeCompare(b));
}
