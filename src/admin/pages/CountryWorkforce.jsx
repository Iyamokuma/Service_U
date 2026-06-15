import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { SmhLoader } from "../../components/SmhLoader.jsx";
import { useAdminAuth } from "../AdminContext.jsx";
import { useToast } from "../components/Toast.jsx";
import { branchCountryLabel, branchStateLabel, branchStatesForCountry } from "../branchRegions.js";
import { AdminLoginMeta } from "../components/AdminLoginMeta.jsx";
import { isAdminActive } from "../components/adminRowMenuItems.js";
import { fetchChurchesCatalog } from "../../lib/churchesCatalog.js";
import { satelliteSitesForCountry } from "../satelliteSites.js";
import { exportCsv } from "../exportCsv.js";

const WORKFORCE_PAGE_SIZE = 25;

function leaderLocationLabel(admin, countryCode) {
  const st = branchStateLabel(countryCode, admin.branch_state);
  const sat = String(admin.satellite_site || "").trim();
  if (sat && st) return `${sat} · ${st}`;
  if (sat) return sat;
  return st || "—";
}

function leaderRoleLabel(role) {
  if (role === "service_unit_leader") return "Service unit leader";
  if (role === "sub_unit_leader") return "Sub-unit leader";
  return String(role || "—");
}

function compareLeadersAlphabetical(a, b) {
  return String(a.full_name || "").localeCompare(String(b.full_name || ""), undefined, {
    sensitivity: "base",
  });
}

function buildUnitNameMap(units) {
  const map = new Map();
  for (const u of units || []) {
    map.set(Number(u.id), String(u.name || ""));
  }
  return map;
}

