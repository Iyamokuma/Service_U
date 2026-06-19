import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MONTHS as MONTHS_LONG } from "../../data.js";
import { api } from "../api.js";
import { branchCountryLabel, branchStateLabel } from "../branchRegions.js";
import { Modal } from "../components/Modal.jsx";
import { AcceptVerifyModal, needsAcceptVerification } from "../components/AcceptVerifyModal.jsx";
import { useToast } from "../components/Toast.jsx";
import { useAdminAuth } from "../AdminContext.jsx";
import { isServiceUnitLeader, isGlobalAdminRole } from "../roles.js";
import { useAdminGeoFilters } from "../AdminGeoFilterContext.jsx";
import { QueueSubUnitTabs } from "../components/QueueSubUnitTabs.jsx";
import { ApplicationStatusBadge } from "../components/ApplicationStatusBadge.jsx";
import { UsersPageMeta } from "../components/UsersPageMeta.jsx";
import { SmhLoader } from "../../components/SmhLoader.jsx";
import {
  applyQueueStatusTab,
  pipelineStatusLabel,
  queueActionVisible,
  queueStatusOptionsForTab,
  queueStatusTabLabel,
  queueStatusTabsForRole,
} from "../queueStatusTabs.js";

const STATUSES = ["new", "in_progress", "accepted", "rejected", "archived"];

const MONTHS   = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function fmtDate(str) {
  if (!str) return "—";
  const d = new Date(str);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}
export function fullName(r) { return [r.first_name, r.surname].filter(Boolean).join(" "); }

function fmtMonthName(m) {
  if (m === undefined || m === null || m === "") return "";
  const n = Number(m);
  if (!Number.isFinite(n) || n < 1 || n > 12) return String(m);
  return MONTHS_LONG[n - 1] || String(m);
}
function fmtMdY(month, day, year) {
  const mo = fmtMonthName(month);
  const parts = [mo, day || "", year || ""].filter((x) => x !== "" && x !== undefined && x !== null);
  return parts.length ? parts.join(" ") : "—";
}
function fmtMy(month, year) {
  const mo = fmtMonthName(month);
  if (!mo && !year) return "—";
  return [mo, year || ""].filter(Boolean).join(" ");
}

function wolbiDetail(r) {
  if (!r.wolbi || r.wolbi === "No") return r.wolbi || "—";
  if (r.wolbi !== "Yes") return r.wolbi;
  const when = fmtMy(r.wolbi_month, r.wolbi_year);
  const level = r.wolbi_level || "";
  const parts = [when !== "—" ? when : "", level].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Yes";
}

