import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import {
  branchCountryCodeFromIso2,
  branchCountryLabel,
  branchStateCodeForLocationPublish,
  branchStateLabel,
} from "../branchRegions.js";
import { useToast } from "../components/Toast.jsx";
import { useAdminAuth } from "../AdminContext.jsx";
import { roleDisplayLabel } from "../roles.js";
import { isActingAsStateAdmin } from "../adminViewMode.js";
import { useAdminGeoFilters } from "../AdminGeoFilterContext.jsx";
import {
  emitAdminCatalogChanged,
  emitAdminRequestsChanged,
  readFocusRequestId,
  setFocusRequestId,
  ADMIN_REQUESTS_CHANGED,
} from "../adminLiveRefresh.js";
import { matchesRequestGeo } from "../geoFilterUtils.js";

function parsePayload(raw) {
  if (!raw || typeof raw !== "object") return null;
  return raw;
}

function ServiceUnitProposalSummary({ payload }) {
  if (!payload) return null;
  const subs = Array.isArray(payload.subUnitNames) ? payload.subUnitNames : [];
  return (
    <div className="sa-text-sm" style={{ lineHeight: 1.45, maxWidth: 420 }}>
      <div>
        <span className="sa-text-muted">Unit name:</span> {payload.unitName || "—"}
      </div>
      {payload.description ? (
        <div style={{ marginTop: 6 }}>
          <span className="sa-text-muted">Notes:</span> {payload.description}
        </div>
      ) : null}
      {subs.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <span className="sa-text-muted">Proposed sub-units:</span> {subs.join(", ")}
        </div>
      )}
      <div style={{ marginTop: 6 }} className="sa-text-muted">
        From branch {String(payload.branchCountry || "—")} / {String(payload.branchState || "—")}
        {payload.satelliteSite ? ` · ${payload.satelliteSite}` : ""}
      </div>
    </div>
  );
}

function AdminAccountProposalSummary({ payload }) {
  if (!payload?.admin) return null;
  const a = payload.admin;
  const cc = a.branch_country ? branchCountryLabel(a.branch_country) : "—";
  const st = a.branch_state && a.branch_country ? branchStateLabel(a.branch_country, a.branch_state) : a.branch_state || "";
  return (
    <div className="sa-text-sm" style={{ lineHeight: 1.45, maxWidth: 420 }}>
      <div>
        <span className="sa-text-muted">Name:</span> {a.full_name || "—"}
      </div>
      <div>
        <span className="sa-text-muted">Username:</span> {a.username || "—"}
      </div>
      <div>
        <span className="sa-text-muted">Email:</span> {a.email || "—"}
      </div>
      <div>
        <span className="sa-text-muted">Role:</span> {roleDisplayLabel(a.role)}
      </div>
      {(a.branch_country || a.branch_state || a.satellite_site) && (
        <div style={{ marginTop: 6 }} className="sa-text-muted">
          Scope: {cc}
          {st ? ` · ${st}` : ""}
          {a.satellite_site ? ` · ${a.satellite_site}` : ""}
          {a.service_unit_id ? ` · unit #${a.service_unit_id}` : ""}
          {a.sub_unit_name ? ` · ${a.sub_unit_name}` : ""}
        </div>
      )}
    </div>
  );
}

function LocationProposalSummary({ payload }) {
  if (!payload) return null;
  const bc = branchCountryCodeFromIso2(payload.countryIso2);
  const countryLabel = bc ? branchCountryLabel(bc) : String(payload.countryName || payload.countryIso2 || "");
  const sc = bc && payload.stateName ? branchStateCodeForLocationPublish(bc, payload.stateName) : "";
  const stateLabel = sc
    ? branchStateLabel(bc, sc)
    : String(payload.stateName || "—");
  const sats = Array.isArray(payload.satelliteChurches) ? payload.satelliteChurches : [];
  return (
    <div className="sa-text-sm" style={{ lineHeight: 1.45, maxWidth: 420 }}>
      <div>
        <span className="sa-text-muted">Continent:</span> {payload.continent || "—"}
      </div>
      <div>
        <span className="sa-text-muted">Country:</span> {countryLabel} ({String(payload.countryIso2 || "").toUpperCase()})
      </div>
      <div>
        <span className="sa-text-muted">State:</span> {stateLabel}
      </div>
      <div>
        <span className="sa-text-muted">LGA / city:</span> {payload.lgaName || "—"}
      </div>
      {sats.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <span className="sa-text-muted">Satellites:</span> {sats.join(", ")}
        </div>
      )}
    </div>
  );
}

