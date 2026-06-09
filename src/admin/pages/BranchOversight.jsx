import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { useAdminAuth } from "../AdminContext.jsx";
import { useToast } from "../components/Toast.jsx";
import { Modal } from "../components/Modal.jsx";
import { AcceptVerifyModal, needsAcceptVerification } from "../components/AcceptVerifyModal.jsx";
import { branchCountryLabel, branchStatesForCountry, branchStateLabel } from "../branchRegions.js";
import { isCountrySuperAdmin, isStateSuperAdmin, isSupervisoryBranchRole } from "../roles.js";
import { isActingAsStateAdmin } from "../adminViewMode.js";
import { leaderScopeLabel } from "../leaderScope.js";
import { RegistrationDetails, fmtDate, fullName } from "./Queue.jsx";
import { SmhLoader } from "../../components/SmhLoader.jsx";

const STATUSES = ["new", "in_progress", "accepted", "rejected", "archived"];

/**
 * Country / State supervisory: filter registrations in branch scope.
 * Country admins can action application status; state admins are view-only.
 */
export function BranchOversight({ units }) {
  const toast = useToast();
  const { admin, viewMode } = useAdminAuth();
  const actingAsState = isActingAsStateAdmin(admin, viewMode);
  const isCountryActor = isCountrySuperAdmin(admin?.role);
  const isCountryView = isCountryActor && !actingAsState;
  const canAction = isCountryView;
  const countrySupervisoryQueue = isCountryActor && actingAsState;
  const isStateSupervisory = isStateSuperAdmin(admin?.role);
  const isSatelliteSupervisory = admin?.role === "satellite_church_admin";
  const [stats, setStats] = useState(null);
  const [rows, setRows] = useState([]);
  const [pag, setPag] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [statusModal, setStatusModal] = useState(null);
  const [acceptVerifyModal, setAcceptVerifyModal] = useState(null);
  const [filters, setFilters] = useState({
    search: "",
    unit_id: "",
    sub_unit: "",
    filter_branch_state: "",
    status: "",
    sex: "",
    from: "",
    to: "",
  });

  const stateOptions = useMemo(() => {
    if (!isCountryActor || !admin?.branch_country) return [];
    return branchStatesForCountry(admin.branch_country);
  }, [isCountryActor, admin?.branch_country]);

  const subUnitOptions = useMemo(() => {
    const u = (units?.data || []).find((x) => Number(x.id) === Number(filters.unit_id));
    return (u?.sub_units || []).map((s) => s.name).filter(Boolean);
  }, [units?.data, filters.unit_id]);

  useEffect(() => {
    if (!admin || !isSupervisoryBranchRole(admin.role)) return;
    api.stats({ viewer: admin }).then(setStats).catch(() => setStats(null));
  }, [admin]);

  const load = useCallback(
    async (page = 1) => {
      if (!admin) return;
      setLoading(true);
      try {
        const res = await api.queue({
          ...filters,
          page,
          per_page: 25,
          viewer: admin,
          ...(countrySupervisoryQueue ? { scope_mode: "country" } : {}),
        });
        setRows(res.data || []);
        setPag(res.pagination || { page: 1, pages: 1, total: 0 });
      } catch (e) {
        toast(e.message, "error");
      } finally {
        setLoading(false);
      }
    },
    [admin, filters, toast, countrySupervisoryQueue]
  );

  useEffect(() => {
    const t = setTimeout(() => load(1), 280);
    return () => clearTimeout(t);
  }, [load]);

  const setFilter = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));

  async function saveRowStatus(id, newStatus, notes, originalStatus) {
    if (needsAcceptVerification(originalStatus, newStatus)) {
      const row = rows.find((r) => r.id === id) || { id, status: originalStatus };
      setStatusModal(null);
      setAcceptVerifyModal({ ...row, _pendingNotes: notes });
      return;
    }
    try {
      await api.updateStatus(id, { status: newStatus, notes, viewer: admin });
      toast("Status updated.", "success");
      setStatusModal(null);
      load(pag.page);
    } catch (e) {
      toast(e.message, "error");
    }
  }

  async function doAcceptWithVerify(id, notes, verify) {
    try {
      await api.updateStatus(id, {
        status: "accepted",
        notes: notes || "",
        viewer: admin,
        ...(verify || {}),
      });
      toast("Application moved to accepted.", "success");
      setAcceptVerifyModal(null);
      load(pag.page);
    } catch (e) {
      toast(e.message, "error");
    }
  }

  if (!admin) return null;

  const scopeLabel = leaderScopeLabel(admin);

  return (
    <>
      <p className="sa-text-muted sa-text-sm" style={{ marginBottom: 16, maxWidth: 720 }}>
        {countrySupervisoryQueue ? (
          <>
            <strong>Country supervisory queue{scopeLabel ? ` · ${scopeLabel}` : ""}</strong>
            {" — "}
            View all applications in {branchCountryLabel(admin.branch_country) || "your country"}. Status updates are
            available in Country Admin view only; use this tab to monitor progress.
          </>
        ) : isCountryView ? (
          <>
            <strong>Country scope{scopeLabel ? ` · ${scopeLabel}` : ""}</strong>
            {" — "}
            Filter and update applications across {branchCountryLabel(admin.branch_country) || "your country"}.
            Service units and sub-units are managed by Super / General Admin only.
          </>
        ) : isStateSupervisory ? (
          <>
            <strong>State supervisory queue{scopeLabel ? ` · ${scopeLabel}` : ""}</strong>
            {" — "}
            View all applications in your state. Status updates are handled by service unit leaders at each
            satellite church.
          </>
        ) : isSatelliteSupervisory ? (
          <>
            <strong>Satellite supervisory queue{scopeLabel ? ` · ${scopeLabel}` : ""}</strong>
            {" — "}
            View all applications at your church. Status updates are handled by service unit leaders.
          </>
        ) : (
          <>
            Supervisory view: filter by branch, unit, and sub-unit. Application status changes are done by service unit leaders.
          </>
        )}
      </p>

      {stats?.totals && (
        <div className="sa-stat-grid" style={{ marginBottom: 20 }}>
          <div className="sa-stat-card">
            <div className="sa-stat-header">
              <span className="sa-stat-label">In scope</span>
            </div>
            <div className="sa-stat-value">{stats.totals.registrations}</div>
            <div className="sa-text-sm sa-text-muted" style={{ marginTop: 8 }}>
              Total registrations
            </div>
          </div>
          <div className="sa-stat-card">
            <div className="sa-stat-header">
              <span className="sa-stat-label">Pending</span>
            </div>
            <div className="sa-stat-value">{stats.totals.pending}</div>
          </div>
          <div className="sa-stat-card">
            <div className="sa-stat-header">
              <span className="sa-stat-label">Approved</span>
            </div>
            <div className="sa-stat-value">{stats.totals.approved}</div>
          </div>
          <div className="sa-stat-card">
            <div className="sa-stat-header">
              <span className="sa-stat-label">Units touched</span>
            </div>
            <div className="sa-stat-value">{stats.totals.active_units}</div>
          </div>
        </div>
      )}

      <div className="sa-card">
        <div className="sa-filters">
          <div className="sa-search" style={{ minWidth: 220 }}>
            <span className="sa-search-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input placeholder="Search name, email, phone…" value={filters.search} onChange={setFilter("search")} />
          </div>
          {isCountryActor && (
            <select className="sa-select" value={filters.filter_branch_state} onChange={setFilter("filter_branch_state")} aria-label="Filter by state">
              <option value="">All states / satellites</option>
              {stateOptions.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
          <select className="sa-select" value={filters.unit_id} onChange={(e) => setFilters((f) => ({ ...f, unit_id: e.target.value, sub_unit: "" }))}>
            <option value="">All service units</option>
            {(units?.data || []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <select className="sa-select" value={filters.sub_unit} onChange={setFilter("sub_unit")} disabled={!filters.unit_id}>
            <option value="">{filters.unit_id ? "All sub-units" : "Pick unit first"}</option>
            {subUnitOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <select className="sa-select" value={filters.status} onChange={setFilter("status")}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
          <select className="sa-select" value={filters.sex} onChange={setFilter("sex")}>
            <option value="">All genders</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
          <div className="sa-date-range-group" aria-label="Date range">
            <div className="sa-date-field">
              <span className="sa-date-placeholder" aria-hidden="true">Start date</span>
              <input
                id="bo-from"
                aria-label="Start date"
                className={`sa-date-field-input${!filters.from ? " sa-date-empty" : ""}`}
                type="date"
                value={filters.from}
                onChange={setFilter("from")}
              />
            </div>
            <div className="sa-date-field">
              <span className="sa-date-placeholder" aria-hidden="true">End date</span>
              <input
                id="bo-to"
                aria-label="End date"
                className={`sa-date-field-input${!filters.to ? " sa-date-empty" : ""}`}
                type="date"
                value={filters.to}
                onChange={setFilter("to")}
              />
            </div>
          </div>
          <button
            type="button"
            className="sa-btn sa-btn-outline sa-btn-sm"
            onClick={() =>
              setFilters({
                search: "",
                unit_id: "",
                sub_unit: "",
                filter_branch_state: "",
                status: "",
                sex: "",
                from: "",
                to: "",
              })
            }
          >
            Clear
          </button>
          <span className="sa-text-muted sa-text-sm" style={{ marginLeft: "auto" }}>
            {pag.total} result{pag.total !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="sa-table-wrap">
          {loading ? (
            <SmhLoader label="Loading applications" />
          ) : rows.length === 0 ? (
            <div className="sa-empty">
              <div className="sa-empty-icon">📋</div>
              <div className="sa-empty-text">No registrations match your filters.</div>
            </div>
          ) : (
            <table className="sa-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Branch</th>
                  <th>Unit</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th>{canAction ? "Actions" : ""}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <Fragment key={r.id}>
                    <tr>
                      <td className="sa-text-muted">{r.id}</td>
                      <td>
                        <div className="sa-fw-600">{fullName(r)}</div>
                        {r.other_names && <div className="sa-text-sm sa-text-muted">{r.other_names}</div>}
                      </td>
                      <td className="sa-text-sm sa-text-muted">{branchStateLabel(r.branch_country, r.branch_state)}</td>
                      <td>
                        <div>{r.unit_name}</div>
                        {r.sub_unit && <div className="sa-text-sm sa-text-muted">{r.sub_unit}</div>}
                      </td>
                      <td>
                        <span className={`sa-badge ${r.status}`}>{r.status.replace("_", " ")}</span>
                      </td>
                      <td className="sa-text-muted">{fmtDate(r.submitted_at)}</td>
                      <td>
                        <div className="sa-table-actions">
                          <button type="button" className="sa-btn sa-btn-ghost sa-btn-sm" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                            {expanded === r.id ? "▲ Hide" : "▼ Details"}
                          </button>
                          {canAction && (
                            <button
                              type="button"
                              className="sa-btn sa-btn-outline sa-btn-sm"
                              onClick={() =>
                                setStatusModal({
                                  id: r.id,
                                  status: r.status,
                                  notes: r.notes || "",
                                  originalStatus: r.status,
                                })
                              }
                            >
                              Update status
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expanded === r.id && (
                      <tr className="sa-detail-row">
                        <td colSpan={7}>
                          <RegistrationDetails r={r} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {pag.pages > 1 && (
          <div className="sa-card-body" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button type="button" className="sa-btn sa-btn-outline sa-btn-sm" disabled={pag.page <= 1} onClick={() => load(pag.page - 1)}>
              Previous
            </button>
            <span className="sa-text-muted sa-text-sm">
              Page {pag.page} of {pag.pages}
            </span>
            <button type="button" className="sa-btn sa-btn-outline sa-btn-sm" disabled={pag.page >= pag.pages} onClick={() => load(pag.page + 1)}>
              Next
            </button>
          </div>
        )}
      </div>

      <Modal
        open={!!statusModal}
        onClose={() => setStatusModal(null)}
        title="Update application status"
        size="sm"
        footer={
          <>
            <button type="button" className="sa-btn sa-btn-outline" onClick={() => setStatusModal(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="sa-btn sa-btn-primary"
              onClick={() =>
                statusModal &&
                saveRowStatus(statusModal.id, statusModal.status, statusModal.notes, statusModal.originalStatus)
              }
            >
              Save
            </button>
          </>
        }
      >
        {statusModal ? (
          <>
            <div className="sa-field">
              <label className="sa-label">Status</label>
              <select
                className="sa-field-select"
                value={statusModal.status}
                onChange={(e) => setStatusModal((m) => ({ ...m, status: e.target.value }))}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s === "in_progress" ? "In review" : s.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className="sa-field">
              <label className="sa-label">Notes (optional)</label>
              <textarea
                className="sa-textarea"
                value={statusModal.notes}
                onChange={(e) => setStatusModal((m) => ({ ...m, notes: e.target.value }))}
                placeholder="Internal notes…"
              />
            </div>
          </>
        ) : null}
      </Modal>

      <AcceptVerifyModal
        open={!!acceptVerifyModal}
        candidateName={acceptVerifyModal ? fullName(acceptVerifyModal) : ""}
        onClose={() => setAcceptVerifyModal(null)}
        onConfirm={(verify) =>
          acceptVerifyModal
            ? doAcceptWithVerify(acceptVerifyModal.id, acceptVerifyModal._pendingNotes || "", verify)
            : Promise.resolve()
        }
      />
    </>
  );
}