export function RegistrationDetails({ r }) {
  const ba = r.born_again === "Yes";
  return (
    <div className="sa-detail-inner">
      {r.photo_path && (
        <div className="sa-detail-field" style={{ gridColumn: "1 / -1" }}>
          <div className="sa-detail-label">Photo</div>
          <img src={r.photo_path} alt="" className="sa-photo" style={{ maxWidth: 140, maxHeight: 140, objectFit: "cover", borderRadius: 8 }} />
        </div>
      )}
      <Field label="Registration ref" value={String(r.id)} />
      <Field label="Other names" value={r.other_names || "—"} />
      <Field label="Date of birth" value={fmtMdY(r.dob_month, r.dob_day, r.dob_year)} />
      <Field label="Sex" value={r.sex || "—"} />
      <Field label="Marital status" value={r.marital_status || "—"} />
      <Field label="Nationality" value={r.nationality || "—"} />
      <Field label="Country (residence)" value={branchCountryLabel(r.branch_country)} />
      <Field label="State / region" value={branchStateLabel(r.branch_country, r.branch_state)} />
      <Field label="Church / branch" value={(r.satellite_site || "").trim() || "—"} />
      <Field label="Residential address" value={r.address || "—"} />
      <Field label="Nearest bus stop" value={r.bus_stop || "—"} />
      <Field label="Primary phone" value={r.phone1 || "—"} />
      <Field label="Secondary phone" value={r.phone2 || "—"} />
      <Field label="Email" value={r.email || "—"} />
      <Field label="Workplace" value={r.workplace || "—"} />
      <Field label="Tithe card" value={r.tithe_card || "—"} />
      <Field label="Homecell" value={r.homecell || "—"} />
      <Field label="Service unit" value={r.unit_name || "—"} />
      <Field label="Sub-unit" value={r.sub_unit || "—"} />
      <Field label="Joined church" value={fmtMy(r.joined_church_month, r.joined_church_year)} />
      <Field label="Born again" value={r.born_again || "—"} />
      {ba && <Field label="Year born again" value={r.born_again_year || "—"} />}
      <Field label="Foundation class" value={ba ? r.foundation || "—" : "—"} />
      {ba && <Field label="Foundation class (when)" value={r.foundation === "Yes" ? fmtMy(r.foundation_month, r.foundation_year) : "—"} />}
      <Field label="Water baptised" value={ba ? r.baptised || "—" : "—"} />
      {ba && <Field label="Baptism (when)" value={r.baptised === "Yes" ? fmtMy(r.baptised_month, r.baptised_year) : "—"} />}
      <Field label="WOLBI" value={ba ? wolbiDetail(r) : "—"} />
      {r.leader_accept_verified_at && (
        <>
          <div className="sa-detail-field" style={{ gridColumn: "1 / -1", marginTop: 8 }}>
            <div className="sa-detail-label" style={{ fontWeight: 600 }}>Acceptance verification (admin check)</div>
            <div className="sa-detail-value sa-text-sm sa-text-muted">
              Recorded by the accepting admin when moving this application from in-progress to accepted.
            </div>
          </div>
          <Field label="Foundation class done" value={r.leader_accept_foundation_class ? "Yes" : "Not confirmed"} />
          <Field label="Water baptism done" value={r.leader_accept_water_baptism ? "Yes" : "Not confirmed"} />
          <Field label="Called the candidate" value={r.leader_accept_called_candidate ? "Yes" : "No"} />
          <Field label="Invited to physical meeting" value={r.leader_accept_physical_meeting ? "Yes" : "No"} />
          <Field label="Verified at" value={fmtDate(r.leader_accept_verified_at)} />
        </>
      )}
      {r.notes ? <Field label="Internal notes" value={r.notes} /> : <Field label="Internal notes" value="—" />}
    </div>
  );
}

