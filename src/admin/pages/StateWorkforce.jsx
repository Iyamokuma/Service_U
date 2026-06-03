import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdminAuth } from "../AdminContext.jsx";
import { UsersContextSwitch } from "../components/UsersContextSwitch.jsx";
import { AdminRowActionsMenu, AdminRowActionsTrigger } from "../components/AdminRowActionsMenu.jsx";
import { buildAdminRowMenuItems, isAdminActive } from "../components/adminRowMenuItems.js";
import { branchCountryLabel, branchStateLabel } from "../branchRegions.js";
import { readStateWorkforceContext, writeStateWorkforceContext } from "../countryUsersContext.js";
function leaderLocationLabel(admin, countryCode) {
  const st = branchStateLabel(countryCode, admin.branch_state);
  const sat = String(admin.satellite_site || "").trim();
  if (sat && st) return `${sat} · ${st}`;
  if (sat) return sat;
  return st || "—";
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
}) {
  const { admin: me } = useAdminAuth();
  const countryCode = String(me?.branch_country || "").toUpperCase();
  const stateCode = String(me?.branch_state || "").toUpperCase();
  const countryLabel = branchCountryLabel(countryCode);
  const stateLabel = branchStateLabel(countryCode, stateCode) || stateCode;

  const [leaderContext, setLeaderContextRaw] = useState(() => readStateWorkforceContext());
  const setLeaderContext = useCallback((ctx) => {
    writeStateWorkforceContext(ctx);
    setLeaderContextRaw(ctx);
  }, []);

  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);

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
        return {
          ...a,
          unitName: unitNameById.get(unitId) || (unitId ? `Unit #${unitId}` : "—"),
          subUnit: a.role === "sub_unit_leader" ? String(a.sub_unit_name || "").trim() || "—" : "—",
          location: leaderLocationLabel(a, countryCode),
        };
      })
      .sort((a, b) => {
        const byUnit = a.unitName.localeCompare(b.unitName, undefined, { sensitivity: "base" });
        if (byUnit !== 0) return byUnit;
        return String(a.full_name || "").localeCompare(String(b.full_name || ""), undefined, {
          sensitivity: "base",
        });
      });
  }, [adminsPayload, countryCode, stateCode, unitNameById]);

  const unitLeaderRows = useMemo(
    () => leaderRows.filter((r) => r.role === "service_unit_leader"),
    [leaderRows],
  );
  const subLeaderRows = useMemo(
    () => leaderRows.filter((r) => r.role === "sub_unit_leader"),
    [leaderRows],
  );

  const contextRows = leaderContext === "sub_unit_leader" ? subLeaderRows : unitLeaderRows;
  const isUnitView = leaderContext === "service_unit_leader";

  const stats = useMemo(
    () => ({
      unitLeaders: unitLeaderRows.length,
      subLeaders: subLeaderRows.length,
      activeUnit: unitLeaderRows.filter((r) => isAdminActive(r)).length,
      activeSub: subLeaderRows.filter((r) => isAdminActive(r)).length,
    }),
    [unitLeaderRows, subLeaderRows],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contextRows.filter((r) => {
      if (!showInactive && !isAdminActive(r)) return false;
      if (!q) return true;
      const hay = [r.full_name, r.username, r.email, r.unitName, r.subUnit, r.location]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [contextRows, search, showInactive]);

  const contextOptions = useMemo(
    () => [
      { id: "service_unit_leader", label: "Service unit leaders", count: stats.unitLeaders },
      { id: "sub_unit_leader", label: "Sub-unit leaders", count: stats.subLeaders },
    ],
    [stats.unitLeaders, stats.subLeaders],
  );

  return (
    <>
      {!embedded ? (
        <header className="sa-admins-hero" style={{ marginBottom: 20 }}>
          <div>
            <h1 className="sa-admins-title">Workforce</h1>
            <p className="sa-admins-subtitle">
              Service unit and sub-unit leaders in {stateLabel}, {countryLabel}.
            </p>
          </div>
        </header>
      ) : null}

      <div className="sa-card">
        <UsersContextSwitch
          value={leaderContext}
          onChange={setLeaderContext}
          options={contextOptions}
          ariaLabel="Workforce leader type"
        />

        <div className="sa-admins-filters" role="toolbar" aria-label="Filter workforce">
          <div className="sa-search">
            <span className="sa-search-icon" aria-hidden>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              type="search"
              placeholder={
                isUnitView ? "Search unit leader, church, unit…" : "Search sub-unit leader, church…"
              }
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
          <span className="sa-admins-filter-count">
            {filtered.length} {isUnitView ? "unit leader" : "sub-unit leader"}
            {filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="sa-table-wrap">
          {filtered.length === 0 ? (
            <div className="sa-empty">
              <div className="sa-empty-text">
                {contextRows.length === 0
                  ? `No ${isUnitView ? "service unit" : "sub-unit"} leaders in this state yet.`
                  : "No leaders match your filters."}
              </div>
            </div>
          ) : isUnitView ? (
            <table className="sa-table sa-table-admins-simple">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Service unit</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="sa-fw-600">{r.full_name}</div>
                      <div className="sa-text-sm sa-text-muted">{r.username}</div>
                    </td>
                    <td className="sa-text-sm">{r.unitName}</td>
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
          ) : (
            <table className="sa-table sa-table-admins-simple">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Service unit</th>
                  <th>Sub-unit</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="sa-fw-600">{r.full_name}</div>
                      <div className="sa-text-sm sa-text-muted">{r.username}</div>
                    </td>
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
