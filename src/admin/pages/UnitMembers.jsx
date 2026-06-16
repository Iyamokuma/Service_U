import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { useToast } from "../components/Toast.jsx";
import { useAdminAuth } from "../AdminContext.jsx";
import { isCountrySuperAdmin, isStateSuperAdmin, isGlobalAdminRole } from "../roles.js";
import { useAdminGeoFilters } from "../AdminGeoFilterContext.jsx";
import { isActingAsStateAdmin } from "../adminViewMode.js";
import { branchCountryLabel, branchStateLabel, branchStatesForCountry } from "../branchRegions.js";
import { fetchAdminChurchesCatalog } from "../churchesCatalog.js";
import { satelliteSitesForCountry } from "../satelliteSites.js";
import { exportCsv } from "../exportCsv.js";
import { SmhLoader } from "../../components/SmhLoader.jsx";
import { unitHasSubUnits } from "../../serviceUnitUtils.js";

export function UnitMembers({
  units,
  embedded = false,
  countryGeo = false,
  stateGeo = false,
  stateCode: scopedStateCode = "",
  satelliteGeo = false,
  satelliteSite: scopedSatelliteSite = "",
  unitLeaderGeo = false,
  serviceUnitId: scopedServiceUnitId = "",
  subUnitLeaderGeo = false,
  onMemberStats,
}) {
  const toast = useToast();
  const { admin, viewMode } = useAdminAuth();
  const actingAsState = isActingAsStateAdmin(admin, viewMode);
  const isCountryAdmin = isCountrySuperAdmin(admin?.role) && !actingAsState;
  const isStateAdmin = isStateSuperAdmin(admin?.role) || actingAsState;
  const isLeader = ["service_unit_leader", "sub_unit_leader"].includes(admin?.role);
  const isServiceUnitLeader = admin?.role === "service_unit_leader";
  const isSubUnitLeader = admin?.role === "sub_unit_leader";
  const isCountryGeo = Boolean(countryGeo && isCountryAdmin && embedded);
  const isStateGeo = Boolean(stateGeo && embedded && (isStateAdmin || actingAsState));
  const isSatelliteGeo = Boolean(satelliteGeo && embedded && admin?.role === "satellite_church_admin");
  const isUnitLeaderGeo = Boolean(unitLeaderGeo && embedded && isServiceUnitLeader);
  const isSubUnitLeaderGeo = Boolean(subUnitLeaderGeo && embedded && isSubUnitLeader);
  const simpleSearchGeo = isStateGeo || isCountryGeo || isSatelliteGeo || isUnitLeaderGeo || isSubUnitLeaderGeo;
  const isGlobalAdmin = isGlobalAdminRole(admin?.role);
  const geo = useAdminGeoFilters();
  const countryCode = String(admin?.branch_country || "").toUpperCase();
  const countryLabel = branchCountryLabel(countryCode) || countryCode;

  const [rows, setRows] = useState([]);
  const [pag, setPag] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [churches, setChurches] = useState([]);
  const [filters, setFilters] = useState({
    search: "",
    unit_id: "",
    sub_unit: "",
    filter_branch_state: "",
    filter_satellite: "",
  });

  const stateOptions = useMemo(() => branchStatesForCountry(countryCode), [countryCode]);

  const satelliteOptions = useMemo(
    () => satelliteSitesForCountry(churches, countryCode, filters.filter_branch_state),
    [churches, countryCode, filters.filter_branch_state],
  );

  useEffect(() => {
    if (!isCountryGeo) return;
    fetchAdminChurchesCatalog().then(setChurches).catch(() => setChurches([]));
  }, [isCountryGeo]);

  useEffect(() => {
    if (!isCountryGeo || !filters.filter_satellite) return;
    if (!satelliteOptions.includes(filters.filter_satellite)) {
      setFilters((f) => ({ ...f, filter_satellite: "" }));
    }
  }, [isCountryGeo, filters.filter_satellite, satelliteOptions]);

  const subUnitChoices = useMemo(() => {
    const u = (units?.data || []).find((x) => Number(x.id) === Number(admin?.service_unit_id));
    return (u?.sub_units || []).map((s) => s.name).filter(Boolean);
  }, [units?.data, admin?.service_unit_id]);

  const filterUnit = useMemo(
    () => (units?.data || []).find((u) => Number(u.id) === Number(filters.unit_id)),
    [units?.data, filters.unit_id],
  );
  const filterUnitHasSubUnits = unitHasSubUnits(filterUnit);
  const serviceLeaderUnitHasSubUnits = subUnitChoices.length > 0;

  const buildRequestBody = useCallback(
    (page, perPage) => {
      const body = {
        search: filters.search,
        page,
        per_page: perPage,
        viewer: admin,
        unit_id:
          isUnitLeaderGeo && scopedServiceUnitId
            ? scopedServiceUnitId
            : isLeader
              ? admin?.service_unit_id
              : filters.unit_id,
        filter_branch_state: isCountryAdmin && !isCountryGeo ? filters.filter_branch_state : "",
      };
      if (isSatelliteGeo) {
        if (scopedStateCode) body.filter_branch_state = scopedStateCode;
        if (scopedSatelliteSite) body.filter_branch = scopedSatelliteSite;
      } else if (isUnitLeaderGeo && scopedServiceUnitId) {
        body.unit_id = scopedServiceUnitId;
      } else if (isSubUnitLeaderGeo) {
        body.unit_id = admin?.service_unit_id;
        if (admin?.sub_unit_name) body.sub_unit = admin.sub_unit_name;
      } else if (isStateGeo && scopedStateCode) {
        body.filter_branch_state = scopedStateCode;
      } else if (isCountryGeo) {
        if (filters.filter_branch_state) {
          body.filter_branch_state = filters.filter_branch_state;
        }
        if (filters.filter_satellite) {
          body.filter_branch = filters.filter_satellite;
        }
      }
      if (isSubUnitLeader && admin?.sub_unit_name) {
        body.sub_unit = admin.sub_unit_name;
      } else if (isServiceUnitLeader && filters.sub_unit) {
        body.sub_unit = filters.sub_unit;
      } else if (isCountryAdmin && !isCountryGeo && filters.sub_unit) {
        body.sub_unit = filters.sub_unit;
      }
      if (isStateAdmin && filters.filter_branch_state) {
        body.filter_branch_state = filters.filter_branch_state;
      }
      if (isGlobalAdmin) {
        Object.assign(body, geo.apiParams);
      }
      return body;
    },
    [
      filters.search,
      filters.unit_id,
      filters.sub_unit,
      filters.filter_branch_state,
      filters.filter_satellite,
      admin,
      isLeader,
      isServiceUnitLeader,
      isSubUnitLeader,
      isCountryAdmin,
      isCountryGeo,
      isStateGeo,
      isSatelliteGeo,
      isUnitLeaderGeo,
      isSubUnitLeaderGeo,
      scopedStateCode,
      scopedSatelliteSite,
      scopedServiceUnitId,
      isStateAdmin,
      isGlobalAdmin,
      geo.apiParams,
    ],
  );

  const load = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const res = await api.members(buildRequestBody(page, 25));
        setRows(res.data || []);
        const pagination = res.pagination || { page: 1, pages: 1, total: 0 };
        setPag(pagination);
        if (simpleSearchGeo) {
          onMemberStats?.({ total: pagination.total ?? 0 });
        }
      } catch (e) {
        toast(e.message, "error");
      } finally {
        setLoading(false);
      }
    },
    [buildRequestBody, simpleSearchGeo, onMemberStats, toast],
  );

  useEffect(() => {
    load(1);
  }, [load]);

  const unitName = (units?.data || []).find((u) => Number(u.id) === Number(admin?.service_unit_id))?.name;
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const res = await api.members(buildRequestBody(1, 10000));
      const all = res.data || [];
      if (!all.length) {
        toast("No records to export.", "error");
        return;
      }
      exportCsv(all, {
        filename: `unit-members-${new Date().toISOString().slice(0, 10)}.csv`,
        columns: [
          { key: "id", label: "Ref" },
          { key: "first_name", label: "First Name" },
          { key: "surname", label: "Surname" },
          { key: "phone1", label: "Phone" },
          { key: "email", label: "Email" },
          { key: "unit_name", label: "Service Unit" },
          { key: "sub_unit", label: "Sub-unit" },
          { key: "branch_country", label: "Country" },
          { key: "branch_state", label: "State" },
          { key: "satellite_site", label: "Church" },
          { key: "status", label: "Status" },
          {
            key: "submitted_at",
            label: "Submitted",
            format: (v) => (v ? new Date(v).toLocaleDateString() : ""),
          },
        ],
      });
      toast(`Exported ${all.length} member${all.length !== 1 ? "s" : ""}.`, "success");
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setExporting(false);
    }
  }

  const searchOnlyFilterBar = (
    <div className="sa-admins-filters" role="toolbar" aria-label="Filter unit members">
      <div className="sa-search">
        <span className="sa-search-icon" aria-hidden>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </span>
        <input
          type="search"
          placeholder="Search name, email, phone…"
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
        />
      </div>
      <button
        type="button"
        className="sa-btn sa-btn-outline sa-btn-sm"
        disabled={exporting || loading || pag.total === 0}
        onClick={handleExport}
      >
        {exporting ? "Exporting…" : "Export CSV"}
      </button>
    </div>
  );

  const filterBar = isCountryGeo ? (
    <div className="sa-admins-filters" role="toolbar" aria-label="Filter unit members">
      <select className="sa-select" value={countryCode} disabled aria-label="Country">
        <option value={countryCode}>{countryLabel}</option>
      </select>
      <select
        className="sa-select"
        value={filters.filter_branch_state}
        onChange={(e) =>
          setFilters((f) => ({
            ...f,
            filter_branch_state: e.target.value,
            filter_satellite: "",
          }))
        }
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
        value={filters.filter_satellite}
        onChange={(e) => setFilters((f) => ({ ...f, filter_satellite: e.target.value }))}
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
      <div className="sa-search">
        <span className="sa-search-icon" aria-hidden>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </span>
        <input
          type="search"
          placeholder="Search name, email, phone…"
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
        />
      </div>
      <button
        type="button"
        className="sa-btn sa-btn-outline sa-btn-sm"
        disabled={exporting || loading || pag.total === 0}
        onClick={handleExport}
      >
        {exporting ? "Exporting…" : "Export CSV"}
      </button>
    </div>
  ) : simpleSearchGeo ? (
    searchOnlyFilterBar
  ) : (
    <div className="sa-filters">
      <input
        className="sa-input"
        placeholder="Search member name/email/phone"
        value={filters.search}
        onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
      />
      {isCountryAdmin && (
        <select
          className="sa-select"
          value={filters.filter_branch_state}
          onChange={(e) => setFilters((f) => ({ ...f, filter_branch_state: e.target.value }))}
        >
          <option value="">All states / regions</option>
          {branchStatesForCountry(admin?.branch_country).map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </select>
      )}
      {!isLeader && (
        <select
          className="sa-select"
          value={filters.unit_id}
          onChange={(e) => setFilters((f) => ({ ...f, unit_id: e.target.value, sub_unit: "" }))}
        >
          <option value="">All Units</option>
          {(units?.data || []).map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      )}
      {(isCountryAdmin || isServiceUnitLeader) && filters.unit_id && filterUnitHasSubUnits && (
        <select
          className="sa-select"
          value={filters.sub_unit}
          onChange={(e) => setFilters((f) => ({ ...f, sub_unit: e.target.value }))}
        >
          <option value="">All sub-units</option>
          {((units?.data || []).find((u) => Number(u.id) === Number(filters.unit_id))?.sub_units || []).map(
            (s) => (
              <option key={s.id} value={s.name}>
                {s.name}
              </option>
            ),
          )}
        </select>
      )}
      {isServiceUnitLeader && serviceLeaderUnitHasSubUnits && (
        <select
          className="sa-select"
          value={filters.sub_unit}
          onChange={(e) => setFilters((f) => ({ ...f, sub_unit: e.target.value }))}
        >
          <option value="">All sub-units</option>
          {subUnitChoices.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      )}
      <button
        type="button"
        className="sa-btn sa-btn-outline sa-btn-sm"
        disabled={exporting || loading || rows.length === 0}
        onClick={handleExport}
        style={{ marginLeft: "auto" }}
      >
        {exporting ? "Exporting…" : "Export CSV"}
      </button>
    </div>
  );

  return (
    <>
      {!embedded && isSubUnitLeader && (
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 6px" }}>Members list</h2>
          <p className="sa-text-muted sa-text-sm" style={{ margin: 0 }}>
            Approved members in <strong>{admin?.sub_unit_name || "your sub-unit"}</strong>
            {unitName ? ` · ${unitName}` : ""}.
          </p>
        </div>
      )}
      <div className="sa-card">
        {filterBar}

        {simpleSearchGeo ? (
          <p className="sa-text-sm sa-text-muted" style={{ margin: "0 0 12px", padding: "0 4px" }}>
            Sorted A–Z · {pag.total} approved member{pag.total !== 1 ? "s" : ""}
            {pag.pages > 1 ? ` · page ${pag.page} of ${pag.pages}` : ""}
          </p>
        ) : null}

        <div className="sa-table-wrap">
          {loading ? (
            <SmhLoader label="Loading members" />
          ) : (
            <table className="sa-table">
              <thead>
                <tr>
                  <th>Ref</th>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Unit</th>
                  <th>Sub-unit</th>
                  {simpleSearchGeo ? <th>Location</th> : null}
                  <th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td>
                      {r.first_name} {r.surname}
                    </td>
                    <td>{r.phone1}</td>
                    <td>{r.email || "—"}</td>
                    <td>{r.unit_name}</td>
                    <td>{r.sub_unit || "—"}</td>
                    {simpleSearchGeo ? (
                      <td className="sa-text-sm">
                        {[r.satellite_site, branchStateLabel(countryCode, r.branch_state)]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </td>
                    ) : null}
                    <td>{new Date(r.submitted_at).toLocaleString()}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={simpleSearchGeo ? 8 : 7} className="sa-empty-text" style={{ textAlign: "center", padding: "20px" }}>
                      No approved members found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
        {pag.pages > 1 && (
          <div className="sa-pagination">
            <span>
              Page {pag.page} of {pag.pages} ({pag.total} members)
            </span>
            <div className="sa-pag-btns">
              <button className="sa-pag-btn" disabled={pag.page <= 1} onClick={() => load(pag.page - 1)}>
                ‹
              </button>
              <button className="sa-pag-btn" disabled={pag.page >= pag.pages} onClick={() => load(pag.page + 1)}>
                ›
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
