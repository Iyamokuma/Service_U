/**
 * Geography for data-entry flows (browser). Uses public APIs — no keys.
 * Continents from RestCountries; states & cities from CountriesNow.
 */

const RC_FIELDS = "name,cca2,continents,region";
const RC_URL = `https://restcountries.com/v3.1/all?fields=${RC_FIELDS}`;
const CN_STATES = "https://countriesnow.space/api/v0.1/countries/states";
const CN_CITIES = "https://countriesnow.space/api/v0.1/countries/state/cities";

let countriesCache = null;

function normContinent(c) {
  const x = String(c || "").trim();
  if (!x) return "Other";
  return x;
}

/** @returns {Promise<{ code: string, label: string }[]>} */
export async function fetchContinents() {
  const countries = await fetchCountriesRaw();
  const set = new Map();
  for (const row of countries) {
    const cont = row.continents?.[0] || row.region || "Other";
    const label = normContinent(cont);
    const code = label.toUpperCase().replace(/\s+/g, "_").slice(0, 16);
    if (!set.has(label)) set.set(label, { code, label });
  }
  return [...set.values()].sort((a, b) => a.label.localeCompare(b.label));
}

async function fetchCountriesRaw() {
  if (countriesCache) return countriesCache;
  const res = await fetch(RC_URL);
  if (!res.ok) throw new Error("Could not load country directory.");
  countriesCache = await res.json();
  return countriesCache;
}

/** @param {string} continentLabel e.g. "Africa" */
export async function fetchCountriesForContinent(continentLabel) {
  const want = String(continentLabel || "").trim().toLowerCase();
  const countries = await fetchCountriesRaw();
  const out = countries
    .filter((c) => {
      const cont = (c.continents?.[0] || c.region || "").toLowerCase();
      return cont === want;
    })
    .map((c) => ({
      iso2: String(c.cca2 || "").toUpperCase(),
      name: c.name?.common || c.name?.official || c.cca2 || "",
    }))
    .filter((c) => c.iso2 && c.name)
    .sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

/** @param {string} countryName Common name e.g. "Nigeria" */
export async function fetchStatesForCountryName(countryName) {
  const country = String(countryName || "").trim();
  if (!country) return [];
  const res = await fetch(CN_STATES, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ country }),
  });
  const j = await res.json();
  if (!res.ok || j.error) {
    throw new Error(j.msg || j.error || "Could not load states for this country.");
  }
  const states = j?.data?.states;
  if (!Array.isArray(states)) return [];
  return states.map((s) => (typeof s === "string" ? s : s.name || String(s))).filter(Boolean);
}

/** @param {string} countryName @param {string} stateName */
export async function fetchLgasOrCities(countryName, stateName) {
  const country = String(countryName || "").trim().toLowerCase();
  const state = String(stateName || "").trim();
  if (!country || !state) return [];
  const res = await fetch(CN_CITIES, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ country, state }),
  });
  const j = await res.json();
  if (!res.ok || j.error) {
    throw new Error(j.msg || j.error || "Could not load LGA / city list.");
  }
  const cities = j?.data;
  if (!Array.isArray(cities)) return [];
  return cities.map((c) => String(c)).filter(Boolean).sort((a, b) => a.localeCompare(b));
}
