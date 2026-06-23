/**
 * Geography for data-entry flows (continent → country → state → LGA).
 * Countries from CountriesNow (full list); continents from ISO region map.
 */

const ISO_COUNTRIES_URL =
  "https://cdn.jsdelivr.net/gh/lukes/ISO-3166-Countries-with-Regional-Codes@master/all/all.json";
const CN_BASE = "https://countriesnow.space/api/v0.1";

/** Salvation Ministries priority countries shown first in lists. */
const PRIORITY_ISO2 = ["NG", "GH", "CM", "GM", "BJ", "AE", "GB", "CH", "US"];

let isoRegionByCode = null;
let countriesNowCache = null;

function normContinent(c) {
  const x = String(c || "").trim();
  if (!x || x.toLowerCase() === "other") return "";
  return x;
}

function sortCountriesWithPriority(list) {
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

async function countriesNowGet(path) {
  let res;
  try {
    res = await fetch(`${CN_BASE}${path}`);
  } catch {
    throw new Error("Could not reach the geography directory. Check your connection and try again.");
  }
  const j = await res.json();
  if (!res.ok || j.error) {
    throw new Error(j.msg || "Geography lookup failed.");
  }
  if (j.data === undefined || j.data === null) {
    throw new Error(j.msg || "Geography lookup returned no data.");
  }
  return j.data;
}

async function loadIsoRegionByCode() {
  if (isoRegionByCode) return isoRegionByCode;
  let res;
  try {
    res = await fetch(ISO_COUNTRIES_URL);
  } catch {
    throw new Error("Could not reach the country directory. Check your connection and try again.");
  }
  if (!res.ok) throw new Error("Could not load country directory.");
  const rows = await res.json();
  if (!Array.isArray(rows)) throw new Error("Could not load country directory.");
  const map = new Map();
  for (const row of rows) {
    const iso2 = String(row["alpha-2"] || "").toUpperCase();
    if (!iso2) continue;
    map.set(iso2, normContinent(row.region));
  }
  isoRegionByCode = map;
  return map;
}

async function fetchCountriesNowIso() {
  if (countriesNowCache) return countriesNowCache;
  const rows = await countriesNowGet("/countries/iso");
  if (!Array.isArray(rows)) throw new Error("Could not load country directory.");
  countriesNowCache = rows
    .map((r) => ({
      iso2: String(r.Iso2 || r.iso2 || "").toUpperCase(),
      name: String(r.name || "").trim(),
    }))
    .filter((c) => c.iso2 && c.name);
  return countriesNowCache;
}

/** @returns {Promise<{ code: string, label: string }[]>} */
export async function fetchContinents() {
  const [countries, regionMap] = await Promise.all([fetchCountriesNowIso(), loadIsoRegionByCode()]);
  const set = new Map();
  for (const c of countries) {
    const label = regionMap.get(c.iso2) || "";
    if (!label) continue;
    const code = label.toUpperCase().replace(/\s+/g, "_").slice(0, 16);
    if (!set.has(label)) set.set(label, { code, label });
  }
  return [...set.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/** @param {string} continentLabel e.g. "Africa" */
export async function fetchCountriesForContinent(continentLabel) {
  const want = String(continentLabel || "").trim().toLowerCase();
  const [countries, regionMap] = await Promise.all([fetchCountriesNowIso(), loadIsoRegionByCode()]);
  const filtered = countries
    .filter((c) => {
      const region = regionMap.get(c.iso2) || "";
      return region && region.toLowerCase() === want;
    })
    .map(({ iso2, name }) => ({ iso2, name }));
  return sortCountriesWithPriority(filtered);
}

/** @param {string} countryName Common name e.g. "Nigeria" */
export async function fetchStatesForCountryName(countryName) {
  const country = String(countryName || "").trim();
  if (!country) return [];
  const data = await countriesNowGet(`/countries/states/q?country=${encodeURIComponent(country)}`);
  const states = data?.states;
  if (!Array.isArray(states)) return [];
  return states.map((s) => (typeof s === "string" ? s : s.name || String(s))).filter(Boolean);
}

/** @param {string} countryName @param {string} stateName */
export async function fetchLgasOrCities(countryName, stateName) {
  const country = String(countryName || "").trim().toLowerCase();
  const state = String(stateName || "").trim();
  if (!country || !state) return [];
  const cities = await countriesNowGet(
    `/countries/state/cities/q?country=${encodeURIComponent(country)}&state=${encodeURIComponent(state)}`,
  );
  if (!Array.isArray(cities)) return [];
  return cities.map((c) => String(c)).filter(Boolean).sort((a, b) => a.localeCompare(b));
}
