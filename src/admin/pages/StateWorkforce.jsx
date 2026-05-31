import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { useAdminAuth } from "../AdminContext.jsx";
import { branchCountryLabel, branchStateLabel } from "../branchRegions.js";
import { fetchChurchesCatalog } from "../../lib/churchesCatalog.js";
import { satelliteSitesForBranch } from "../satelliteSites.js";
import {
  availableSatellitesForState,
  occupiedSatelliteSites,
  satellitePastorForSite,
} from "../stateSatelliteForm.js";
import { exportCsv } from "../exportCsv.js";

export function StateWorkforce({ admins: adminsPayload, reload, setPage }) {
  const { admin: me } = useAdminAuth();
  const countryCode = String(me?.branch_country || "").toUpperCase();
  const stateCode = String(me?.branch_state || "").toUpperCase();
  const countryLabel = branchCountryLabel(countryCode);
  const stateLabel = branchStateLabel(countryCode, stateCode) || stateCode;

  const [search, setSearch] = useState("");
  const [coverageFilter, setCoverageFilter] = useState("all");
  const [pendingRequests, setPendingRequests] = useState([]);
  const [churches, setChurches] = useState([]);

  const allAdmins = adminsPayload?.data ?? [];

  const stateAdmins = useMemo(
    () =>
      allAdmins.filter(
        (a) =>
          String(a.branch_country || "").toUpperCase() === countryCode &&
          String(a.branch_state || "").toUpperCase() === stateCode,
      ),
    [allAdmins, countryCode, stateCode],
  );

  const loadPending = useCallback(() => {
    api
      .requests({ per_page: 200, page: 1 })
      .then((res) => {
        setPendingRequests(
          (res.data || []).filter(
            (r) =>
              r.request_type === "admin_account" &&
              (r.status === "open" || r.status === "in_review"),
          ),
        );
      })
      .catch(() => setPendingRequests([]));
  }, []);

  useEffect(() => {
    loadPending();
  }, [loadPending, adminsPayload]);

  useEffect(() => {
    fetchChurchesCatalog().then(setChurches).catch(() => setChurches([]));
  }, []);

  const satellitesInDataset = useMemo(
    () => satelliteSitesForBranch(churches, countryCode, stateCode),
    [churches, countryCode, stateCode],
  );

  const vacantSatellites = useMemo(
    () => availableSatellitesForState(churches, countryCode, stateCode, stateAdmins, pendingRequests),
    [churches, countryCode, stateCode, stateAdmins, pendingRequests],
  );

  const takenSites = useMemo(
    () => occupiedSatelliteSites(stateAdmins, pendingRequests, countryCode, stateCode),
    [stateAdmins, pendingRequests, countryCode, stateCode],
  );

  const satelliteRows = useMemo(() => {
    return satellitesInDataset.map((name) => {
      const pastor = satellitePastorForSite(stateAdmins, countryCode, stateCode, name);
      const vacant = !pastor;
      return {
        name,
        pastor,
        vacant,
        pastorName: pastor?.full_name || "—",
        pastorUsername: pastor?.username || "",
        status: vacant ? "Vacant" : "Covered",
      };
    });
  }, [satellitesInDataset, stateAdmins, countryCode, stateCode]);

  const stats = useMemo(
    () => ({
      satellitesTotal: satellitesInDataset.length,
      satellitesCovered: satelliteRows.filter((r) => !r.vacant).length,
      satellitesVacant: vacantSatellites.length,
    }),
    [satellitesInDataset.length, satelliteRows, vacantSatellites.length],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return satelliteRows.filter((r) => {
      if (coverageFilter === "vacant" && !r.vacant) return false;
      if (coverageFilter === "covered" && r.vacant) return false;
      if (!q) return true;
      const hay = [r.name, r.pastorName, r.pastorUsername, r.status].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [satelliteRows, search, coverageFilter]);

  function handleExport() {
    if (!filtered.length) return;
    exportCsv(filtered, {
      filename: `satellite-coverage-${stateCode}-${new Date().toISOString().slice(0, 10)}.csv`,
      columns: [
        { key: "name", label: "Satellite church" },
        { key: "pastorName", label: "Pastor admin" },
        { key: "pastorUsername", label: "Username" },
        { key: "status", label: "Status" },
      ],
    });
  }

  return (
    <>
      <header className="sa-admins-hero" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="sa-admins-title">Workforce</h1>
          <p className="sa-admins-subtitle">
            Satellite pastor coverage for {stateLabel}
            {countryLabel ? `, ${countryLabel}` : ""}. Each satellite church needs one Satellite Pastor Admin.
            Create and manage accounts on the Users tab.
          </p>
        </div>
        <div className="sa-admins-hero-actions">
          <button type="button" className="sa-btn sa-btn-outline" onClick={handleExport} disabled={!filtered.length}>
            Export CSV
          </button>
          <button type="button" className="sa-btn sa-btn-primary" onClick={() => setPage?.("users")}>
            Manage users
          </button>
        </div>
      </header>

      <div className="sa-stat-grid" style={{ marginBottom: 20 }}>
        <div className="sa-stat-card">
          <div className="sa-stat-header">
            <span className="sa-stat-label">Satellites in state</span>
          </div>
          <div className="sa-stat-value">{stats.satellitesTotal}</div>
        </div>
        <div className="sa-stat-card">
          <div className="sa-stat-header">
            <span className="sa-stat-label">Satellites covered</span>
          </div>
          <div className="sa-stat-value">{stats.satellitesCovered}</div>
          <div className="sa-stat-trend">With an assigned pastor admin</div>
        </div>
        <div className="sa-stat-card">
          <div className="sa-stat-header">
            <span className="sa-stat-label">Vacant satellites</span>
          </div>
          <div className="sa-stat-value">{stats.satellitesVacant}</div>
          <div className="sa-stat-trend">
            {stats.satellitesVacant > 0 ? "Appoint pastors on Users" : "All satellites covered"}
          </div>
        </div>
      </div>

      <div className="sa-card">
        <div className="sa-card-head sa-admins-card-head">
          <div>
            <div className="sa-card-title">Satellite leadership overview</div>
            <p className="sa-admins-card-meta sa-text-muted sa-text-sm" style={{ margin: "4px 0 0" }}>
              Read-only view locked to your state. Create or edit Satellite Pastor Admins under Users.
            </p>
          </div>
        </div>
        <div className="sa-admins-filters" role="toolbar" aria-label="Filter satellite coverage">
          <div className="sa-search">
            <span className="sa-search-icon" aria-hidden>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              type="search"
              placeholder="Search satellite or pastor…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className="sa-select" value={coverageFilter} onChange={(e) => setCoverageFilter(e.target.value)}>
            <option value="all">All satellites</option>
            <option value="covered">Covered only</option>
            <option value="vacant">Vacant only</option>
          </select>
          <span className="sa-admins-filter-count">
            {filtered.length} satellite{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="sa-table-wrap">
          {satellitesInDataset.length === 0 ? (
            <div className="sa-empty">
              <div className="sa-empty-text">
                No satellite churches are configured for {stateLabel}. Add locations under the branch directory.
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="sa-empty">
              <div className="sa-empty-text">No satellites match your filters.</div>
            </div>
          ) : (
            <table className="sa-table">
              <thead>
                <tr>
                  <th>Satellite church</th>
                  <th>Pastor admin</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.name}>
                    <td>
                      <div className="sa-fw-600">{r.name}</div>
                    </td>
                    <td>
                      <div className={r.vacant ? "sa-text-muted" : "sa-fw-600"}>{r.pastorName}</div>
                      {!r.vacant && r.pastorUsername && (
                        <div className="sa-text-sm sa-text-muted">{r.pastorUsername}</div>
                      )}
                    </td>
                    <td>
                      <span className={`sa-badge ${r.vacant ? "in_review" : "active"}`}>{r.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {takenSites.size > 0 && vacantSatellites.length === 0 && satellitesInDataset.length > 0 && (
          <p className="sa-text-sm sa-text-muted" style={{ padding: "12px 16px 16px", margin: 0 }}>
            All {satellitesInDataset.length} satellite{satellitesInDataset.length !== 1 ? "s" : ""} in this state have
            pastor admins assigned.
          </p>
        )}
      </div>
    </>
  );
}
