import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { useAdminAuth } from "../AdminContext.jsx";
import { canPublishLocations, canProposeLocations } from "../roles.js";
import { useToast } from "../components/Toast.jsx";
import { LocationCreateModal } from "../components/LocationCreateModal.jsx";
import { AddSatellitesModal } from "../components/AddSatellitesModal.jsx";
import { BranchLocationDetail } from "./BranchLocationDetail.jsx";
import { countriesFromCatalog } from "../catalogGeoOptions.js";
import { useCountryStateRows } from "../hooks/useCountryStateRows.js";
import { StateRegionSelect } from "../components/StateRegionSelect.jsx";
import { SmhLoader } from "../../components/SmhLoader.jsx";
import {
  buildAllRows,
  buildCountryRows,
  buildSatelliteRows,
  buildStateRows,
  uniqueContinents,
} from "../catalogUtils.js";
import { exportCsv } from "../exportCsv.js";
import { ADMIN_CATALOG_CHANGED } from "../adminLiveRefresh.js";

const TABS = [
  { id: "satellite", label: "Satellite churches" },
  { id: "all", label: "All branches" },
  { id: "state", label: "States & regions" },
  { id: "country", label: "Countries" },
];

/** Branch directory: compact view tabs (same ids as TABS for table rendering). */
const BRANCH_DIRECTORY_TABS = [
  { id: "all", label: "All" },
  { id: "country", label: "Country" },
  { id: "state", label: "State" },
  { id: "satellite", label: "Satellite" },
];

const PAGE_COPY = {
  locations: {
    title: "Locations",
    subtitle:
      "Countries, state branches, and satellite churches that power the public registration form. Activate or hide branches without removing history.",
    loading: "Loading locations…",
    error: "Could not load locations.",
    cardTitle: "Directory",
  },
  catalog: {
    title: "Branch directory",
    subtitle: "Browse and manage the geographic directory used across admin and public registration.",
    loading: "Loading branch directory…",
    error: "Could not load the branch directory.",
    cardTitle: "Branch directory",
  },
};

const emptyFilters = () => ({
  continent: "",
  country: "",
  branch: "",
  satellite: "",
  status: "",
  search: "",
});

function normalizeCatalog(raw) {
  if (!raw || typeof raw !== "object") return null;
  return {
    countries: Array.isArray(raw.countries) ? raw.countries : [],
    states: Array.isArray(raw.states) ? raw.states : [],
    churches: Array.isArray(raw.churches) ? raw.churches : [],
    satellites: Array.isArray(raw.satellites) ? raw.satellites : [],
    admins: Array.isArray(raw.admins) ? raw.admins : [],
    stats: raw.stats && typeof raw.stats === "object"
      ? raw.stats
      : { membersByCountry: {}, membersByState: {}, membersBySatellite: {} },
  };
}

function DirectoryToolbarActions({
  busy,
  canCreateLocation,
  onRefresh,
  onNewLocation,
  size = "sm",
  refreshLabel = "Refresh",
  createLabel = "+ New location",
}) {
  const btnClass = size === "sm" ? " sa-btn-sm" : "";
  return (
    <>
      <button type="button" className={`sa-btn sa-btn-outline${btnClass}`} disabled={busy} onClick={onRefresh}>
        {refreshLabel}
      </button>
      {canCreateLocation ? (
        <button type="button" className={`sa-btn sa-btn-primary${btnClass}`} onClick={onNewLocation}>
          {createLabel}
        </button>
      ) : null}
    </>
  );
}