export function Queue({ units, initialTab = "all" }) {
  const toast = useToast();
  const { admin } = useAdminAuth();
  const isServiceLeader = isServiceUnitLeader(admin?.role);
  const isSubUnitLeader = admin?.role === "sub_unit_leader";
  const isLeader = isServiceLeader || isSubUnitLeader;
  const leaderDefaultTab = initialTab === "all" ? "new" : initialTab;
  const isGlobalAdmin = isGlobalAdminRole(admin?.role);
  const geo = useAdminGeoFilters();
  const [rows, setRows] = useState([]);
  const [pag, setPag] = useState({ page: 1, per_page: 25, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [statusModal, setStatusModal] = useState(null);
  const [acceptVerifyModal, setAcceptVerifyModal] = useState(null);
  const [filters, setFilters] = useState({
    search: "",
    unit_id: "",
    sub_unit: "",
    status: "",
    sex: "",
    from: "",
    to: "",
    sort: "submitted_at",
    dir: "DESC",
  });
  const [statusTab, setStatusTab] = useState(isLeader ? leaderDefaultTab : initialTab);
  /** Service unit leader: "" = all sub-units, else sub-unit name. */
  const [subUnitTab, setSubUnitTab] = useState("");

  useEffect(() => {
    setStatusTab(isLeader ? leaderDefaultTab : initialTab);
  }, [initialTab, isLeader, leaderDefaultTab]);
  const [leaderSubUnitLabels, setLeaderSubUnitLabels] = useState([]);
  const debounce = useRef(null);

  const mergedQueueParams = useCallback(
    (page = 1) => {
      const subUnitForQueue = isSubUnitLeader
        ? admin?.sub_unit_name || admin?.sub_unit || ""
        : isServiceLeader
          ? subUnitTab
          : filters.sub_unit || "";
      const scoped = {
        ...filters,
        page,
        per_page: 25,
        viewer: admin,
        unit_id: isServiceLeader || isSubUnitLeader ? admin?.service_unit_id : filters.unit_id,
        sub_unit: subUnitForQueue,
        ...(isGlobalAdmin ? geo.apiParams : {}),
      };
      delete scoped.overdue_only;
      delete scoped.critical_only;
      applyQueueStatusTab(scoped, statusTab, { isLeader });
      if (statusTab === "all" && !isLeader) {
        scoped.status = filters.status || "";
      }
      return scoped;
    },
    [filters, admin, isServiceLeader, isSubUnitLeader, subUnitTab, statusTab, isLeader, isGlobalAdmin, geo.apiParams]
  );

  useEffect(() => {
    if (!isServiceLeader || !admin) return;
    api.subUnitQueuesByUnit(admin)
      .then((r) => setLeaderSubUnitLabels((r.data || []).map((b) => b.sub_unit).filter(Boolean)))
      .catch(() => setLeaderSubUnitLabels([]));
  }, [isServiceLeader, admin]);

  useEffect(() => {
    setExpanded(null);
  }, [filters.sub_unit, subUnitTab, statusTab]);

  useEffect(() => {
    if (!expanded) return;
    let cancelled = false;
    api.registration(expanded).then((res) => {
      if (cancelled || !res?.data) return;
      setRows((prev) => prev.map((r) => (r.id === expanded ? { ...r, ...res.data } : r)));
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [expanded]);

  const load = useCallback(async (params) => {
    setLoading(true);
    try {
      const res = await api.queue({ ...params, page: params.page ?? 1, per_page: 25, viewer: admin });
      setRows(res.data);
      setPag(res.pagination);
    } catch (e) { toast(e.message, "error"); }
    finally { setLoading(false); }
  }, [toast, admin]);

  useEffect(() => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      load(mergedQueueParams(1));
    }, 300);
  }, [filters, subUnitTab, statusTab, load, mergedQueueParams, geo.apiParams]);

  const setFilter = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));
  const gotoPage = (p) => load(mergedQueueParams(p));

  async function refreshAfterQueueAction(page = 1) {
    load(mergedQueueParams(page));
  }

  // Called by StatusModal for non-leader admins.
  // Intercepts in_progress → accepted to require the verify modal first.
  async function updateStatus(id, newStatus, notes, originalStatus) {
    if (originalStatus === "in_progress" && newStatus === "accepted") {
      // Find the row so we can show the candidate name in the modal
      const row = rows.find((r) => r.id === id) || { id, status: originalStatus };
      setStatusModal(null);
      setAcceptVerifyModal({ ...row, _pendingNotes: notes });
      return;
    }
    try {
      await api.updateStatus(id, { status: newStatus, notes, viewer: admin });
      toast("Status updated.", "success");
      setStatusModal(null);
      await refreshAfterQueueAction(pag.page);
    } catch (e) { toast(e.message, "error"); }
  }

  // Called after the verify modal confirms — actually persists the accept.
  async function doAcceptWithVerify(id, notes, verify) {
    try {
      const body = { status: "accepted", notes: notes || "", viewer: admin, ...(verify || {}) };
      await api.updateStatus(id, body);
      toast("Application moved to accepted.", "success");
      setAcceptVerifyModal(null);
      removeRowFromLeaderNewQueue(id);
      await refreshAfterQueueAction(pag.page);
    } catch (e) {
      toast(e.message, "error");
    }
  }

  function removeRowFromLeaderNewQueue(id) {
    if (!isLeader || statusTab !== "new") return;
    setRows((prev) => prev.filter((r) => r.id !== id));
    setExpanded((ex) => (ex === id ? null : ex));
    setPag((p) => ({
      ...p,
      total: Math.max(0, (p.total ?? 0) - 1),
      pages: Math.max(1, Math.ceil(Math.max(0, (p.total ?? 0) - 1) / (p.per_page || 25))),
    }));
  }

  // Quick leader action for all statuses other than in_progress→accepted.
  async function quickLeaderStatus(id, status) {
    try {
      await api.updateStatus(id, { status, notes: "", viewer: admin });
      toast(`Status set to ${status.replace(/_/g, " ")}.`, "success");
      if (status !== "new") removeRowFromLeaderNewQueue(id);
      await refreshAfterQueueAction(pag.page);
    } catch (e) {
      toast(e.message, "error");
    }
  }

  // Accept button for leader rows — always shows verify modal when currently in_progress.
  function requestLeaderAccept(row) {
    if (row.status === "in_progress") {
      setAcceptVerifyModal(row);
      return;
    }
    toast("Move the application to In Progress before accepting.", "error");
  }

  const unitOpts = units?.data ?? [];
  const allowedStatus = (current) => {
    const c = current || "new";
    let opts;
    if (!["service_unit_leader", "sub_unit_leader"].includes(admin?.role)) {
      opts = [...STATUSES];
    } else if (c === "new") {
      opts = ["new", "in_progress", "accepted", "rejected", "archived"];
    } else if (c === "in_progress") {
      opts = ["in_progress", "accepted", "rejected", "new", "archived"];
    } else if (c === "accepted" || c === "rejected") {
      if (statusTab === "accepted" && c === "accepted") {
        opts = ["accepted", "in_progress", "rejected", "archived"];
      } else {
        opts = [c, "archived"];
      }
    } else if (c === "archived") {
      opts = ["archived"];
    } else {
      opts = [c];
    }
    return queueStatusOptionsForTab(c, statusTab, opts);
  };

  const leaderActionDisabled = (row, target) => {
    if (isServiceLeader && target === "archived") return true;
    if (row.status === "archived") return true;
    if (!queueActionVisible(statusTab, target) && (statusTab === "accepted" || statusTab === "inprogress")) {
      return true;
    }
    if (target === "archived") {
      return !["new", "in_progress", "accepted", "rejected"].includes(row.status);
    }
    if (statusTab === "accepted" && row.status === "accepted") {
      return !["in_progress", "rejected"].includes(target);
    }
    if (statusTab === "inprogress" && row.status === "in_progress") {
      return !["accepted", "rejected"].includes(target);
    }
    if ((row.status === "accepted" || row.status === "rejected") && target !== "archived") return true;
    return !allowedStatus(row.status).includes(target);
  };

  const leaderSubUnitOptions = useMemo(() => {
    if (!isServiceLeader) return [];
    const unit = (units?.data || []).find((u) => Number(u.id) === Number(admin?.service_unit_id));
    const fromCatalog = (unit?.sub_units || []).map((s) => s.name).filter(Boolean);
    return [...new Set([...fromCatalog, ...leaderSubUnitLabels])].sort((a, b) => a.localeCompare(b));
  }, [isServiceLeader, units?.data, admin?.service_unit_id, leaderSubUnitLabels]);

  const showSubUnitTabs = isServiceLeader && leaderSubUnitOptions.length > 0;

  const serviceUnitName = useMemo(() => {
    if (!isServiceLeader) return "";
    const u = (units?.data || []).find((x) => Number(x.id) === Number(admin?.service_unit_id));
    return String(u?.name || "").trim();
  }, [isServiceLeader, units?.data, admin?.service_unit_id]);

  const globalSubUnitOptions = useMemo(() => {
    if (isLeader) return [];
    const unit = unitOpts.find((u) => String(u.id) === String(filters.unit_id));
    return (unit?.sub_units || []).map((s) => s.name).filter(Boolean);
  }, [isLeader, unitOpts, filters.unit_id]);
  const showGlobalSubUnitFilter = !isLeader && filters.unit_id && globalSubUnitOptions.length > 0;

  const showIntakeFilters = true;
  const onOverdueTab = statusTab === "overdue";
  const onCriticalTab = statusTab === "critical";
  const onSlaTab = onOverdueTab || onCriticalTab;
  const statusTabs = useMemo(() => queueStatusTabsForRole(admin?.role), [admin?.role]);

  const leaderNewQueueTab = isLeader && statusTab === "new";
  const tableRows = rows;
  const tableColSpan = (isLeader ? 6 : 9) + (onSlaTab ? 1 : 0);

  const queueMetaItems = useMemo(() => {
    if (!isServiceLeader) return [];
    const items = [];
    if (serviceUnitName) items.push(`Service unit: ${serviceUnitName}`);
    if (showSubUnitTabs) {
      items.push(subUnitTab ? `Sub-unit: ${subUnitTab}` : "All sub-units");
    }
    items.push(
      onOverdueTab
        ? `${pag.total} overdue`
        : onCriticalTab
          ? `${pag.total} critical`
          : `${pag.total} application${pag.total !== 1 ? "s" : ""} · ${queueStatusTabLabel(statusTab)}`,
    );
    return items;
  }, [isServiceLeader, serviceUnitName, showSubUnitTabs, subUnitTab, onOverdueTab, pag.total, statusTab]);

  return (
    <>
      {isServiceLeader ? (
        <header className="sa-users-page-head">
          <div className="sa-users-page-head-top">
            <h1 className="sa-admins-title">Application Queue</h1>
          </div>
          {showSubUnitTabs ? (
            <div className="sa-users-page-head-tabs">
              <QueueSubUnitTabs
                subUnits={leaderSubUnitOptions}
                activeSubUnit={subUnitTab}
                onChange={setSubUnitTab}
              />
            </div>
          ) : null}
          <UsersPageMeta items={queueMetaItems} />
          <p className="sa-text-muted sa-text-xs" style={{ margin: "8px 0 0", lineHeight: 1.5 }}>
            {statusTab === "new"
              ? "New applications for your church only. After you change status, they leave this list; remaining items appear subdued until you work the next one."
              : showSubUnitTabs
                ? "Select a sub-unit, then use the status tabs below to work applications."
                : "Move applications to In Progress, Accepted, or Rejected."}{" "}
            Sub-unit names are managed by Super / General Admin only.
          </p>
        </header>
      ) : null}
      <div className="sa-card">
        <div className="sa-card-body sa-unit-tab-row" role="tablist" aria-label="Application status">
          {statusTabs.map((tab) => (
            <button
              key={tab}
              type="button"
              className={`sa-unit-tab-btn ${statusTab === tab ? "is-active" : ""}`}
              onClick={() => setStatusTab(tab)}
              title={queueStatusTabLabel(tab)}
            >
              {queueStatusTabLabel(tab)}
            </button>
          ))}
        </div>
        {(onOverdueTab || onCriticalTab) && (
          <div className="sa-card-body" style={{ borderBottom: "1px solid var(--sa-border)", paddingTop: 4 }}>
            <span className="sa-text-muted sa-text-sm">
              {onCriticalTab
                ? "Critical applications have exceeded the critical overdue threshold (Settings). They remain New or In Progress until a leader acts."
                : "Overdue is not a status — records stay New or In Progress and appear here once past the threshold (Settings). Sorted by days beyond threshold, highest first."}
            </span>
          </div>
        )}
        {showIntakeFilters && (
          <div className="sa-filters">
            {(!isLeader || isServiceLeader) && (
              <div className="sa-search" style={{ minWidth: 240 }}>
                <span className="sa-search-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>
                <input placeholder="Search name, email, phone…" value={filters.search} onChange={setFilter("search")} />
              </div>
            )}
            {!isLeader && (
              <select
                className="sa-select"
                value={filters.unit_id}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, unit_id: e.target.value, sub_unit: "" }))
                }
              >
                <option value="">All Units</option>
                {unitOpts.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            )}
            {!isLeader && showGlobalSubUnitFilter && (
              <select className="sa-select" value={filters.sub_unit} onChange={setFilter("sub_unit")}>
                <option value="">All sub-units</option>
                {globalSubUnitOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            )}
            {!isLeader && statusTab === "all" && (
              <select className="sa-select" value={filters.status} onChange={setFilter("status")}>
                <option value="">All Statuses</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {pipelineStatusLabel(s)}
                  </option>
                ))}
              </select>
            )}
            <select className="sa-select" value={filters.sex} onChange={setFilter("sex")}>
              <option value="">All Genders</option><option value="Male">Male</option><option value="Female">Female</option>
            </select>
            <div className="sa-date-range-group" aria-label="Date range">
              <div className="sa-date-field">
                <span className="sa-date-placeholder" aria-hidden="true">Start date</span>
                <input
                  id="queue-filter-from"
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
                  id="queue-filter-to"
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
              onClick={() => {
                if (isServiceLeader) setSubUnitTab("");
                setFilters({
                  search: "",
                  unit_id: "",
                  sub_unit: "",
                  status: "",
                  sex: "",
                  from: "",
                  to: "",
                  sort: "submitted_at",
                  dir: "DESC",
                });
              }}
            >
              Clear
            </button>
            <span className="sa-text-muted sa-text-sm" style={{ marginLeft: "auto", whiteSpace: "nowrap" }}>
              {onOverdueTab
                ? `${pag.total} overdue`
                : onCriticalTab
                  ? `${pag.total} critical`
                  : `${pag.total} result${pag.total !== 1 ? "s" : ""}`}
            </span>
          </div>
        )}

        <div className="sa-table-wrap">
          {loading ? (
            <SmhLoader label="Loading queue" />
          ) : tableRows.length === 0 ? (
            <div className="sa-empty">
              <div className="sa-empty-icon">{onOverdueTab ? "✓" : "📋"}</div>
              <div className="sa-empty-text">
                {onOverdueTab
                  ? "No overdue applications in your scope."
                  : onCriticalTab
                    ? "No critical applications in your scope."
                    : "No registrations found."}
              </div>
            </div>
          ) : (
            <table className="sa-table">
              <thead>
                <tr>
                  <th>#</th>
                  {!isLeader && <th>Photo</th>}
                  <th>Name</th>
                  {isLeader ? <th>Sub-unit</th> : <th>Unit</th>}
                  {!isLeader && (
                    <>
                      <th>Phone</th>
                      <th>Email</th>
                    </>
                  )}
                  <th>Status</th>
                  <th>Submitted</th>
                  {onSlaTab ? <th>Days overdue</th> : null}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((r, rowIdx) => (
                  <Fragment key={r.id}>
                    <tr
                      className={[
                        onSlaTab ? (onCriticalTab ? "sa-row-critical" : "sa-row-overdue") : "",
                        leaderNewQueueTab && rowIdx > 0 ? "sa-queue-row-muted" : "",
                        leaderNewQueueTab && rowIdx === 0 ? "sa-queue-row-focus" : "",
                      ].filter(Boolean).join(" ") || undefined}
                      style={!isLeader ? { cursor: "pointer" } : undefined}
                    >
                      <td className="sa-text-muted">{r.id}</td>
                      {!isLeader && (
                        <td>
                          {r.photo_path ? (
                            <img src={r.photo_path} className="sa-photo" alt="" />
                          ) : (
                            <div className="sa-photo-placeholder">{(r.first_name?.[0] || "?").toUpperCase()}</div>
                          )}
                        </td>
                      )}
                      <td>
                        <div className="sa-fw-600">{fullName(r)}</div>
                        {!isLeader && r.other_names && <div className="sa-text-sm sa-text-muted">{r.other_names}</div>}
                      </td>
                      {isLeader ? (
                        <td>{r.sub_unit || "—"}</td>
                      ) : (
                        <td>
                          <div>{r.unit_name}</div>
                          {r.sub_unit && <div className="sa-text-sm sa-text-muted">{r.sub_unit}</div>}
                        </td>
                      )}
                      {!isLeader && (
                        <>
                          <td>{r.phone1}</td>
                          <td className="sa-truncate">{r.email || "—"}</td>
                        </>
                      )}
                      <td>
                        <ApplicationStatusBadge row={r} />
                      </td>
                      <td className="sa-text-muted">{fmtDate(r.submitted_at)}</td>
                      {onSlaTab ? (
                        <td className="sa-fw-600">{Number(r.days_overdue ?? 0)}</td>
                      ) : null}
                      <td>
                        <div className="sa-table-actions">
                          <button
                            type="button"
                            className="sa-btn sa-btn-ghost sa-btn-sm"
                            onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                          >
                            {expanded === r.id ? "▲" : "▼"}
                            {isLeader ? " Details" : ""}
                          </button>
                          {isLeader ? (
                            <>
                              {queueActionVisible(statusTab, "accepted") ? (
                                <button
                                  type="button"
                                  className="sa-btn sa-btn-primary sa-btn-sm"
                                  disabled={leaderActionDisabled(r, "accepted")}
                                  onClick={() => requestLeaderAccept(r)}
                                >
                                  Accept
                                </button>
                              ) : null}
                              {queueActionVisible(statusTab, "in_progress") ? (
                                <button
                                  type="button"
                                  className="sa-btn sa-btn-outline sa-btn-sm"
                                  disabled={leaderActionDisabled(r, "in_progress")}
                                  onClick={() => quickLeaderStatus(r.id, "in_progress")}
                                >
                                  In progress
                                </button>
                              ) : null}
                              {queueActionVisible(statusTab, "rejected") ? (
                                <button
                                  type="button"
                                  className="sa-btn sa-btn-danger sa-btn-sm"
                                  disabled={leaderActionDisabled(r, "rejected")}
                                  onClick={() => quickLeaderStatus(r.id, "rejected")}
                                >
                                  Reject
                                </button>
                              ) : null}
                              {!isServiceLeader && (
                                <button
                                  type="button"
                                  className="sa-btn sa-btn-outline sa-btn-sm"
                                  disabled={leaderActionDisabled(r, "archived")}
                                  onClick={() => quickLeaderStatus(r.id, "archived")}
                                >
                                  Archive
                                </button>
                              )}
                            </>
                          ) : (
                            <button
                              type="button"
                              className="sa-btn sa-btn-outline sa-btn-sm"
                              onClick={() => setStatusModal({ id: r.id, status: r.status, notes: r.notes || "", row: r })}
                            >
                              Update
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expanded === r.id && (
                      <tr className="sa-detail-row">
                        <td colSpan={tableColSpan}>
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
      </div>

      <StatusModal open={!!statusModal} data={statusModal} onClose={() => setStatusModal(null)} onSave={updateStatus} allowedStatus={allowedStatus} />
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


function StatusModal({ open, data, onClose, onSave, allowedStatus }) {
  const [status, setStatus] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (data) { setStatus(data.status); setNotes(data.notes || ""); } }, [data]);
  async function save() { setSaving(true); await onSave(data.id, status, notes, data.status); setSaving(false); }
  return (
    <Modal open={open} onClose={onClose} title="Update Application Status" size="sm" footer={<><button className="sa-btn sa-btn-outline" onClick={onClose}>Cancel</button><button className="sa-btn sa-btn-primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</button></>}>
      <div className="sa-field"><label className="sa-label">Status</label><select className="sa-field-select" value={status} onChange={(e) => setStatus(e.target.value)}>{(allowedStatus(data?.status) || []).map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</select></div>
      <div className="sa-field"><label className="sa-label">Notes (optional)</label><textarea className="sa-textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add internal notes…" /></div>
    </Modal>
  );
}

export function Field({ label, value }) {
  return (
    <div className="sa-detail-field">
      <div className="sa-detail-label">{label}</div>
      <div className="sa-detail-value">{value}</div>
    </div>
  );
}

