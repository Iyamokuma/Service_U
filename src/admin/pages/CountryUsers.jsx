import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { useAdminAuth } from "../AdminContext.jsx";
import { useToast } from "../components/Toast.jsx";
import { StateBranchAdminModal } from "../components/StateBranchAdminModal.jsx";
import { branchCountryLabel, branchStateLabel, branchStatesForCountry } from "../branchRegions.js";
import { countryAdminHomeState } from "../roles.js";
import {
  availableHomeStatesForCountryAdmin,
  availableStatesForCountryAdmin,
  occupiedStateCodes,
} from "../stateAdminForm.js";
import { exportCsv } from "../exportCsv.js";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtDate(str) {
  if (!str) return "Never";
  const d = new Date(str);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export function CountryUsers({ admins: adminsPayload, reload }) {
  const toast = useToast();
  const { admin: me, refreshAdmin } = useAdminAuth();
  const countryCode = String(me?.branch_country || "").toUpperCase();
  const countryLabel = branchCountryLabel(countryCode);
  const myHomeState = countryAdminHomeState(me);

  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [stateModal, setStateModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savingHome, setSavingHome] = useState(false);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [homeStateDraft, setHomeStateDraft] = useState(myHomeState);

  const allAdmins = adminsPayload?.data ?? [];

  const countryAdmins = useMemo(
    () => allAdmins.filter((a) => String(a.branch_country || "").toUpperCase() === countryCode),
    [allAdmins, countryCode],
  );

  const stateBranchAdmins = useMemo(
    () => countryAdmins.filter((a) => a.role === "state_super_admin"),
    [countryAdmins],
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
    setHomeStateDraft(myHomeState);
  }, [myHomeState]);

  const vacantStates = useMemo(
    () => availableStatesForCountryAdmin(countryCode, countryAdmins, pendingRequests),
    [countryCode, countryAdmins, pendingRequests],
  );

  const homeStateOptions = useMemo(
    () => availableHomeStatesForCountryAdmin(countryCode, countryAdmins, pendingRequests, me?.id),
    [countryCode, countryAdmins, pendingRequests, me?.id],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return stateBranchAdmins.filter((a) => {
      if (!showInactive && Number(a.is_active) !== 1) return false;
      if (!q) return true;
      const stateLabel = branchStateLabel(a.branch_country, a.branch_state) || a.branch_state || "";
      const hay = [a.full_name, a.username, a.email, stateLabel].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [stateBranchAdmins, search, showInactive]);

  async function saveStateAdmin(form, validationError) {
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
      toast(form.id ? "State Branch Admin updated." : "State Branch Admin created.", "success");
      setStateModal(null);
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

  async function saveHomeState() {
    setSavingHome(true);
    try {
      await api.updateAdmin(me.id, { branch_state: homeStateDraft || "", viewer: me });
      await refreshAdmin?.();
      toast(homeStateDraft ? "Headquarters state saved." : "Headquarters state cleared.", "success");
      reload?.();
      loadPending();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setSavingHome(false);
    }
  }

  function handleExport() {
    if (!filtered.length) {
      toast("No records to export.", "error");
      return;
    }
    exportCsv(filtered, {
      filename: `state-branch-admins-${countryCode}-${new Date().toISOString().slice(0, 10)}.csv`,
      columns: [
        { key: "full_name", label: "Full Name" },
        { key: "username", label: "Username" },
        { key: "email", label: "Email" },
        {
          key: "branch_state",
          label: "State",
          format: (v, row) => branchStateLabel(row.branch_country, v) || v || "—",
        },
        { key: "is_active", label: "Status", format: (v) => (Number(v) === 1 ? "Active" : "Inactive") },
        { key: "last_login", label: "Last login", format: (v) => (v ? fmtDate(v) : "Never") },
      ],
    });
    toast(`Exported ${filtered.length} record${filtered.length !== 1 ? "s" : ""}.`, "success");
  }

  const takenCount = occupiedStateCodes(countryAdmins, pendingRequests, countryCode).size;
  const statesTotal = branchStatesForCountry(countryCode).length;

  return (
    <>
      <header className="sa-admins-hero" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="sa-admins-title">Users</h1>
          <p className="sa-admins-subtitle">
            State Branch Admins for {countryLabel || "your country"}. You oversee all states nationally; optionally
            designate one state as your headquarters where you also act as State Branch Admin.
          </p>
        </div>
        <div className="sa-admins-hero-actions">
          <button type="button" className="sa-btn sa-btn-outline" onClick={handleExport} disabled={!filtered.length}>
            Export CSV
          </button>
          {vacantStates.length > 0 && (
            <button type="button" className="sa-btn sa-btn-primary" onClick={() => setStateModal({})}>
              + New State Branch Admin
            </button>
          )}
        </div>
      </header>

      <div className="sa-card" style={{ marginBottom: 20 }}>
        <div className="sa-card-head">
          <span className="sa-card-title">Your headquarters state (optional)</span>
        </div>
        <div className="sa-card-body">
          <p className="sa-text-muted sa-text-sm" style={{ margin: "0 0 16px", maxWidth: 640, lineHeight: 1.55 }}>
            Your headquarters state is set when your Country Admin account is created (or assigned automatically on
            first login). You oversee all states nationally from here, and use the sidebar toggle to switch into State
            Branch Admin tools for this state. That state cannot have a separate State Branch Admin account.
          </p>
          <div className="sa-form-row" style={{ alignItems: "flex-end", maxWidth: 520 }}>
            <div className="sa-field" style={{ flex: 1 }}>
              <label className="sa-label">Headquarters state</label>
              <select
                className="sa-field-select"
                value={homeStateDraft}
                onChange={(e) => setHomeStateDraft(e.target.value)}
              >
                <option value="">None — country oversight only</option>
                {homeStateOptions.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="sa-btn sa-btn-primary"
              onClick={saveHomeState}
              disabled={savingHome || homeStateDraft === myHomeState}
            >
              {savingHome ? "Saving…" : "Save headquarters"}
            </button>
          </div>
          {myHomeState && (
            <p className="sa-text-sm sa-text-muted" style={{ margin: "12px 0 0" }}>
              Current headquarters:{" "}
              <strong>{branchStateLabel(countryCode, myHomeState) || myHomeState}</strong> — you appear as leader for
              this state on Workforce. Use the <strong>Country / State</strong> switch in the sidebar to manage satellite
              pastor admins for this state on Workforce and Users.
            </p>
          )}
        </div>
      </div>

      <div className="sa-stat-grid" style={{ marginBottom: 20 }}>
        <div className="sa-stat-card">
          <div className="sa-stat-header">
            <span className="sa-stat-label">State Branch Admins</span>
          </div>
          <div className="sa-stat-value">
            {stateBranchAdmins.filter((a) => Number(a.is_active) === 1).length}
          </div>
          <div className="sa-stat-trend">Active accounts</div>
        </div>
        <div className="sa-stat-card">
          <div className="sa-stat-header">
            <span className="sa-stat-label">States covered</span>
          </div>
          <div className="sa-stat-value">
            {takenCount}/{statesTotal}
          </div>
          <div className="sa-stat-trend">Including your HQ if set</div>
        </div>
        <div className="sa-stat-card">
          <div className="sa-stat-header">
            <span className="sa-stat-label">Vacant states</span>
          </div>
          <div className="sa-stat-value">{vacantStates.length}</div>
        </div>
      </div>

      <div className="sa-card">
        <div className="sa-card-head sa-admins-card-head">
          <div>
            <div className="sa-card-title">State Branch Admins</div>
            <p className="sa-admins-card-meta sa-text-muted sa-text-sm" style={{ margin: "4px 0 0" }}>
              One active account per state. They create and manage satellite pastor admins in their state.
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
              placeholder="Search name, email, state…"
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
                {stateBranchAdmins.length === 0
                  ? "No State Branch Admins yet. Create one for each state you want to assign."
                  : "No accounts match your filters."}
              </div>
            </div>
          ) : (
            <table className="sa-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>State</th>
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
                    <td className="sa-text-sm">
                      {branchStateLabel(a.branch_country, a.branch_state) || a.branch_state || "—"}
                    </td>
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
                          onClick={() => setStateModal(a)}
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

      <StateBranchAdminModal
        open={!!stateModal}
        countryCode={countryCode}
        existingAdmins={countryAdmins}
        pendingRequests={pendingRequests}
        initialStateCode={stateModal?.initialState || ""}
        editData={stateModal?.id ? stateModal : null}
        saving={saving}
        onClose={() => setStateModal(null)}
        onSave={saveStateAdmin}
      />
    </>
  );
}