export function CountryWorkforce({ admins: adminsPayload, embedded = false, onStats }) {
  const toast = useToast();
  const { admin: me } = useAdminAuth();
  const countryCode = String(me?.branch_country || "").toUpperCase();
  const countryLabel = branchCountryLabel(countryCode);

  const [unitNameById, setUnitNameById] = useState(() => new Map());
  const [unitsLoading, setUnitsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [roleFilter, setRoleFilter] = useState("all");
  const [filterState, setFilterState] = useState("");
  const [filterSatellite, setFilterSatellite] = useState("");
  const [workforcePage, setWorkforcePage] = useState(1);
  const [churches, setChurches] = useState([]);

  const loadUnits = useCallback(() => {
    setUnitsLoading(true);
    api
      .units()
      .then((r) => setUnitNameById(buildUnitNameMap(r.data)))
      .catch(() => setUnitNameById(new Map()))
      .finally(() => setUnitsLoading(false));
  }, []);

  useEffect(() => {
    loadUnits();
  }, [loadUnits]);

  useEffect(() => {
    fetchChurchesCatalog().then(setChurches).catch(() => setChurches([]));
  }, []);

  const stateOptions = useMemo(() => branchStatesForCountry(countryCode), [countryCode]);

  const satelliteOptions = useMemo(
    () => satelliteSitesForCountry(churches, countryCode, filterState),
    [churches, countryCode, filterState],
  );

  useEffect(() => {
    setWorkforcePage(1);
  }, [search, showInactive, roleFilter, filterState, filterSatellite]);

  useEffect(() => {
    if (!filterSatellite) return;
    if (!satelliteOptions.includes(filterSatellite)) {
      setFilterSatellite("");
    }
  }, [filterSatellite, satelliteOptions]);

  const leaderRows = useMemo(() => {
    return (adminsPayload?.data ?? [])
      .filter(
        (a) =>
          String(a.branch_country || "").toUpperCase() === countryCode &&
          ["service_unit_leader", "sub_unit_leader"].includes(a.role),
      )
      .map((a) => {
        const unitId = Number(a.service_unit_id);
        const unitName = unitNameById.get(unitId) || (unitId ? `Unit #${unitId}` : "—");
        const subUnit = a.role === "sub_unit_leader" ? String(a.sub_unit_name || "").trim() || "—" : "—";
        return {
          ...a,
          unitName,
          subUnit,
          location: leaderLocationLabel(a, countryCode),
          roleLabel: leaderRoleLabel(a.role),
        };
      })
      .sort(compareLeadersAlphabetical);
  }, [adminsPayload, countryCode, unitNameById]);

  const unitLeaderRows = useMemo(
    () => leaderRows.filter((r) => r.role === "service_unit_leader"),
    [leaderRows],
  );
  const subLeaderRows = useMemo(
    () => leaderRows.filter((r) => r.role === "sub_unit_leader"),
    [leaderRows],
  );
  const workforceTotal = unitLeaderRows.length + subLeaderRows.length;

  useEffect(() => {
    onStats?.({
      total: workforceTotal,
      unitLeaders: unitLeaderRows.length,
      subLeaders: subLeaderRows.length,
    });
  }, [onStats, workforceTotal, unitLeaderRows.length, subLeaderRows.length]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leaderRows.filter((r) => {
      if (!showInactive && !isAdminActive(r)) return false;
      if (roleFilter === "service_unit_leader" && r.role !== "service_unit_leader") return false;
      if (roleFilter === "sub_unit_leader" && r.role !== "sub_unit_leader") return false;
      if (filterState && String(r.branch_state || "").toUpperCase() !== filterState) return false;
      if (filterSatellite && String(r.satellite_site || "").trim() !== filterSatellite) return false;
      if (!q) return true;
      const hay = [r.full_name, r.username, r.email, r.unitName, r.subUnit, r.location, r.roleLabel]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [leaderRows, search, showInactive, roleFilter, filterState, filterSatellite]);

  const pagination = useMemo(() => {
    const total = filtered.length;
    const pages = Math.max(1, Math.ceil(total / WORKFORCE_PAGE_SIZE));
    const page = Math.min(workforcePage, pages);
    const start = (page - 1) * WORKFORCE_PAGE_SIZE;
    return {
      page,
      pages,
      total,
      rows: filtered.slice(start, start + WORKFORCE_PAGE_SIZE),
    };
  }, [filtered, workforcePage]);

  function handleExport() {
    if (!filtered.length) {
      toast("No records to export.", "error");
      return;
    }
    exportCsv(filtered, {
      filename: `workforce-${countryCode}-${new Date().toISOString().slice(0, 10)}.csv`,
      columns: [
        { key: "full_name", label: "Name" },
        { key: "role", label: "Role", format: (v, row) => leaderRoleLabel(row.role) },
        { key: "unitName", label: "Service unit" },
        { key: "subUnit", label: "Sub-unit" },
        { key: "location", label: "Location" },
        { key: "is_active", label: "Status", format: (v) => (Number(v) === 1 ? "Active" : "Inactive") },
      ],
    });
    toast(`Exported ${filtered.length} record${filtered.length !== 1 ? "s" : ""}.`, "success");
  }

  const toolbar = embedded ? (
    <div className="sa-admins-panel-toolbar" style={{ marginBottom: 0 }}>
      <button
        type="button"
        className="sa-btn sa-btn-outline sa-btn-sm"
        onClick={handleExport}
        disabled={!filtered.length}
        style={{ marginLeft: "auto" }}
      >
        Export CSV
      </button>
    </div>
  ) : null;

  return (
    <div className="sa-card">
      {toolbar}

      <div className="sa-admins-filters" role="toolbar" aria-label="Filter workforce">
        <select className="sa-select" value={countryCode} disabled aria-label="Country">
          <option value={countryCode}>{countryLabel || countryCode}</option>
        </select>
        <select
          className="sa-select"
          value={filterState}
          onChange={(e) => {
            setFilterState(e.target.value);
            setFilterSatellite("");
          }}
          aria-label="State / region"
        >
          <option value="">All states / regions</option>
          {stateOptions.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          className="sa-select"
          value={filterSatellite}
          onChange={(e) => setFilterSatellite(e.target.value)}
          disabled={satelliteOptions.length === 0}
          aria-label="Satellite church"
        >
          <option value="">All satellite churches</option>
          {satelliteOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <select
          className="sa-select"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          aria-label="Role"
        >
          <option value="all">All</option>
          <option value="service_unit_leader">Service unit leader</option>
          <option value="sub_unit_leader">Sub-unit leader</option>
        </select>
        <div className="sa-search">
          <span className="sa-search-icon" aria-hidden>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
          <input
            type="search"
            placeholder="Search name, unit, location…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <label className="sa-field-toggle">
          <span className="sa-field-toggle-label">Show inactive</span>
          <span className="sa-switch">
            <input
              type="checkbox"
              role="switch"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            <span className="sa-switch-ui" aria-hidden />
          </span>
        </label>
      </div>

      <p className="sa-text-sm sa-text-muted" style={{ margin: "0 0 12px", padding: "0 4px" }}>
        Sorted A–Z · showing {pagination.total} of {workforceTotal} leader{workforceTotal !== 1 ? "s" : ""}
        {pagination.pages > 1 ? ` · page ${pagination.page} of ${pagination.pages}` : ""}
      </p>

      <div className="sa-table-wrap">
        {unitsLoading ? (
          <SmhLoader label="Loading workforce" />
        ) : pagination.rows.length === 0 ? (
          <div className="sa-empty">
            <div className="sa-empty-text">
              {leaderRows.length === 0
                ? `No service unit or sub-unit leaders in ${countryLabel || "this country"} yet.`
                : "No leaders match your filters."}
            </div>
          </div>
        ) : (
          <table className="sa-table sa-table-admins-simple">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Service unit</th>
                <th>Sub-unit</th>
                <th>Location</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {pagination.rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="sa-fw-600">{r.full_name}</div>
                    <AdminLoginMeta username={r.username} email={r.email} />
                  </td>
                  <td className="sa-text-sm">{r.roleLabel}</td>
                  <td className="sa-text-sm">{r.unitName}</td>
                  <td className="sa-text-sm">{r.subUnit}</td>
                  <td className="sa-text-sm">{r.location}</td>
                  <td>
                    <span className={`sa-badge ${isAdminActive(r) ? "active" : "inactive"}`}>
                      {isAdminActive(r) ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pagination.pages > 1 ? (
        <div className="sa-pagination">
          <span>
            Page {pagination.page} of {pagination.pages} ({pagination.total} leaders)
          </span>
          <div className="sa-pag-btns">
            <button
              type="button"
              className="sa-pag-btn"
              disabled={pagination.page <= 1}
              onClick={() => setWorkforcePage((p) => Math.max(1, p - 1))}
            >
              ‹
            </button>
            <button
              type="button"
              className="sa-pag-btn"
              disabled={pagination.page >= pagination.pages}
              onClick={() => setWorkforcePage((p) => Math.min(pagination.pages, p + 1))}
            >
              ›
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
