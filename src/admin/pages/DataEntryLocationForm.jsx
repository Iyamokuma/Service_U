import { useEffect, useMemo, useState } from "react";
import {
  fetchContinents,
  fetchCountriesForContinent,
  fetchLgasOrCities,
  fetchStatesForCountryName,
} from "../../lib/geoApi.js";
import { branchCountryLabel, branchCountryCodeFromIso2, branchStateLabel, hydrateBranchLabelsFromCatalog } from "../branchRegions.js";
import { api } from "../api.js";
import { useToast } from "../components/Toast.jsx";

export function DataEntryLocationForm() {
  const toast = useToast();
  const [entryMode, setEntryMode] = useState("catalog");
  const [catalog, setCatalog] = useState(null);
  const [catalogCountryCode, setCatalogCountryCode] = useState("");
  const [catalogStateCode, setCatalogStateCode] = useState("");
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
  const [submitting, setSubmitting] = useState(false);

  const catalogCountry = branchCountryCodeFromIso2(countryIso2);

  const catalogCountries = useMemo(
    () =>
      (catalog?.countries || [])
        .map((c) => ({
          code: String(c.branch_country_code || "").toUpperCase(),
          name: c.name || branchCountryLabel(c.branch_country_code),
          id: c.id,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [catalog?.countries],
  );

  const catalogStateOptions = useMemo(() => {
    const country = catalogCountries.find((c) => c.code === catalogCountryCode);
    if (!country) return [];
    return (catalog?.states || [])
      .filter((s) => Number(s.country_id) === Number(country.id))
      .map((s) => ({
        code: String(s.branch_state_code || "").toUpperCase(),
        name: s.name || branchStateLabel(catalogCountryCode, s.branch_state_code),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [catalog?.states, catalogCountries, catalogCountryCode]);

  const selectedCatalogState = catalogStateOptions.find((s) => s.code === catalogStateCode);

  useEffect(() => {
    const loadCatalog = () => {
      api
        .catalogList()
        .then((r) => {
          setCatalog(r);
          hydrateBranchLabelsFromCatalog(r);
        })
        .catch(() => setCatalog(null));
    };
    loadCatalog();
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      loadCatalog();
    };
    window.addEventListener("focus", onVis);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", onVis);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const filteredCountries = countries.filter((c) => {
    const q = countrySearch.trim().toLowerCase();
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || c.iso2.toLowerCase().includes(q);
  });

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
    if (!cleanedSats.length) {
      toast("Enter at least one satellite church name.", "error");
      return;
    }

    let payload;
    if (entryMode === "catalog") {
      if (!catalogCountryCode || !catalogStateCode || !lgaName.trim()) {
        toast("Select an existing country and state, then enter LGA and satellite churches.", "error");
        return;
      }
      const countryRow = catalogCountries.find((c) => c.code === catalogCountryCode);
      payload = {
        continent: "",
        countryIso2: /^[A-Z]{2}$/.test(catalogCountryCode) ? catalogCountryCode : catalogCountryCode,
        countryName: countryRow?.name || branchCountryLabel(catalogCountryCode),
        stateName: selectedCatalogState?.name || branchStateLabel(catalogCountryCode, catalogStateCode),
        lgaName: lgaName.trim(),
        satelliteChurches: cleanedSats,
      };
    } else {
      if (!continent || !countryIso2 || !countryName || !stateName || !lgaName) {
        toast("Select continent through LGA, then add satellite churches.", "error");
        return;
      }
      payload = {
        continent,
        countryIso2,
        countryName,
        stateName,
        lgaName,
        satelliteChurches: cleanedSats,
      };
    }

    setSubmitting(true);
    try {
      await api.createRequest({
        request_type: "location_catalog",
        payload,
      });
      toast("Proposal sent for Super / General Admin approval.", "success");
      if (entryMode === "catalog") {
        setLgaName("");
        setSatellites([""]);
      } else {
        setStateName("");
        setLgaName("");
        setSatellites([""]);
      }
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
          Add satellite churches to an <strong>existing</strong> country/state in the directory, or propose a brand-new
          geography path. Nothing goes live until a Super Admin or General Admin sets the request to{" "}
          <strong>approved</strong>.
        </p>

        <div className="sa-unit-tab-row" style={{ marginBottom: 20 }}>
          <button
            type="button"
            className={`sa-unit-tab-btn${entryMode === "catalog" ? " is-active" : ""}`}
            onClick={() => setEntryMode("catalog")}
          >
            Existing country / state
          </button>
          <button
            type="button"
            className={`sa-unit-tab-btn${entryMode === "geo" ? " is-active" : ""}`}
            onClick={() => setEntryMode("geo")}
          >
            New geography
          </button>
        </div>

        {entryMode === "catalog" ? (
          <div className="sa-de-grid">
            <div className="sa-field">
              <label className="sa-label">Country (directory)</label>
              <select
                className="sa-field-select"
                value={catalogCountryCode}
                onChange={(e) => {
                  setCatalogCountryCode(e.target.value);
                  setCatalogStateCode("");
                }}
              >
                <option value="">Select country</option>
                {catalogCountries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="sa-field">
              <label className="sa-label">State / region (directory)</label>
              <select
                className="sa-field-select"
                value={catalogStateCode}
                disabled={!catalogCountryCode}
                onChange={(e) => setCatalogStateCode(e.target.value)}
              >
                <option value="">{catalogCountryCode ? "Select state" : "Select country first"}</option>
                {catalogStateOptions.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="sa-field">
              <label className="sa-label">LGA / city</label>
              <input
                className="sa-input"
                value={lgaName}
                disabled={!catalogStateCode}
                onChange={(e) => setLgaName(e.target.value)}
                placeholder="LGA or city name"
              />
            </div>
          </div>
        ) : (
          <>
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
                setCountrySearch("");
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
              onChange={(e) => {
                const iso = e.target.value;
                setCountryIso2(iso);
                const row = countries.find((c) => c.iso2 === iso);
                setCountryName(row?.name || "");
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
            {lgas.length > 0 || loadingGeo.lgas ? (
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
            ) : (
              <input
                className="sa-input"
                value={lgaName}
                disabled={!stateName}
                onChange={(e) => setLgaName(e.target.value)}
                placeholder={stateName ? "Type LGA or city name" : "Select state first"}
              />
            )}
            {!loadingGeo.lgas && stateName && !lgas.length ? (
              <p className="sa-field-hint">No directory list for this state — type the LGA or city manually.</p>
            ) : null}
          </div>
        </div>
          </>
        )}

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
