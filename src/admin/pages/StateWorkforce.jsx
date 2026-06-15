import { useEffect, useMemo, useState } from "react";
import { useAdminAuth } from "../AdminContext.jsx";
import { AdminLoginMeta } from "../components/AdminLoginMeta.jsx";
import { AdminRowActionsMenu, AdminRowActionsTrigger } from "../components/AdminRowActionsMenu.jsx";
import { isAdminActive } from "../components/adminRowMenuItems.js";
import { branchCountryLabel, branchStateLabel } from "../branchRegions.js";
import { countryAdminHomeState, isCountrySuperAdmin } from "../roles.js";
import { isActingAsStateAdmin } from "../adminViewMode.js";

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

export function StateWorkforce({
  admins: adminsPayload,
  units: unitsPayload,
  embedded = false,
  actionMenu,
  onOpenActions,
  onCloseActionMenu,
  menuItems,
  onStats,
}) {
  const { admin: me, viewMode } = useAdminAuth();
  const countryCode = String(me?.branch_country || "").toUpperCase();
  const actingAsState = isActingAsStateAdmin(me, viewMode);
  const stateCode = String(
    isCountrySuperAdmin(me?.role) && actingAsState
      ? countryAdminHomeState(me) || me?.branch_state
      : me?.branch_state || "",
  ).toUpperCase();
  const stateLabel = branchStateLabel(countryCode, stateCode) || stateCode;
  const countryLabel = branchCountryLabel(countryCode);

  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [roleFilter, setRoleFilter] = useState("all");
  const [workforcePage, setWorkforcePage] = useState(1);

  const unitNameById = useMemo(() => buildUnitNameMap(unitsPayload?.data), [unitsPayload?.data]);

  const leaderRows = useMemo(() => {
    return (adminsPayload?.data ?? [])
      .filter(
        (a) =>
          String(a.branch_country || "").toUpperCase() === countryCode &&
          String(a.branch_state || "").toUpperCase() === stateCode &&
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
  }, [adminsPayload, countryCode, stateCode, unitNameById]);

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

  useEffect(() => {
    setWorkforcePage(1);
  }, [search, showInactive, roleFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leaderRows.filter((r) => {
      if (!showInactive && !isAdminActive(r)) return false;
      if (roleFilter === "service_unit_leader" && r.role !== "service_unit_leader") return false;
      if (roleFilter === "sub_unit_leader" && r.role !== "sub_unit_leader") return false;
      if (!q) return true;
      const hay = [r.full_name, r.username, r.email, r.unitName, r.subUnit, r.location, r.roleLabel]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [leaderRows, search, showInactive, roleFilter]);

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

  if (!stateCode) {
    return (
      <div className="sa-card">
        <div className="sa-empty">
          <div className="sa-empty-text">
            Set your headquarters state (Profile / Settings) before managing state workforce.
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {!embedded ? (
        <header className="sa-admins-hero" style={{ marginBottom: 20 }}>
          <div>
            <h1 className="sa-admins-title">Workforce</h1>
            <p className="sa-admins-subtitle">
              Leaders in {stateLabel}, {countryLabel}.
            </p>
          </div>
        </header>
      ) : null}

      <div className="sa-card">
        <div className="sa-admins-filters" role="toolbar" aria-label="Filter workforce">
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
              placeholder="Search name, unit, church…"
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
          {pagination.rows.length === 0 ? (
            <div className="sa-empty">
              <div className="sa-empty-text">
                {leaderRows.length === 0
                  ? `No service unit or sub-unit leaders in ${stateLabel} yet.`
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
                  <th>Actions</th>
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
                    <td>
                      <AdminRowActionsTrigger onOpen={(e) => onOpenActions(e, r)} label="Action" />
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

      <AdminRowActionsMenu
        open={!!actionMenu?.id}
        anchorEl={actionMenu?.anchor}
        onClose={onCloseActionMenu}
        items={menuItems}
      />
    </>
  );
}
