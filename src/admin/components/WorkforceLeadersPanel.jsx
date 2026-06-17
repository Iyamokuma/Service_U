import { useEffect, useMemo, useState } from "react";
import { AdminLoginMeta } from "./AdminLoginMeta.jsx";
import { AdminRowActionsMenu, AdminRowActionsTrigger } from "./AdminRowActionsMenu.jsx";
import { isAdminActive } from "./adminRowMenuItems.js";
import { branchStateLabel } from "../branchRegions.js";
import { TableSelectCheckbox } from "./TableSelectCheckbox.jsx";
import { TableBulkActionsBar } from "./TableBulkActionsBar.jsx";
import { useAdminTableBulk } from "../hooks/useAdminTableBulk.js";
import {
  WORKFORCE_PAGE_SIZE,
  buildUnitNameMap,
  compareLeadersAlphabetical,
  leaderRoleLabel,
} from "../workforceLeaders.js";

function leaderLocationLabel(admin, countryCode) {
  const st = branchStateLabel(countryCode, admin.branch_state);
  const sat = String(admin.satellite_site || "").trim();
  if (sat && st) return `${sat} · ${st}`;
  if (sat) return sat;
  return st || "—";
}

/**
 * Paginated workforce table: role filter, search, A–Z sort.
 * @param {object} props
 * @param {function} props.rowFilter - (admin) => boolean
 * @param {string[]} [props.roles] - default both leader roles
 * @param {boolean} [props.showRoleFilter] - role dropdown (default true)
 */