export function Requests() {
  const toast = useToast();
  const { admin, viewMode } = useAdminAuth();
  const isSuper = admin?.role === "super_admin" || admin?.role === "general_admin";
  const geo = useAdminGeoFilters();
  const actingAsState = isActingAsStateAdmin(admin, viewMode);
  const isCountryAdmin = admin?.role === "country_super_admin" && !actingAsState;
  const canApprove = isSuper || isCountryAdmin;
  const [rows, setRows] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [focusRequestId, setFocusRequestIdState] = useState(() => readFocusRequestId());

  const load = async () => {
    try {
      const base = { per_page: 500, page: 1 };
      const res = await api.requests(isSuper ? base : { ...base, from_admin_id: admin.id });
      setRows(res.data || []);
    } catch (e) {
      toast(e.message, "error");
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const onRefresh = () => load();
    window.addEventListener(ADMIN_REQUESTS_CHANGED, onRefresh);
    return () => window.removeEventListener(ADMIN_REQUESTS_CHANGED, onRefresh);
  }, []);

  useEffect(() => {
    const id = readFocusRequestId();
    if (!id) return;
    setFocusRequestIdState(id);
    setTypeFilter("all");
    setStatusFilter("all");
  }, []);

  const requestTypeLabel = (r) => {
    if (r.request_type === "location_catalog") return "Location proposal";
    if (r.request_type === "service_unit_proposal") return "Service unit proposal";
    if (r.request_type === "admin_account") return "Admin account";
    return (r.request_type || "general").replace(/_/g, " ");
  };

  const statusLabel = (status) => {
    if (status === "in_review") return "In review";
    return status;
  };

  const isTerminal = (status) => status === "rejected" || status === "resolved";

  const visibleRows = useMemo(() => {
    const q = String(search || "").trim().toLowerCase();
    return rows
      .filter((r) => (isSuper && geo.enabled ? matchesRequestGeo(r, geo.filters) || Number(r.id) === focusRequestId : true))
      .filter((r) => (statusFilter === "all" ? true : String(r.status || "") === statusFilter))
      .filter((r) => (typeFilter === "all" ? true : String(r.request_type || "") === typeFilter))
      .filter((r) => {
        if (!q) return true;
        const p = parsePayload(r.payload);
        const hay = [
          r.from_name,
          r.from_role,
          r.message,
          r.request_type,
          p?.admin?.full_name,
          p?.admin?.username,
          p?.admin?.email,
          p?.unitName,
          p?.stateName,
          p?.lgaName,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
  }, [rows, isSuper, geo.enabled, geo.filters, statusFilter, typeFilter, search, focusRequestId]);

  const approve = async (r) => {
    try {
      if (r.request_type === "service_unit_proposal") {
        await api.approveServiceUnitProposal(r.id);
        toast("Service unit created. Request marked resolved.", "success");
      } else {
        await api.updateRequest(r.id, { status: "approved" });
        if (r.request_type === "location_catalog") {
          toast("Branches are live on the registration form for that country and region.", "success");
        } else if (r.request_type === "admin_account") {
          toast("Admin account created and is now active.", "success");
        } else {
          toast("Request approved.", "success");
        }
      }
      load();
      emitAdminRequestsChanged();
      if (r.request_type === "location_catalog") {
        emitAdminCatalogChanged();
      }
      setFocusRequestId(null);
      setFocusRequestIdState(null);
    } catch (e) {
      toast(e.message, "error");
    }
  };

  const reject = async (id) => {
    try {
      await api.updateRequest(id, { status: "rejected" });
      toast("Request rejected.", "success");
      load();
      emitAdminRequestsChanged();
      setFocusRequestId(null);
      setFocusRequestIdState(null);
    } catch (e) {
      toast(e.message, "error");
    }
  };

  const resolve = async (id) => {
    try {
      await api.updateRequest(id, { status: "resolved" });
      toast("Request marked resolved.", "success");
      load();
      emitAdminRequestsChanged();
      setFocusRequestId(null);
      setFocusRequestIdState(null);
    } catch (e) {
      toast(e.message, "error");
    }
  };

  return (
    <div className="sa-card">
      <div className="sa-card-body" style={{ borderBottom: "1px solid var(--sa-border)", padding: "14px 20px" }}>
        <p className="sa-text-muted sa-text-sm" style={{ margin: 0 }}>
          {canApprove
            ? "Review and action pending requests from your downline administrators."
            : "Track the status of requests you\u2019ve submitted for approval."}
        </p>
      </div>
      <div className="sa-filters">
        <div className="sa-search" style={{ minWidth: 240 }}>
          <span className="sa-search-icon" aria-hidden>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
          <input
            type="search"
            placeholder="Search requester, type, details…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="sa-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="all">All types</option>
          <option value="admin_account">Admin account</option>
          <option value="service_unit_proposal">Service unit proposal</option>
          <option value="location_catalog">Location proposal</option>
          <option value="general">General</option>
        </select>
        <select className="sa-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="in_review">In review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="resolved">Resolved</option>
        </select>
        <span className="sa-text-muted sa-text-sm">{visibleRows.length} request{visibleRows.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="sa-table-wrap">
        <table className="sa-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>From</th>
              <th>Role</th>
              <th>Type</th>
              <th>Details</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="sa-text-muted sa-text-sm" style={{ padding: 24, textAlign: "center" }}>
                  {geo.hasFilters ? "No requests match the scope filters above." : "No requests yet."}
                </td>
              </tr>
            ) : null}
            {visibleRows.map((r) => {
              const p = parsePayload(r.payload);
              const isLoc = r.request_type === "location_catalog";
              const isUnit = r.request_type === "service_unit_proposal";
              const isAdminAcct = r.request_type === "admin_account";
              return (
                <tr key={r.id} className={Number(r.id) === focusRequestId ? "sa-row-focus" : undefined}>
                  <td>{new Date(r.created_at).toLocaleString()}</td>
                  <td>{r.from_name}</td>
                  <td>
                    <span className={`sa-badge ${r.from_role || "general"}`}>{roleDisplayLabel(r.from_role)}</span>
                  </td>
                  <td>
                    <span className="sa-badge open">{requestTypeLabel(r)}</span>
                  </td>
                  <td>
                    {isLoc && p ? (
                      <LocationProposalSummary payload={p} />
                    ) : isUnit && p ? (
                      <ServiceUnitProposalSummary payload={p} />
                    ) : isAdminAcct && p ? (
                      <AdminAccountProposalSummary payload={p} />
                    ) : (
                      <span className="sa-text-sm">{r.message}</span>
                    )}
                  </td>
                  <td>
                    <span className={`sa-badge ${r.status}`}>{statusLabel(r.status)}</span>
                  </td>
                  <td>
                    {canApprove && Number(r.from_admin_id) !== Number(admin?.id) ? (
                      <div className="sa-table-actions">
                        <button
                          type="button"
                          className="sa-btn sa-btn-primary sa-btn-sm"
                          disabled={
                            isTerminal(r.status) ||
                            r.status === "approved" ||
                            (isUnit && r.status !== "open") ||
                            (isAdminAcct && r.status !== "in_review")
                          }
                          onClick={() => approve(r)}
                        >
                          {isUnit
                            ? "Approve & create unit"
                            : isAdminAcct
                              ? "Approve & create admin"
                              : "Approve"}
                        </button>
                        <button
                          type="button"
                          className="sa-btn sa-btn-danger sa-btn-sm"
                          disabled={isTerminal(r.status) || r.status === "rejected"}
                          onClick={() => reject(r.id)}
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          className="sa-btn sa-btn-outline sa-btn-sm"
                          disabled={isTerminal(r.status)}
                          onClick={() => resolve(r.id)}
                        >
                          Mark as resolved
                        </button>
                      </div>
                    ) : (
                      <span className="sa-text-muted sa-text-sm">
                        {Number(r.from_admin_id) === Number(admin?.id) ? "Your request" : "—"}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
