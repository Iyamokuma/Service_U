import { BRANCH_COUNTRIES, branchCountryLabel, branchStateLabel } from "../branchRegions.js";
import { useAdminGeoFilters } from "../AdminGeoFilterContext.jsx";

/**
 * Country / state / satellite filters for Super Admin & General Admin.
 * Rendered once in AdminLayout so all dashboard tables share the same scope.
 */
export function GlobalAdminGeoFilterBar({ className = "" }) {
  const geo = useAdminGeoFilters();
  if (!geo.enabled) return null;

  const {
    country,
    state,
    satellite,
    setCountry,
    setState,
    setSatellite,
    clear,
    hasFilters,
    stateOptions,
    satelliteOptions,
  } = geo;

  return (
    <div
      className={`sa-global-geo-filters sa-dash-filters${className ? ` ${className}` : ""}`}
      role="toolbar"
      aria-label="Filter by country, state, and satellite"
    >
      <span className="sa-global-geo-filters-label">Scope</span>
      <div className="sa-dash-filter-slot">
        <select
          id="global-geo-country"
          className="sa-select sa-dash-filter-compact"
          title={country ? branchCountryLabel(country) || country : "Country"}
          value={country}
          onChange={(e) => setCountry(e.target.value)}
        >
          <option value="">Country</option>
          {BRANCH_COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="sa-dash-filter-slot">
        <select
          id="global-geo-state"
          className="sa-select sa-dash-filter-compact"
          title={state ? branchStateLabel(country, state) || state : "State"}
          value={state}
          disabled={!country}
          onChange={(e) => setState(e.target.value)}
        >
          <option value="">State</option>
          {stateOptions.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <div className="sa-dash-filter-slot">
        <select
          id="global-geo-satellite"
          className="sa-select sa-dash-filter-compact"
          title={satellite || "Satellite"}
          value={satellite}
          disabled={!country || !state}
          onChange={(e) => setSatellite(e.target.value)}
        >
          <option value="">Satellite</option>
          {satelliteOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>
      {hasFilters ? (
        <button type="button" className="sa-btn sa-btn-outline sa-btn-sm sa-dash-filter-reset" onClick={clear}>
          Clear
        </button>
      ) : null}
    </div>
  );
}
