import { useEffect, useState } from "react";
import {
  fetchContinents,
  fetchCountriesForContinent,
  fetchLgasOrCities,
  fetchStatesForCountryName,
} from "../../lib/geoApi.js";
import { branchCountryCodeFromIso2 } from "../branchRegions.js";
import { api } from "../api.js";
import { useToast } from "../components/Toast.jsx";

export function DataEntryLocationForm() {
  const toast = useToast();
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

  const [loadingGeo, setLoadingGeo] = useState({ continents: true, countries: false, states: false, lgas: false });
  const [submitting, setSubmitting] = useState(false);

  const catalogCountry = branchCountryCodeFromIso2(countryIso2);

  useEffect(() => {
    let cancelled = false;
    fetchContinents()
      .then((rows) => {
        if (!cancelled) setContinents(rows);
      })
      .catch((e) => toast(e.message, "error"))
      .finally(() => {
        if (!cancelled) setLoadingGeo((g) => ({ ...g, continents: false }));
      });
    return () => {
      cancelled = true;
    };
  }, [toast]);

  useEffect(() => {
    if (!continent) {
      setCountries([]);
      setCountryIso2("");
      setCountryName("");
      return;
    }
    let cancelled = false;
    setLoadingGeo((g) => ({ ...g, countries: true }));
    fetchCountriesForContinent(continent)
      .then((rows) => {
        if (!cancelled) setCountries(rows);
      })
      .catch((e) => {
        if (!cancelled) toast(e.message, "error");
      })
      .finally(() => {
        if (!cancelled) setLoadingGeo((g) => ({ ...g, countries: false }));
      });
    return () => {
      cancelled = true;
    };
  }, [continent, toast]);

  useEffect(() => {
    if (!countryName) {
      setStates([]);
      setStateName("");
      return;
    }
    let cancelled = false;
    setLoadingGeo((g) => ({ ...g, states: true }));
    fetchStatesForCountryName(countryName)
      .then((rows) => {
        if (!cancelled) setStates(rows);
      })
      .catch((e) => {
        if (!cancelled) toast(e.message, "error");
      })
      .finally(() => {
        if (!cancelled) setLoadingGeo((g) => ({ ...g, states: false }));
      });
    return () => {
      cancelled = true;
    };
  }, [countryName, toast]);

  useEffect(() => {
    if (!countryName || !stateName) {
      setLgas([]);
      setLgaName("");
      return;
    }
    let cancelled = false;
    setLoadingGeo((g) => ({ ...g, lgas: true }));
    fetchLgasOrCities(countryName, stateName)
      .then((rows) => {
        if (!cancelled) setLgas(rows);
      })
      .catch((e) => {
        if (!cancelled) toast(e.message, "error");
      })
      .finally(() => {
        if (!cancelled) setLoadingGeo((g) => ({ ...g, lgas: false }));
      });
    return () => {
      cancelled = true;
    };
  }, [countryName, stateName, toast]);

  function setSatellite(i, v) {
    setSatellites((prev) => prev.map((x, j) => (j === i ? v : x)));
  }

  function addSatelliteRow() {
    setSatellites((prev) => [...prev, ""]);
  }

  function removeSatelliteRow(i) {
    setSatellites((prev) => (prev.length <= 1 ? prev : prev.filter((_, j) => j !== i)));
  }

  async function submit() {
    const cleanedSats = satellites.map((s) => s.trim()).filter(Boolean);
    if (!continent || !countryIso2 || !countryName || !stateName || !lgaName) {
      toast("Select continent through LGA, then add satellite churches.", "error");
      return;
    }
    if (!cleanedSats.length) {
      toast("Enter at least one satellite church name.", "error");
      return;
    }
    setSubmitting(true);
    try {
      await api.createRequest({
        request_type: "location_catalog",
        payload: {
          continent,
          countryIso2,
          countryName,
          stateName,
          lgaName,
          satelliteChurches: cleanedSats,
        },
      });
      toast("Proposal sent for Super / General Admin approval.", "success");
      setStateName("");
      setLgaName("");
      setSatellites([""]);
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="sa-card sa-data-entry-panel">
      <div className="sa-card-head">
        <span className="sa-card-title">Propose church location</span>
      </div>
      <div className="sa-card-body">
        <p className="sa-text-sm sa-text-muted" style={{ maxWidth: 720, lineHeight: 1.55, marginBottom: 20 }}>
          Choose geography from the directory (continent → country → state → LGA / city). Type satellite church names
          manually. Nothing goes live until a Super Admin or General Admin sets the request to{" "}
          <strong>approved</strong> (churches then appear on the public registration form for that area).
        </p>

        {!catalogCountry && countryIso2 ? (
          <div
            className="sa-field-hint"
            style={{
              marginBottom: 16,
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid var(--sa-warning)",
              background: "var(--sa-warning-bg)",
              color: "var(--sa-text)",
            }}
          >
            When approved, this country is added to the directory automatically if it is not there yet. Existing states
            (e.g. Abia) are reused so churches appear under the correct region with no duplicates.
          </div>
        ) : null}

        <div className="sa-de-grid">
          <div className="sa-field">
            <label className="sa-label">Continent</label>
            <select
              className="sa-field-select"
              value={continent}
              disabled={loadingGeo.continents}
              onChange={(e) => {
                setContinent(e.target.value);
                setCountryIso2("");
                setCountryName("");
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
            <label className="sa-label">Country</label>
            <select
              className="sa-field-select"
              value={countryIso2}
              disabled={!continent || loadingGeo.countries}
              onChange={(e) => {
                const iso = e.target.value;
                setCountryIso2(iso);
                const row = countries.find((c) => c.iso2 === iso);
                setCountryName(row?.name || "");
              }}
            >
              <option value="">{loadingGeo.countries ? "Loading…" : "Select country"}</option>
              {countries.map((c) => (
                <option key={c.iso2} value={c.iso2}>
                  {c.name} ({c.iso2})
                </option>
              ))}
            </select>
          </div>

          <div className="sa-field">
            <label className="sa-label">State / region</label>
            <select
              className="sa-field-select"
              value={stateName}
              disabled={!countryName || loadingGeo.states}
              onChange={(e) => setStateName(e.target.value)}
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
            <label className="sa-label">LGA / city (directory)</label>
            <select
              className="sa-field-select"
              value={lgaName}
              disabled={!stateName || loadingGeo.lgas}
              onChange={(e) => setLgaName(e.target.value)}
            >
              <option value="">{loadingGeo.lgas ? "Loading…" : "Select LGA or city"}</option>
              {lgas.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="sa-field" style={{ marginTop: 20 }}>
          <label className="sa-label">Satellite churches (type each name)</label>
          <div className="sa-de-sat-list">
            {satellites.map((s, i) => (
              <div key={i} className="sa-de-sat-row">
                <input
                  className="sa-input"
                  value={s}
                  onChange={(e) => setSatellite(i, e.target.value)}
                  placeholder={`Satellite church ${i + 1}`}
                />
                {satellites.length > 1 ? (
                  <button type="button" className="sa-btn sa-btn-ghost sa-btn-sm" onClick={() => removeSatelliteRow(i)}>
                    Remove
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          <button type="button" className="sa-btn sa-btn-outline sa-btn-sm" style={{ marginTop: 8 }} onClick={addSatelliteRow}>
            Add another satellite
          </button>
        </div>

        <div style={{ marginTop: 24 }}>
          <button type="button" className="sa-btn sa-btn-primary" disabled={submitting} onClick={submit}>
            {submitting ? "Sending…" : "Submit for approval"}
          </button>
        </div>
      </div>
    </div>
  );
}
