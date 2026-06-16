import { useEffect, useState } from "react";
import { Modal } from "./Modal.jsx";
import {
  fetchContinents,
  fetchCountriesForContinent,
  fetchLgasOrCities,
  fetchStatesForCountryName,
} from "../../lib/geoApi.js";
import { branchCountryCodeFromIso2 } from "../branchRegions.js";

export function LocationCreateModal({ open, onClose, onSubmit, saving, submitLabel, introText }) {
  const [continents, setContinents] = useState([]);
  const [countries, setCountries] = useState([]);
  const [states, setStates] = useState([]);
  const [lgas, setLgas] = useState([]);

  const [continent, setContinent] = useState("");
  const [countryIso2, setCountryIso2] = useState("");
  const [countryName, setCountryName] = useState("");
  const [stateName, setStateName] = useState("");
  const [lgaName, setLgaName] = useState("");
  const [satellites, setSatellites] = useState([""]);
  const [countrySearch, setCountrySearch] = useState("");

  const [loadingGeo, setLoadingGeo] = useState({ continents: true, countries: false, states: false, lgas: false });

  const catalogCountry = branchCountryCodeFromIso2(countryIso2);

  const filteredCountries = countries.filter((c) => {
    const q = countrySearch.trim().toLowerCase();
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || c.iso2.toLowerCase().includes(q);
  });

  useEffect(() => {
    if (!open) return;
    setContinent("");
    setCountryIso2("");
    setCountryName("");
    setStateName("");
    setLgaName("");
    setSatellites([""]);
    setCountrySearch("");
    let cancelled = false;
    fetchContinents()
      .then((rows) => {
        if (!cancelled) setContinents(rows);
      })
      .finally(() => {
        if (!cancelled) setLoadingGeo((g) => ({ ...g, continents: false }));
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !continent) {
      setCountries([]);
      return;
    }
    let cancelled = false;
    setLoadingGeo((g) => ({ ...g, countries: true }));
    fetchCountriesForContinent(continent)
      .then((rows) => {
        if (!cancelled) setCountries(rows);
      })
      .finally(() => {
        if (!cancelled) setLoadingGeo((g) => ({ ...g, countries: false }));
      });
    return () => {
      cancelled = true;
    };
  }, [open, continent]);

  useEffect(() => {
    if (!open || !countryName) {
      setStates([]);
      return;
    }
    let cancelled = false;
    setLoadingGeo((g) => ({ ...g, states: true }));
    fetchStatesForCountryName(countryName)
      .then((rows) => {
        if (!cancelled) setStates(rows);
      })
      .finally(() => {
        if (!cancelled) setLoadingGeo((g) => ({ ...g, states: false }));
      });
    return () => {
      cancelled = true;
    };
  }, [open, countryName]);

  useEffect(() => {
    if (!open || !countryName || !stateName) {
      setLgas([]);
      return;
    }
    let cancelled = false;
    setLoadingGeo((g) => ({ ...g, lgas: true }));
    fetchLgasOrCities(countryName, stateName)
      .then((rows) => {
        if (!cancelled) setLgas(rows);
      })
      .finally(() => {
        if (!cancelled) setLoadingGeo((g) => ({ ...g, lgas: false }));
      });
    return () => {
      cancelled = true;
    };
  }, [open, countryName, stateName]);

  function setSatellite(i, v) {
    setSatellites((prev) => prev.map((x, j) => (j === i ? v : x)));
  }

  function handleSubmit(e) {
    e.preventDefault();
    const cleanedSats = satellites.map((s) => s.trim()).filter(Boolean);
    onSubmit({
      continent,
      countryIso2,
      countryName,
      stateName,
      lgaName,
      satelliteChurches: cleanedSats,
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create location"
      size="lg"
      footer={
        <>
          <button type="button" className="sa-btn sa-btn-outline" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="location-create-form" className="sa-btn sa-btn-primary" disabled={saving}>
            {saving ? "Saving…" : submitLabel || "Create location"}
          </button>
        </>
      }
    >
      <form id="location-create-form" onSubmit={handleSubmit}>
        <p className="sa-text-sm sa-text-muted" style={{ marginBottom: 16, lineHeight: 1.5 }}>
          {introText ||
            "Select continent through LGA from the geography directory, then type satellite church name(s). Locations go live on the registration form immediately."}
        </p>

        {!catalogCountry && countryIso2 ? (
          <div
            className="sa-field-hint"
            style={{
              marginBottom: 16,
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid var(--sa-warning)",
            }}
          >
            This ISO code is not mapped to a branch country code yet; the server will still attempt to publish using
            the country name.
          </div>
        ) : null}

        <div className="sa-de-grid">
          <div className="sa-field">
            <label className="sa-label">
              Continent <span className="sa-required">*</span>
            </label>
            <select
              className="sa-field-select"
              value={continent}
              disabled={loadingGeo.continents}
              required
              onChange={(e) => {
                setContinent(e.target.value);
                setCountryIso2("");
                setCountryName("");
                setCountrySearch("");
                setStateName("");
                setLgaName("");
              }}
            >
              <option value="">{loadingGeo.continents ? "Loading…" : "Select continent"}</option>
              {continents.map((c) => (
                <option key={c.code} value={c.label}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="sa-field">
            <label className="sa-label">
              Country <span className="sa-required">*</span>
            </label>
            {continent && !loadingGeo.countries && countries.length > 0 ? (
              <input
                className="sa-input"
                style={{ marginBottom: 8 }}
                value={countrySearch}
                disabled={!continent}
                onChange={(e) => setCountrySearch(e.target.value)}
                placeholder="Search country name or code (e.g. Nigeria, NG)"
              />
            ) : null}
            <select
              className="sa-field-select"
              value={countryIso2}
              disabled={!continent || loadingGeo.countries}
              required
              onChange={(e) => {
                const iso = e.target.value;
                setCountryIso2(iso);
                const row = countries.find((c) => c.iso2 === iso);
                setCountryName(row?.name || "");
                setStateName("");
                setLgaName("");
              }}
            >
              <option value="">
                {loadingGeo.countries ? "Loading…" : continent ? "Select country" : "Select continent first"}
              </option>
              {filteredCountries.map((c) => (
                <option key={c.iso2} value={c.iso2}>
                  {c.name} ({c.iso2})
                </option>
              ))}
            </select>
            {continent && !loadingGeo.countries ? (
              <p className="sa-field-hint">
                {countries.length} countries in {continent}
                {countrySearch && filteredCountries.length !== countries.length
                  ? ` · ${filteredCountries.length} match search`
                  : ""}
              </p>
            ) : null}
          </div>

          <div className="sa-field">
            <label className="sa-label">
              State / region <span className="sa-required">*</span>
            </label>
            <select
              className="sa-field-select"
              value={stateName}
              disabled={!countryName || loadingGeo.states}
              required
              onChange={(e) => {
                setStateName(e.target.value);
                setLgaName("");
              }}
            >
              <option value="">{loadingGeo.states ? "Loading…" : "Select state"}</option>
              {states.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="sa-field">
            <label className="sa-label">
              LGA / city <span className="sa-required">*</span>
            </label>
            {lgas.length > 0 || loadingGeo.lgas ? (
              <select
                className="sa-field-select"
                value={lgaName}
                disabled={!stateName || loadingGeo.lgas}
                required
                onChange={(e) => setLgaName(e.target.value)}
              >
                <option value="">{loadingGeo.lgas ? "Loading…" : "Select LGA or city"}</option>
                {lgas.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="sa-input"
                value={lgaName}
                disabled={!stateName}
                required
                onChange={(e) => setLgaName(e.target.value)}
                placeholder={stateName ? "Type LGA or city name" : "Select state first"}
              />
            )}
            {!loadingGeo.lgas && stateName && !lgas.length ? (
              <p className="sa-field-hint">No directory list for this state — type the LGA or city manually.</p>
            ) : null}
          </div>
        </div>

        <div className="sa-field" style={{ marginTop: 16 }}>
          <label className="sa-label">
            Satellite church <span className="sa-required">*</span>
          </label>
          <div className="sa-de-sat-list">
            {satellites.map((s, i) => (
              <div key={i} className="sa-de-sat-row">
                <input
                  className="sa-input"
                  value={s}
                  onChange={(e) => setSatellite(i, e.target.value)}
                  placeholder={`Satellite church ${i + 1}`}
                  required={i === 0}
                />
                {satellites.length > 1 ? (
                  <button
                    type="button"
                    className="sa-btn sa-btn-ghost sa-btn-sm"
                    onClick={() => setSatellites((prev) => (prev.length <= 1 ? prev : prev.filter((_, j) => j !== i)))}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          <button
            type="button"
            className="sa-btn sa-btn-outline sa-btn-sm"
            style={{ marginTop: 8 }}
            onClick={() => setSatellites((prev) => [...prev, ""])}
          >
            Add another satellite
          </button>
        </div>
      </form>
    </Modal>
  );
}