export function BranchCatalog({ variant = "catalog" }) {
  const copy = PAGE_COPY[variant] || PAGE_COPY.catalog;
  const isBranchDirectory = variant === "catalog";
  const { admin } = useAdminAuth();
  const canCreateLocation = canPublishLocations(admin?.role) || canProposeLocations(admin?.role);
  const canManageChurches = canPublishLocations(admin?.role);
  const locationSubmitMode = canPublishLocations(admin?.role) ? "publish" : "propose";
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState(null);
  const [tab, setTab] = useState(variant === "locations" ? "satellite" : "all");
  const [filters, setFilters] = useState(() => emptyFilters());
  const [detail, setDetail] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [addSatellitesPreset, setAddSatellitesPreset] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const viewTabs = isBranchDirectory ? BRANCH_DIRECTORY_TABS : TABS;
  const { stateRows: branchOptions } = useCountryStateRows(filters.country, {
    enabled: Boolean(filters.country),
  });

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const r = await api.catalogList();
      setCatalog(normalizeCatalog(r));
    } catch (e) {
      const msg = e.message || "Could not load directory.";
      setLoadError(msg);
      setCatalog(normalizeCatalog(null));
      toast(msg, "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onCatalogChanged = () => load();
    window.addEventListener(ADMIN_CATALOG_CHANGED, onCatalogChanged);
    return () => window.removeEventListener(ADMIN_CATALOG_CHANGED, onCatalogChanged);
  }, [load]);

  useEffect(() => {
    if (!viewTabs.some((t) => t.id === tab)) {
      setTab(viewTabs[0]?.id || "all");
    }
  }, [viewTabs, tab]);

  const allRows = useMemo(() => (catalog ? buildAllRows(catalog) : []), [catalog]);
  const countryRows = useMemo(() => (catalog ? buildCountryRows(catalog) : []), [catalog]);
  const stateRows = useMemo(() => (catalog ? buildStateRows(catalog) : []), [catalog]);
  const satelliteRows = useMemo(() => (catalog ? buildSatelliteRows(catalog) : []), [catalog]);

  const continentOptions = useMemo(
    () => uniqueContinents(catalog?.satellites, catalog?.churches),
    [catalog],
  );

  const countryOptions = useMemo(
    () => countriesFromCatalog(catalog || { countries: [] }),
    [catalog],
  );

  const filterSearch = String(filters?.search ?? "");

  const filteredAll = useMemo(() => {
    const q = filterSearch.trim().toLowerCase();
    return allRows.filter((r) => {
      if (filters.continent && r.continent !== filters.continent) return false;
      if (filters.country && r.branch_country !== filters.country) return false;
      if (filters.branch && r.branch_state !== filters.branch) return false;
      if (filters.satellite && r.name !== filters.satellite) return false;
      if (filters.status === "active" && !r.is_active) return false;
      if (filters.status === "hidden" && r.is_active) return false;
      if (q) {
        const hay = [r.name, r.countryLabel, r.stateLabel, r.lga, r.branchAdminName].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allRows, filters]);

  const filteredCountries = useMemo(() => {
    const q = filterSearch.trim().toLowerCase();
    return countryRows.filter((r) => {
      if (filters.country && r.code !== filters.country) return false;
      if (q && !`${r.name} ${r.branchAdminName}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [countryRows, filters, filterSearch]);

  const filteredSatellites = useMemo(() => {
    const q = filterSearch.trim().toLowerCase();
    return satelliteRows.filter((r) => {
      if (filters.continent && r.continent !== filters.continent) return false;
      if (filters.country && r.branch_country !== filters.country) return false;
      if (filters.branch && r.branch_state !== filters.branch) return false;
      if (filters.satellite && r.name !== filters.satellite) return false;
      if (filters.status === "active" && !r.is_active) return false;
      if (filters.status === "hidden" && !r.is_active) return false;
      if (q) {
        const hay = [r.name, r.countryLabel, r.stateLabel, r.lga, r.pastorName].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [satelliteRows, filters, filterSearch]);

  const filteredStates = useMemo(() => {
    const q = filterSearch.trim().toLowerCase();
    return stateRows.filter((r) => {
      if (filters.country && r.branch_country !== filters.country) return false;
      if (filters.branch && r.branch_state !== filters.branch) return false;
      if (q && !`${r.stateLabel} ${r.countryLabel} ${r.contact}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [stateRows, filters, filterSearch]);

  const satelliteFilterOptions = useMemo(() => {
    const cc = filters.country;
    const st = filters.branch;
    let rows = allRows;
    if (cc) rows = rows.filter((r) => r.branch_country === cc);
    if (st) rows = rows.filter((r) => r.branch_state === st);
    return [...new Set(rows.map((r) => r.name))].sort((a, b) => a.localeCompare(b));
  }, [allRows, filters.country, filters.branch]);

  const summary = useMemo(() => {
    if (!catalog) return null;
    const churches = catalog.churches || [];
    const active = churches.filter((c) => Number(c.is_active) !== 0).length;
    const membersTotal = Object.values(catalog.stats?.membersBySatellite || {}).reduce(
      (n, v) => n + Number(v || 0),
      0,
    );
    return {
      countries: countryRows.length,
      states: stateRows.length,
      churches: churches.length,
      active,
      hidden: Math.max(0, churches.length - active),
      members: membersTotal,
    };
  }, [catalog, countryRows, stateRows]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.continent) n += 1;
    if (filters.country) n += 1;
    if (filters.branch) n += 1;
    if (filters.satellite) n += 1;
    if (filters.status) n += 1;
    if (filterSearch.trim()) n += 1;
    return n;
  }, [filters, filterSearch]);

  function handleExportLocations() {
    const exportByTab = {
      all: { rows: filteredAll, filename: "locations-all-branches", cols: [
        { key: "name", label: "Satellite Name" },
        { key: "stateLabel", label: "State" },
        { key: "countryLabel", label: "Country" },
        { key: "branchAdminName", label: "Branch Admin" },
        { key: "satelliteAdminName", label: "Satellite Admin" },
        { key: "members", label: "Members" },
        { key: "is_active", label: "Status", format: (v) => v ? "Active" : "Hidden" },
      ]},
      country: { rows: filteredCountries, filename: "locations-countries", cols: [
        { key: "name", label: "Country" },
        { key: "stateCount", label: "States" },
        { key: "satelliteCount", label: "Satellites" },
        { key: "branchAdminName", label: "Country Admin" },
        { key: "satelliteAdminCount", label: "Satellite Admins" },
        { key: "members", label: "Members" },
      ]},
      state: { rows: filteredStates, filename: "locations-states", cols: [
        { key: "countryLabel", label: "Country" },
        { key: "stateLabel", label: "State" },
        { key: "satelliteCount", label: "Satellites" },
        { key: "unitLeaders", label: "Unit Leaders" },
        { key: "contact", label: "Contact" },
        { key: "members", label: "Members" },
      ]},
      satellite: { rows: filteredSatellites, filename: "locations-satellites", cols: [
        { key: "name", label: "Church Name" },
        { key: "countryLabel", label: "Country" },
        { key: "stateLabel", label: "State" },
        { key: "continent", label: "Continent" },
        { key: "lga", label: "LGA" },
        { key: "pastorName", label: "Pastor Admin" },
        { key: "members", label: "Members" },
        { key: "is_active", label: "Status", format: (v) => v ? "Active" : "Hidden" },
      ]},
    };
    const cfg = exportByTab[tab] || exportByTab.all;
    if (!cfg.rows.length) { toast("No records to export.", "error"); return; }
    exportCsv(cfg.rows, {
      filename: `${cfg.filename}-${new Date().toISOString().slice(0, 10)}.csv`,
      columns: cfg.cols,
    });
    toast(`Exported ${cfg.rows.length} record${cfg.rows.length !== 1 ? "s" : ""}.`, "success");
  }

  async function publishLocationPayload(payload) {
    if (!payload.countryIso2 || !payload.stateName || !payload.lgaName) {
      toast("Country, state, and LGA are required.", "error");
      return;
    }
    if (!payload.satelliteChurches?.length) {
      toast("Enter at least one satellite church name.", "error");
      return;
    }
    setBusy(true);
    try {
      if (locationSubmitMode === "propose") {
        await api.createRequest({
          request_type: "location_catalog",
          payload: {
            continent: payload.continent,
            countryIso2: payload.countryIso2,
            countryName: payload.countryName,
            stateName: payload.stateName,
            lgaName: payload.lgaName,
            satelliteChurches: payload.satelliteChurches,
          },
        });
        toast("Proposal sent for Super / General Admin approval.", "success");
      } else {
        await api.catalogCreateLocation(payload);
        toast("Location created and published to the registration form.", "success");
      }
      setShowCreate(false);
      setAddSatellitesPreset(null);
      await load();
    } catch (e) {
      toast(e.message || "Could not save location.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function createLocation(payload) {
    await publishLocationPayload(payload);
  }

  async function toggleChurch(row, nextActive) {
    setBusy(true);
    try {
      await api.catalogSetChurchActive(row.id, nextActive);
      toast(nextActive ? "Branch reactivated." : "Branch hidden from public form.", "success");
      await load();
      if (detail?.kind === "church" && Number(detail.id) === Number(row.id)) {
        setDetail({ kind: "church", id: row.id });
      }
    } catch (e) {
      toast(e.message || "Update failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function deleteChurch(row) {
    if (!window.confirm(`Delete “${row.name}” from the directory? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await api.catalogDeleteChurch(row.id);
      toast("Location removed.", "success");
      setDetail(null);
      await load();
    } catch (e) {
      toast(e.message || "Delete failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  if (loading && !catalog) {
    return (
      <div className="sa-locations-page">
        <SmhLoader label={copy.loading.replace(/…$/, "")} className="sa-locations-loading" />
      </div>
    );
  }

  if (!catalog) {
    return (
      <div className="sa-card">
        <div className="sa-card-body">
          <p className="sa-text-muted" style={{ marginBottom: 12 }}>
            {loadError || copy.error}
          </p>
          <button type="button" className="sa-btn sa-btn-primary" onClick={() => load()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (detail && catalog) {
    return (
      <>
        <BranchLocationDetail
          detail={detail}
          catalog={catalog}
          onBack={() => setDetail(null)}
          onToggleChurch={toggleChurch}
          onDeleteChurch={deleteChurch}
          canAddSatellites={canCreateLocation}
          canManageChurches={canManageChurches}
          onAddSatellites={(preset) => setAddSatellitesPreset(preset)}
          busy={busy}
        />
        <AddSatellitesModal
          open={!!addSatellitesPreset}
          onClose={() => setAddSatellitesPreset(null)}
          onSubmit={publishLocationPayload}
          saving={busy}
          catalog={catalog}
          preset={addSatellitesPreset}
          mode={locationSubmitMode}
        />
      </>
    );
  }

  return (
    <div className="sa-locations-page">
      <header className="sa-locations-hero">
        <div className="sa-locations-hero-text">
          <h2 className="sa-locations-title">{copy.title}</h2>
          <p className="sa-locations-subtitle">{copy.subtitle}</p>
        </div>
        {isBranchDirectory ? (
          <div className="sa-locations-hero-actions">
            <DirectoryToolbarActions
              busy={busy}
              canCreateLocation={canCreateLocation}
              onRefresh={() => load()}
              onNewLocation={() => setShowCreate(true)}
              refreshLabel="Refresh table"
              createLabel={locationSubmitMode === "propose" ? "Propose location" : "Create location"}
            />
          </div>
        ) : null}
      </header>

      {summary ? (
        <div className="sa-stat-grid sa-locations-stats">
          <div className="sa-stat-card">
            <div className="sa-stat-header">
              <span className="sa-stat-label">Countries</span>
              <div className="sa-stat-icon indigo">🌍</div>
            </div>
            <div className="sa-stat-value">{summary.countries}</div>
            <div className="sa-stat-trend">In directory</div>
          </div>
          <div className="sa-stat-card">
            <div className="sa-stat-header">
              <span className="sa-stat-label">States & branches</span>
              <div className="sa-stat-icon blue">🗺</div>
            </div>
            <div className="sa-stat-value">{summary.states}</div>
            <div className="sa-stat-trend">Regional branches</div>
          </div>
          <div className="sa-stat-card">
            <div className="sa-stat-header">
              <span className="sa-stat-label">Satellite churches</span>
              <div className="sa-stat-icon green">⛪</div>
            </div>
            <div className="sa-stat-value">{summary.churches}</div>
            <div className="sa-stat-trend">
              <strong>{summary.active}</strong> active · {summary.hidden} hidden
            </div>
          </div>
          <div className="sa-stat-card">
            <div className="sa-stat-header">
              <span className="sa-stat-label">Registrations</span>
              <div className="sa-stat-icon amber">👥</div>
            </div>
            <div className="sa-stat-value">{summary.members}</div>
            <div className="sa-stat-trend">Members linked to satellites</div>
          </div>
        </div>
      ) : null}

      <div className="sa-card sa-locations-card">
        <div className="sa-card-head sa-locations-card-head">
          <div>
            <span className="sa-card-title">{copy.cardTitle}</span>
            {activeFilterCount > 0 ? (
              <span className="sa-locations-filter-badge">
                {activeFilterCount} filter{activeFilterCount !== 1 ? "s" : ""} applied
              </span>
            ) : null}
          </div>
          <div className="sa-locations-card-actions">
            {!isBranchDirectory ? (
              <DirectoryToolbarActions
                busy={busy}
                canCreateLocation={canCreateLocation}
                onRefresh={() => load()}
                onNewLocation={() => setShowCreate(true)}
                size="sm"
              />
            ) : null}
            <button type="button" className="sa-btn sa-btn-outline sa-btn-sm" onClick={handleExportLocations}>
              Export CSV
            </button>
            <button type="button" className="sa-btn sa-btn-ghost sa-btn-sm" onClick={() => setFilters(emptyFilters())}>
              Clear filters
            </button>
          </div>
        </div>

        <div className="sa-card-body">
          <div className="sa-locations-filters">
            <div className="sa-field" style={{ margin: 0 }}>
              <label className="sa-label">Continent</label>
              <select
                className="sa-field-select"
                value={filters.continent}
                onChange={(e) => setFilters((f) => ({ ...f, continent: e.target.value }))}
              >
                <option value="">All continents</option>
                {continentOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="sa-field" style={{ margin: 0 }}>
              <label className="sa-label">Country</label>
              <select
                className="sa-field-select"
                value={filters.country}
                onChange={(e) => setFilters((f) => ({ ...f, country: e.target.value, branch: "", satellite: "" }))}
              >
                <option value="">All countries</option>
                {countryOptions.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="sa-field" style={{ margin: 0 }}>
              <label className="sa-label">Branch (state)</label>
              <StateRegionSelect
                className="sa-field-select"
                stateRows={branchOptions}
                countryCode={filters.country}
                value={filters.branch}
                onChange={(code) => setFilters((f) => ({ ...f, branch: code, satellite: "" }))}
                emptyOption={filters.country ? "All branches" : "Select country first"}
                disabled={!filters.country}
              />
            </div>
            <div className="sa-field" style={{ margin: 0 }}>
              <label className="sa-label">Satellite</label>
              <select
                className="sa-field-select"
                value={filters.satellite}
                disabled={!filters.country}
                onChange={(e) => setFilters((f) => ({ ...f, satellite: e.target.value }))}
              >
                <option value="">All satellites</option>
                {satelliteFilterOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div className="sa-field" style={{ margin: 0 }}>
              <label className="sa-label">Status</label>
              <select
                className="sa-field-select"
                value={filters.status}
                onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              >
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="hidden">Hidden</option>
              </select>
            </div>
            <div className="sa-field" style={{ margin: 0 }}>
              <label className="sa-label">Search</label>
              <input
                className="sa-input"
                placeholder="Name, admin, LGA…"
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              />
            </div>
          </div>

          <div className="sa-locations-table-toolbar">
            <div className="sa-unit-tab-row sa-locations-view-tabs" style={{ marginBottom: 0, flex: 1 }}>
              {viewTabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`sa-unit-tab-btn${tab === t.id ? " is-active" : ""}`}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <span className="sa-text-muted sa-text-sm sa-locations-result-count">
              {tab === "country"
                ? `${filteredCountries.length} countries`
                : tab === "state"
                  ? `${filteredStates.length} states`
                  : tab === "satellite"
                    ? `${filteredSatellites.length} satellites`
                    : `${filteredAll.length} branches`}
            </span>
          </div>

          <div className="sa-table-wrap">
            {tab === "all" && (
              <table className="sa-table">
                <thead>
                  <tr>
                    <th>Satellite name</th>
                    <th>State</th>
                    <th>Country</th>
                    <th>Branch admin</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAll.map((r) => (
                    <tr
                      key={r.id}
                      className="sa-row-clickable"
                      onClick={() => setDetail({ kind: "church", id: r.id })}
                    >
                      <td>{r.name}</td>
                      <td>{r.stateLabel}</td>
                      <td>{r.countryLabel}</td>
                      <td className="sa-text-sm">{r.branchAdminName}</td>
                      <td>
                        <span className={`sa-badge ${r.is_active ? "active" : "inactive"}`}>
                          {r.is_active ? "Active" : "Hidden"}
                        </span>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="sa-table-actions">
                          <button
                            type="button"
                            className="sa-btn sa-btn-outline sa-btn-sm"
                            disabled={busy}
                            onClick={() => setDetail({ kind: "church", id: r.id })}
                          >
                            Manage
                          </button>
                          {canManageChurches ? (
                            <button
                              type="button"
                              className="sa-btn sa-btn-ghost sa-btn-sm"
                              disabled={busy}
                              onClick={() =>
                                toggleChurch(
                                  { id: r.id, name: r.name },
                                  r.is_active ? 0 : 1,
                                )
                              }
                            >
                              {r.is_active ? "Hide" : "Show"}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredAll.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: 24 }} className="sa-text-muted">
                        No locations match your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {tab === "country" && (
              <table className="sa-table">
                <thead>
                  <tr>
                    <th>Country</th>
                    <th>States</th>
                    <th>Branch admin</th>
                    <th>Satellite admins</th>
                    <th>Members</th>
                    <th>Manage</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCountries.map((r) => (
                    <tr
                      key={r.code}
                      className="sa-row-clickable"
                      onClick={() => setDetail({ kind: "country", code: r.code })}
                    >
                      <td>{r.name}</td>
                      <td>{r.stateCount}</td>
                      <td className="sa-text-sm">{r.branchAdminName}</td>
                      <td>{r.satelliteAdminCount}</td>
                      <td>{r.members}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="sa-btn sa-btn-outline sa-btn-sm"
                          onClick={() => setDetail({ kind: "country", code: r.code })}
                        >
                          Manage
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredCountries.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: 24 }} className="sa-text-muted">
                        No countries match your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {tab === "satellite" && (
              <table className="sa-table">
                <thead>
                  <tr>
                    <th>Satellite name</th>
                    <th>State</th>
                    <th>Country</th>
                    <th>LGA</th>
                    <th>Pastor admin</th>
                    <th>Members</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSatellites.map((r) => (
                    <tr
                      key={r.id}
                      className="sa-row-clickable"
                      onClick={() => r.churchId && setDetail({ kind: "church", id: r.churchId })}
                    >
                      <td>{r.name}</td>
                      <td>{r.stateLabel}</td>
                      <td>{r.countryLabel}</td>
                      <td className="sa-text-sm sa-text-muted">{r.lga || "—"}</td>
                      <td className="sa-text-sm">{r.pastorName}</td>
                      <td>{r.members}</td>
                      <td>
                        <span className={`sa-badge ${r.is_active ? "active" : "inactive"}`}>
                          {r.is_active ? "Active" : "Hidden"}
                        </span>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        {r.churchId ? (
                          <button
                            type="button"
                            className="sa-btn sa-btn-outline sa-btn-sm"
                            onClick={() => setDetail({ kind: "church", id: r.churchId })}
                          >
                            Manage
                          </button>
                        ) : (
                          <span className="sa-text-muted sa-text-sm">No church row</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredSatellites.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: "center", padding: 24 }} className="sa-text-muted">
                        No satellites match your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {tab === "state" && (
              <table className="sa-table">
                <thead>
                  <tr>
                    <th>State / branch</th>
                    <th>Country</th>
                    <th>Satellite churches</th>
                    <th>Unit leaders</th>
                    <th>Contact</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStates.map((r) => (
                    <tr
                      key={`${r.branch_country}-${r.branch_state}`}
                      className="sa-row-clickable"
                      onClick={() =>
                        setDetail({
                          kind: "state",
                          branch_country: r.branch_country,
                          branch_state: r.branch_state,
                        })
                      }
                    >
                      <td>{r.stateLabel}</td>
                      <td>{r.countryLabel}</td>
                      <td>{r.satelliteCount}</td>
                      <td>{r.unitLeaders}</td>
                      <td className="sa-text-sm sa-text-muted">{r.contact}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="sa-table-actions">
                          <button
                            type="button"
                            className="sa-btn sa-btn-outline sa-btn-sm"
                            onClick={() =>
                              setDetail({
                                kind: "state",
                                branch_country: r.branch_country,
                                branch_state: r.branch_state,
                              })
                            }
                          >
                            View
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredStates.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: 24 }} className="sa-text-muted">
                        No states match your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

        </div>
      </div>

      <LocationCreateModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={createLocation}
        saving={busy}
        submitLabel={locationSubmitMode === "propose" ? "Submit for approval" : "Create location"}
        introText={
          locationSubmitMode === "propose"
            ? "Select continent through LGA, then type satellite church name(s). Nothing goes live until a Super Admin or General Admin approves the request."
            : "Select continent through LGA from the geography directory, then type satellite church name(s). Locations go live on the registration form immediately."
        }
      />
    </div>
  );
}
