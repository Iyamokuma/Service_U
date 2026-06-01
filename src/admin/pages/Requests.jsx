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
    if (!isSuper || !geo.enabled) return rows;
    return rows.filter((r) => matchesRequestGeo(r, geo.filters));
  }, [rows, isSuper, geo.enabled, geo.filters]);

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
    } catch (e) {
      toast(e.message, "error");
    }
  };

  const reject = async (id) => {
    try {
      await api.updateRequest(id, { status: "rejected" });
      toast("Request rejected.", "success");
      load();
    } catch (e) {
      toast(e.message, "error");
    }
  };

  const resolve = async (id) => {
    try {
      await api.updateRequest(id, { status: "resolved" });
      toast("Request marked resolved.", "success");
      load();
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
                <tr key={r.id}>
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
            {rows.length === 0 && (
              <tr>
                <td colSpan="7" style={{ textAlign: "center", padding: "20px" }}>
                  No requests found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
