import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { useAdminAuth } from "../AdminContext.jsx";
import { useToast } from "../components/Toast.jsx";
import { SatellitePastorAdminModal } from "../components/SatellitePastorAdminModal.jsx";
import { branchCountryLabel, branchStateLabel } from "../branchRegions.js";
import { fetchChurchesCatalog } from "../../lib/churchesCatalog.js";
import { availableSatellitesForState } from "../stateSatelliteForm.js";
import { exportCsv } from "../exportCsv.js";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtDate(str) {
  if (!str) return "Never";
  const d = new Date(str);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export function StateUsers({ admins: adminsPayload, reload }) {
  const toast = useToast();
  const { admin: me } = useAdminAuth();
  const countryCode = String(me?.branch_country || "").toUpperCase();
  const stateCode = String(me?.branch_state || "").toUpperCase();
  const countryLabel = branchCountryLabel(countryCode);
  const stateLabel = branchStateLabel(countryCode, stateCode) || stateCode;

  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [satelliteModal, setSatelliteModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [churches, setChurches] = useState([]);

  const allAdmins = adminsPayload?.data ?? [];

  const stateAdmins = useMemo(
    () =>
      allAdmins.filter(
        (a) =>
          String(a.branch_country || "").toUpperCase() === countryCode &&
          String(a.branch_state || "").toUpperCase() === stateCode,
      ),
    [allAdmins, countryCode, stateCode],
  );

  const satellitePastors = useMemo(
    () => stateAdmins.filter((a) => a.role === "satellite_church_admin"),
    [stateAdmins],
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

  useEffect(() => {
    fetchChurchesCatalog().then(setChurches).catch(() => setChurches([]));
  }, []);

  const vacantSatellites = useMemo(
    () => availableSatellitesForState(churches, countryCode, stateCode, stateAdmins, pendingRequests),
    [churches, countryCode, stateCode, stateAdmins, pendingRequests],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return satellitePastors.filter((a) => {
      if (!showInactive && Number(a.is_active) !== 1) return false;
      if (!q) return true;
      const sat = a.satellite_site || "";
      const hay = [a.full_name, a.username, a.email, sat].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [satellitePastors, search, showInactive]);

  async function saveSatellitePastor(form, validationError) {
    if (validationError) {
      toast(validationError, "error");
      return;
    }
    if (!form) return;
    setSaving(true);
    try {
      const payload = { ...form, viewer: me };
      if (form.id) await api.updateAdmin(form.id, payload);
      else await api.createAdmin(payload);
      toast(form.id ? "Satellite Pastor Admin updated." : "Satellite Pastor Admin created.", "success");
      setSatelliteModal(null);
      reload?.();
      loadPending();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(row) {
    try {
      await api.updateAdmin(row.id, { is_active: row.is_active ? 0 : 1, viewer: me });
      toast(row.is_active ? "Account deactivated." : "Account activated.", "success");
      reload?.();
      loadPending();
    } catch (e) {
      toast(e.message, "error");
    }
  }

  function handleExport() {
    if (!filtered.length) {
      toast("No records to export.", "error");
      return;
    }
    exportCsv(filtered, {
      filename: `satellite-pastor-admins-${stateCode}-${new Date().toISOString().slice(0, 10)}.csv`,
      columns: [
        { key: "full_name", label: "Full Name" },
        { key: "username", label: "Username" },
        { key: "email", label: "Email" },
        { key: "satellite_site", label: "Satellite church" },
        { key: "is_active", label: "Status", format: (v) => (Number(v) === 1 ? "Active" : "Inactive") },
        { key: "last_login", label: "Last login", format: (v) => (v ? fmtDate(v) : "Never") },
      ],
    });
    toast(`Exported ${filtered.length} record${filtered.length !== 1 ? "s" : ""}.`, "success");
  }

  return (
    <>
      <header className="sa-admins-hero" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="sa-admins-title">Users</h1>
          <p className="sa-admins-subtitle">
            Satellite Pastor Admins for {stateLabel}
            {countryLabel ? `, ${countryLabel}` : ""}. Scope is locked to your state — one active account per
            satellite church.
          </p>
        </div>
        <div className="sa-admins-hero-actions">
          <button type="button" className="sa-btn sa-btn-outline" onClick={handleExport} disabled={!filtered.length}>
            Export CSV
          </button>
          {vacantSatellites.length > 0 && (
            <button type="button" className="sa-btn sa-btn-primary" onClick={() => setSatelliteModal({})}>
              + New Satellite Pastor Admin
            </button>
          )}
        </div>
      </header>

      <div className="sa-stat-grid" style={{ marginBottom: 20 }}>
        <div className="sa-stat-card">
          <div className="sa-stat-header">
            <span className="sa-stat-label">Satellite Pastor Admins</span>
          </div>
          <div className="sa-stat-value">
            {satellitePastors.filter((a) => Number(a.is_active) === 1).length}
          </div>
          <div className="sa-stat-trend">Active accounts</div>
        </div>
        <div className="sa-stat-card">
          <div className="sa-stat-header">
            <span className="sa-stat-label">Vacant satellites</span>
          </div>
          <div className="sa-stat-value">{vacantSatellites.length}</div>
          <div className="sa-stat-trend">
            {vacantSatellites.length > 0 ? "Ready to assign" : "All covered"}
          </div>
        </div>
      </div>

      <div className="sa-card">
        <div className="sa-card-head sa-admins-card-head">
          <div>
            <div className="sa-card-title">Satellite Pastor Admins</div>
            <p className="sa-admins-card-meta sa-text-muted sa-text-sm" style={{ margin: "4px 0 0" }}>
              They manage service units, team leaders, and registrations for their satellite church only.
            </p>
          </div>
        </div>
        <div className="sa-admins-filters" role="toolbar" aria-label="Filter users">
          <div className="sa-search">
            <span className="sa-search-icon" aria-hidden>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              type="search"
              placeholder="Search name, email, satellite…"
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
            {filtered.length} result{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="sa-table-wrap">
          {filtered.length === 0 ? (
            <div className="sa-empty">
              <div className="sa-empty-text">
                {satellitePastors.length === 0
                  ? "No Satellite Pastor Admins yet. Create one for each satellite church you want to assign."
                  : "No accounts match your filters."}
              </div>
            </div>
          ) : (
            <table className="sa-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Satellite church</th>
                  <th>Status</th>
                  <th>Last login</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <div className="sa-fw-600">{a.full_name}</div>
                      <div className="sa-text-sm sa-text-muted">{a.username}</div>
                    </td>
                    <td className="sa-text-sm">{a.satellite_site || "—"}</td>
                    <td>
                      <span className={`sa-badge ${a.is_active ? "active" : "inactive"}`}>
                        {a.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="sa-text-sm sa-text-muted">{fmtDate(a.last_login)}</td>
                    <td>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          className="sa-btn sa-btn-outline sa-btn-sm"
                          onClick={() => setSatelliteModal(a)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="sa-btn sa-btn-outline sa-btn-sm"
                          onClick={() => toggleActive(a)}
                        >
                          {a.is_active ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <SatellitePastorAdminModal
        open={!!satelliteModal}
        countryCode={countryCode}
        stateCode={stateCode}
        churches={churches}
        existingAdmins={stateAdmins}
        pendingRequests={pendingRequests}
        initialSatellite={satelliteModal?.initialSatellite || ""}
        editData={satelliteModal?.id ? satelliteModal : null}
        saving={saving}
        onClose={() => setSatelliteModal(null)}
        onSave={saveSatellitePastor}
      />
    </>
  );
}