export function WorkforceLeadersPanel({
  admins: adminsPayload,
  units: unitsPayload,
  countryCode,
  rowFilter,
  roles = ["service_unit_leader", "sub_unit_leader"],
  showRoleFilter = true,
  emptyScopeLabel = "this scope",
  actionMenu,
  onOpenActions,
  onCloseActionMenu,
  menuItems,
  onStats,
  me,
  reload,
  bulkScope = {},
}) {
  const bulkEnabled = Boolean(me && reload && onOpenActions);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [roleFilter, setRoleFilter] = useState("all");
  const [workforcePage, setWorkforcePage] = useState(1);

  const unitNameById = useMemo(() => buildUnitNameMap(unitsPayload?.data), [unitsPayload?.data]);
  const roleSet = useMemo(() => new Set(roles), [roles]);

  const leaderRows = useMemo(() => {
    return (adminsPayload?.data ?? [])
      .filter((a) => roleSet.has(a.role) && rowFilter(a))
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
  }, [adminsPayload, rowFilter, roleSet, unitNameById, countryCode]);

  const unitLeaderRows = useMemo(
    () => leaderRows.filter((r) => r.role === "service_unit_leader"),
    [leaderRows],
  );
  const subLeaderRows = useMemo(
    () => leaderRows.filter((r) => r.role === "sub_unit_leader"),
    [leaderRows],
  );
  const workforceTotal = leaderRows.length;

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
      if (showRoleFilter && roleFilter === "service_unit_leader" && r.role !== "service_unit_leader") {
        return false;
      }
      if (showRoleFilter && roleFilter === "sub_unit_leader" && r.role !== "sub_unit_leader") return false;
      if (!q) return true;
      const hay = [r.full_name, r.username, r.email, r.unitName, r.subUnit, r.location, r.roleLabel]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [leaderRows, search, showInactive, roleFilter, showRoleFilter]);

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

  const bulk = useAdminTableBulk({
    rows: pagination.rows,
    me: bulkEnabled ? me : null,
    reload: bulkEnabled ? reload : null,
    bulkScope,
    noun: "leader",
  });

  return (
    <>
      <div className="sa-card">
        <div className="sa-admins-filters" role="toolbar" aria-label="Filter workforce">
          {showRoleFilter ? (
            <select
              className="sa-select"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              aria-label="Role"
            >
              <option value="all">All</option>
              {roles.includes("service_unit_leader") ? (
                <option value="service_unit_leader">Service unit leader</option>
              ) : null}
              {roles.includes("sub_unit_leader") ? (
                <option value="sub_unit_leader">Sub-unit leader</option>
              ) : null}
            </select>
          ) : null}
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

        <TableBulkActionsBar
          selectedCount={bulk.selection.selectedCount}
          onClear={bulk.selection.clear}
          actions={bulk.bulkActions}
          busy={bulk.bulkBusy}
        />

        <div className="sa-table-wrap">
          {pagination.rows.length === 0 ? (
            <div className="sa-empty">
              <div className="sa-empty-text">
                {leaderRows.length === 0
                  ? `No workforce leaders in ${emptyScopeLabel} yet.`
                  : "No leaders match your filters."}
              </div>
            </div>
          ) : (
            <table className="sa-table sa-table-admins-simple">
              <thead>
                <tr>
                  {bulk.showBulkColumn ? (
                    <th className="sa-table-select-col">
                      <TableSelectCheckbox
                        checked={bulk.selection.allSelected}
                        indeterminate={bulk.selection.someSelected}
                        onChange={bulk.selection.toggleAll}
                        disabled={!bulk.selection.hasSelectableRows || bulk.bulkBusy}
                        ariaLabel="Select all leaders on this page"
                      />
                    </th>
                  ) : null}
                  <th>Name</th>
                  {showRoleFilter ? <th>Role</th> : null}
                  <th className="sa-leader-col-unit">Service unit</th>
                  <th className="sa-leader-col-sub">Sub-unit</th>
                  <th className="sa-leader-col-location">Location</th>
                  <th>Status</th>
                  {onOpenActions ? <th>Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {pagination.rows.map((r) => {
                  const selectable = bulk.canSelectRow(r);
                  const marked = bulk.selection.isSelected(r.id);
                  return (
                  <tr key={r.id} className={marked ? "sa-row-selected" : undefined}>
                    {bulk.showBulkColumn ? (
                      <td className="sa-table-select-col">
                        {selectable ? (
                          <TableSelectCheckbox
                            checked={marked}
                            onChange={() => bulk.selection.toggle(r.id)}
                            disabled={bulk.bulkBusy}
                            ariaLabel={`Select ${r.full_name || "leader"}`}
                          />
                        ) : null}
                      </td>
                    ) : null}
                    <td>
                      <div className="sa-fw-600">{r.full_name}</div>
                      <AdminLoginMeta username={r.username} email={r.email} />
                      {!showRoleFilter && r.role === "sub_unit_leader" ? (
                        <div className="sa-text-sm sa-text-muted sa-leader-row-meta">
                          {[r.unitName, r.subUnit !== "—" ? r.subUnit : "", r.location !== "—" ? r.location : ""]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                      ) : null}
                    </td>
                    {showRoleFilter ? <td className="sa-text-sm">{r.roleLabel}</td> : null}
                    <td className="sa-text-sm sa-leader-col-unit">{r.unitName}</td>
                    <td className="sa-text-sm sa-leader-col-sub">{r.subUnit}</td>
                    <td className="sa-text-sm sa-leader-col-location">{r.location}</td>
                    <td>
                      <span className={`sa-badge ${isAdminActive(r) ? "active" : "inactive"}`}>
                        {isAdminActive(r) ? "Active" : "Inactive"}
                      </span>
                    </td>
                    {onOpenActions ? (
                      <td>
                        <AdminRowActionsTrigger onOpen={(e) => onOpenActions(e, r)} label="Action" />
                      </td>
                    ) : null}
                  </tr>
                );
                })}
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

      {onCloseActionMenu ? (
        <AdminRowActionsMenu
          open={!!actionMenu?.id}
          anchorEl={actionMenu?.anchor}
          onClose={onCloseActionMenu}
          items={menuItems}
        />
      ) : null}
    </>
  );
}
