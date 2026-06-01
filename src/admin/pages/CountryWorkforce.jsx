import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { useAdminAuth } from "../AdminContext.jsx";
import {
  branchCountryLabel,
  branchStateLabel,
  branchStatesForCountry,
} from "../branchRegions.js";
import {
  availableStatesForCountryAdmin,
  occupiedStateCodes,
  stateLeaderForCode,
  stateLeaderLabel,
} from "../stateAdminForm.js";
import { exportCsv } from "../exportCsv.js";

export function CountryWorkforce({ admins: adminsPayload, reload, setPage, embedded = false, onAssignVacant }) {
  const { admin: me } = useAdminAuth();
  const countryCode = String(me?.branch_country || "").toUpperCase();
  const countryLabel = branchCountryLabel(countryCode);

  const [search, setSearch] = useState("");
  const [coverageFilter, setCoverageFilter] = useState("all");
  const [pendingRequests, setPendingRequests] = useState([]);

  const allAdmins = adminsPayload?.data ?? [];

  const countryAdmins = useMemo(
    () => allAdmins.filter((a) => String(a.branch_country || "").toUpperCase() === countryCode),
    [allAdmins, countryCode],
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

  const statesInDataset = useMemo(() => branchStatesForCountry(countryCode), [countryCode]);

  const takenStates = useMemo(
    () => occupiedStateCodes(countryAdmins, pendingRequests, countryCode),
    [countryAdmins, pendingRequests, countryCode],
  );

  const vacantStates = useMemo(
    () => availableStatesForCountryAdmin(countryCode, countryAdmins, pendingRequests),
    [countryCode, countryAdmins, pendingRequests],
  );

  const stateRows = useMemo(() => {
    return statesInDataset.map((s) => {
      const leader = stateLeaderForCode(countryAdmins, countryCode, s.code);
      const vacant = !leader;
      return {
        code: s.code,
        name: s.name,
        leader,
        vacant,
        leaderName: leader?.admin?.full_name || "—",
        leaderType: leader ? stateLeaderLabel(leader) : "—",
        status: vacant ? "Vacant" : "Covered",
        isYou: leader?.kind === "country_hq" && Number(leader.admin.id) === Number(me?.id),
      };
    });
  }, [statesInDataset, countryAdmins, countryCode, me?.id]);

  const stats = useMemo(
    () => ({
      statesTotal: statesInDataset.length,
      statesCovered: stateRows.filter((r) => !r.vacant).length,
      statesVacant: vacantStates.length,
    }),
    [statesInDataset.length, stateRows, vacantStates.length],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return stateRows.filter((r) => {
      if (coverageFilter === "vacant" && !r.vacant) return false;
      if (coverageFilter === "covered" && r.vacant) return false;
      if (!q) return true;
      const hay = [r.name, r.code, r.leaderName, r.leaderType, r.status].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [stateRows, search, coverageFilter]);

  function handleExport() {
    if (!filtered.length) return;
    exportCsv(filtered, {
      filename: `state-coverage-${countryCode}-${new Date().toISOString().slice(0, 10)}.csv`,
      columns: [
        { key: "name", label: "State" },
        { key: "code", label: "Code" },
        { key: "leaderName", label: "Leader" },
        { key: "leaderType", label: "Leadership type" },
        { key: "status", label: "Status" },
      ],
    });
  }

  return (
    <>
      {!embedded ? (
        <header className="sa-admins-hero" style={{ marginBottom: 20 }}>
          <div>
            <h1 className="sa-admins-title">Workforce</h1>
            <p className="sa-admins-subtitle">
              State-level leadership coverage across {countryLabel || "your country"}. Each state needs one leader —
              either a State Branch Admin you appoint, or your own headquarters state if you serve in both roles.
            </p>
          </div>
          <div className="sa-admins-hero-actions">
            <button type="button" className="sa-btn sa-btn-outline" onClick={handleExport} disabled={!filtered.length}>
              Export CSV
            </button>
          </div>
        </header>
      ) : (
        <div className="sa-admins-panel-toolbar" style={{ marginBottom: 12 }}>
          <p className="sa-users-meta" style={{ margin: 0, flex: 1 }}>
            {stats.statesTotal} states · {stats.statesCovered} covered · {stats.statesVacant} vacant
          </p>
          <button type="button" className="sa-btn sa-btn-outline sa-btn-sm" onClick={handleExport} disabled={!filtered.length}>
            Export CSV
          </button>
        </div>
      )}

      {!embedded ? (
        <div className="sa-stat-grid" style={{ marginBottom: 20 }}>
          <div className="sa-stat-card">
            <div className="sa-stat-header">
              <span className="sa-stat-label">States in country</span>
            </div>
            <div className="sa-stat-value">{stats.statesTotal}</div>
          </div>
          <div className="sa-stat-card">
            <div className="sa-stat-header">
              <span className="sa-stat-label">States covered</span>
            </div>
            <div className="sa-stat-value">{stats.statesCovered}</div>
            <div className="sa-stat-trend">With an assigned leader</div>
          </div>
          <div className="sa-stat-card">
            <div className="sa-stat-header">
              <span className="sa-stat-label">Vacant states</span>
            </div>
            <div className="sa-stat-value">{stats.statesVacant}</div>
            <div className="sa-stat-trend">
              {stats.statesVacant > 0 ? "Appoint leaders on Users" : "All states covered"}
            </div>
          </div>
        </div>
      ) : null}

      <div className="sa-card">
        <div className="sa-card-head sa-admins-card-head">
          <div>
            <div className="sa-card-title">State leadership overview</div>
            <p className="sa-admins-card-meta sa-text-muted sa-text-sm" style={{ margin: "4px 0 0" }}>
              Read-only view of who leads each state. Create or edit State Branch Admins under Users.
            </p>
          </div>
        </div>
        <div className="sa-admins-filters" role="toolbar" aria-label="Filter state coverage">
          <div className="sa-search">
            <span className="sa-search-icon" aria-hidden>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              type="search"
              placeholder="Search state or leader…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className="sa-select" value={coverageFilter} onChange={(e) => setCoverageFilter(e.target.value)}>
            <option value="all">All states</option>
            <option value="covered">Covered only</option>
            <option value="vacant">Vacant only</option>
          </select>
          <span className="sa-admins-filter-count">
            {filtered.length} state{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="sa-table-wrap">
          {statesInDataset.length === 0 ? (
            <div className="sa-empty">
              <div className="sa-empty-text">
                No states are configured for {countryLabel || countryCode}. Extend the branch directory under Locations.
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="sa-empty">
              <div className="sa-empty-text">No states match your filters.</div>
            </div>
          ) : (
            <table className="sa-table">
              <thead>
                <tr>
                  <th>State</th>
                  <th>Leader</th>
                  <th>Leadership type</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.code}>
                    <td>
                      <div className="sa-fw-600">{r.name}</div>
                      <div className="sa-text-sm sa-text-muted">{branchStateLabel(countryCode, r.code) || r.code}</div>
                    </td>
                    <td>
                      {r.isYou ? (
                        <>
                          <div className="sa-fw-600">{r.leaderName} (you)</div>
                          <div className="sa-text-sm sa-text-muted">Country &amp; State headquarters</div>
                        </>
                      ) : (
                        <div className={r.vacant ? "sa-text-muted" : "sa-fw-600"}>{r.leaderName}</div>
                      )}
                    </td>
                    <td className="sa-text-sm sa-text-muted">{r.leaderType}</td>
                    <td>
                      <span className={`sa-badge ${r.vacant ? "in_review" : "active"}`}>{r.status}</span>
                      {r.vacant && onAssignVacant ? (
                        <button
                          type="button"
                          className="sa-btn sa-btn-outline sa-btn-sm"
                          style={{ marginLeft: 8 }}
                          onClick={() => onAssignVacant(r.code)}
                        >
                          Assign
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
