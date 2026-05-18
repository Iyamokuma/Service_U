import { useState, useEffect, useCallback, useMemo } from "react";
import { api } from "../api.js";
import { Modal } from "../components/Modal.jsx";
import { SearchableSelect } from "../components/SearchableSelect.jsx";
import { fetchChurchesCatalog } from "../../lib/churchesCatalog.js";
import { satelliteSitesForBranch } from "../satelliteSites.js";
import { useToast } from "../components/Toast.jsx";
import { useAdminAuth } from "../AdminContext.jsx";
import { SERVICE_UNITS } from "../../data.js";
import {
  BRANCH_COUNTRIES,
  branchCountryLabel,
  branchStateLabel,
  branchStatesForCountry,
  coerceStateForCountry,
} from "../branchRegions.js";
import {
  isRootSuperAdmin,
  isGlobalAdminRole,
  isServiceUnitLeader,
  isCountrySuperAdmin,
  isStateSuperAdmin,
  canCountryAdminManageRole,
} from "../roles.js";

const ROLES = [
  { value: "general_admin", label: "General Admin", desc: "Full global access except creating Super Admin accounts." },
  { value: "data_entry_admin", label: "Data Entry Admin", desc: "Global registration intake and updates; custom home dashboard; no platform settings." },
  { value: "super_admin", label: "Super Admin", desc: "Platform owner — full access including Super Admin accounts." },
  {
    value: "country_super_admin",
    label: "Country Admin",
    desc: "Scoped to one country: view, filter, and action applications, members, admins, and audit within that country.",
  },
  { value: "state_super_admin", label: "State Branch Admin", desc: "Supervisory: one state / satellites, filters only, mostly view-only on intake." },
  { value: "satellite_church_admin", label: "Satellite Pastor Admin", desc: "Pastoral oversight for one satellite: team leaders, unit requests, announcements, registrations in branch scope." },
  { value: "service_unit_leader", label: "Service Unit Leader", desc: "Can manage assigned service unit." },
  { value: "sub_unit_leader", label: "Sub-unit Leader", desc: "Can manage assigned sub-unit only." },
];

function roleDisplayLabel(role) {
  if (!role) return "—";
  if (role === "general_admin") return "General Admin";
  if (role === "data_entry_admin") return "Data Entry Admin";
  if (role === "super_admin") return "Super Admin";
  if (role === "country_super_admin") return "Country Admin";
  if (role === "state_super_admin") return "State Branch Admin";
  if (role === "satellite_church_admin") return "Satellite Pastor Admin";
  return String(role)
    .split("_")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ""))
    .filter(Boolean)
    .join(" ");
}

function adminInitials(fullName) {
  const parts = String(fullName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatAdminScope(a) {
  if (a.role === "super_admin" || a.role === "general_admin") return "Global";
  if (a.role === "data_entry_admin") return "All branches (data entry)";
  if (a.role === "country_super_admin") return `${a.branch_country_label || a.branch_country || "—"} (country)`;
  if (a.role === "state_super_admin") return `${a.branch_country_label || "—"} · ${a.branch_state_label || "—"}`;
  if (a.role === "satellite_church_admin") {
    const geo = `${a.branch_country_label || "—"} · ${a.branch_state_label || "—"}`;
    const sat = String(a.satellite_site || "").trim();
    return sat ? `${geo} · ${sat}` : geo;
  }
  if (a.role === "service_unit_leader" || a.role === "sub_unit_leader") {
    const unitPart = `${a.service_unit_name || "—"}${a.sub_unit_name ? ` · ${a.sub_unit_name}` : ""}`;
    const hasGeo =
      String(a.branch_country || "").trim() ||
      String(a.branch_state || "").trim() ||
      String(a.satellite_site || "").trim();
    if (hasGeo) {
      const geo = `${a.branch_country_label || "—"} · ${a.branch_state_label || "—"}`;
      const sat = String(a.satellite_site || "").trim();
      return sat ? `${unitPart} · ${geo} · ${sat}` : `${unitPart} · ${geo}`;
    }
    return unitPart;
  }
  return `${a.service_unit_name || "—"}${a.sub_unit_name ? ` / ${a.sub_unit_name}` : ""}`;
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function fmtDate(str) {
  if (!str) return "Never";
  const d = new Date(str);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** Login names are globally unique; seed NG country admin uses country.admin — use per-country ids. */
function suggestedCountryAdminUsername(countryCode) {
  const cc = String(countryCode || "").trim().toLowerCase();
  return cc ? `${cc}.country.admin` : "";
}

function shouldAutoFillCountryAdminUsername(username) {
  const u = String(username || "").trim().toLowerCase();
  return !u || u === "country.admin" || /^[a-z]{2}\.country\.admin$/.test(u);
}

const ROLES_WITH_COUNTRY = [
  "country_super_admin",
  "state_super_admin",
  "satellite_church_admin",
  "service_unit_leader",
  "sub_unit_leader",
];

const ROLES_WITH_STATE = [
  "state_super_admin",
  "satellite_church_admin",
  "service_unit_leader",
  "sub_unit_leader",
];

const PENDING_ADMIN_REQUEST_STATUSES = new Set(["open", "in_review"]);

function adminFromRequestPayload(req) {
  const payload = req?.payload && typeof req.payload === "object" ? req.payload : {};
  return payload.admin && typeof payload.admin === "object" ? payload.admin : {};
}

function occupiedCountryCodes(admins, pendingRequests, excludeId) {
  const set = new Set();
  for (const a of admins || []) {
    if (excludeId != null && Number(a.id) === Number(excludeId)) continue;
    if (a.role === "country_super_admin" && a.branch_country) {
      set.add(String(a.branch_country).toUpperCase());
    }
  }
  for (const req of pendingRequests || []) {
    if (!PENDING_ADMIN_REQUEST_STATUSES.has(req.status)) continue;
    const admin = adminFromRequestPayload(req);
    if (admin.role === "country_super_admin" && admin.branch_country) {
      set.add(String(admin.branch_country).toUpperCase());
    }
  }
  return set;
}

function occupiedStateCodes(admins, pendingRequests, countryCode, excludeId) {
  const cc = String(countryCode || "").toUpperCase();
  const set = new Set();
  for (const a of admins || []) {
    if (excludeId != null && Number(a.id) === Number(excludeId)) continue;
    if (
      a.role === "state_super_admin" &&
      String(a.branch_country || "").toUpperCase() === cc &&
      a.branch_state
    ) {
      set.add(String(a.branch_state).toUpperCase());
    }
  }
  for (const req of pendingRequests || []) {
    if (!PENDING_ADMIN_REQUEST_STATUSES.has(req.status)) continue;
    const admin = adminFromRequestPayload(req);
    if (
      admin.role === "state_super_admin" &&
      String(admin.branch_country || "").toUpperCase() === cc &&
      admin.branch_state
    ) {
      set.add(String(admin.branch_state).toUpperCase());
    }
  }
  return set;
}

function validateAdminForm(form) {
  if (ROLES_WITH_COUNTRY.includes(form.role) && !String(form.branch_country || "").trim()) {
    return "Country is required for this role.";
  }
  if (ROLES_WITH_STATE.includes(form.role) && !String(form.branch_state || "").trim()) {
    return "State / region is required for this role.";
  }
  if (form.role === "service_unit_leader" && !form.service_unit_id) {
    return "Service unit is required.";
  }
  if (form.role === "sub_unit_leader") {
    if (!form.service_unit_id) return "Service unit is required.";
    if (!form.sub_unit_name) return "Sub-unit is required.";
  }
  if (form.role === "satellite_church_admin" && !String(form.satellite_site || "").trim()) {
    return "Select a satellite church for this pastor admin.";
  }
  return "";
}

export function AdminUsers({ data, units, reload }) {
  const toast = useToast();
  const { admin: me } = useAdminAuth();
  const isRootSuper = isRootSuperAdmin(me?.role);
  const isGlobalAdmin = isGlobalAdminRole(me?.role);
  const isCountryAdmin = isCountrySuperAdmin(me?.role);
  const isStateAdmin = isStateSuperAdmin(me?.role);
  const isServiceLeader = isServiceUnitLeader(me?.role);
  const isSatellitePastor = me?.role === "satellite_church_admin";
  const [showInactive, setShowInactive] = useState(false);
  const scopedAdmins = (data?.data ?? []).filter((a) => {
    if (isGlobalAdmin) return true;
    if (isCountryAdmin) {
      if (!a?.branch_country) return false;
      return String(a.branch_country).toUpperCase() === String(me?.branch_country || "").toUpperCase();
    }
    if (isStateAdmin) {
      const cc = String(me?.branch_country || "").toUpperCase();
      const st = String(me?.branch_state || "").toUpperCase();
      if (!a?.branch_country || String(a.branch_country).toUpperCase() !== cc) return false;
      if (!st) return true;
      return String(a.branch_state || "").toUpperCase() === st;
    }
    if (isServiceLeader) return a.role === "sub_unit_leader" && Number(a.service_unit_id) === Number(me.service_unit_id);
    if (isSatellitePastor) {
      const cc = String(me?.branch_country || "").toUpperCase();
      const st = String(me?.branch_state || "").toUpperCase();
      const sat = String(me?.satellite_site || "").trim();
      const sameBranch =
        String(a.branch_country || "").toUpperCase() === cc && String(a.branch_state || "").toUpperCase() === st;
      const sameSat = String(a.satellite_site || "").trim() === sat;
      const leaderRole = a.role === "service_unit_leader" || a.role === "sub_unit_leader";
      return leaderRole && sameBranch && sameSat;
    }
    return false;
  });
  const admins = scopedAdmins.filter(
    (a) => showInactive || Number(a.is_active) === 1
  );
  const activeAdminCount = scopedAdmins.filter((a) => Number(a.is_active) === 1).length;
  const fallbackUnits = SERVICE_UNITS.map((u, idx) => ({
    id: u.id,
    name: u.name,
    sort_order: idx,
    sub_units: (u.subs || []).map((name, i) => ({ id: `${u.id}-${i}`, name, unit_id: u.id })),
  }));
  const unitList = (units?.data?.length ? units.data : fallbackUnits)
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || String(a.name).localeCompare(String(b.name)));

  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [pendingAdminRequests, setPendingAdminRequests] = useState([]);

  const loadPendingAdminRequests = useCallback(() => {
    if (!isCountryAdmin && !isGlobalAdmin) return;
    api
      .requests({ per_page: 500, page: 1 })
      .then((res) => {
        setPendingAdminRequests(
          (res.data || []).filter(
            (r) => r.request_type === "admin_account" && PENDING_ADMIN_REQUEST_STATUSES.has(r.status),
          ),
        );
      })
      .catch(() => setPendingAdminRequests([]));
  }, [isCountryAdmin, isGlobalAdmin]);

  useEffect(() => {
    loadPendingAdminRequests();
  }, [loadPendingAdminRequests, data]);

  async function save(form) {
    const validationMsg = validateAdminForm(form);
    if (validationMsg) {
      toast(validationMsg, "error");
      return;
    }
    setSaving(true);
    try {
      if (isCountryAdmin && !form.id) {
        const { id: _id, is_active: _active, viewer: _viewer, ...admin } = form;
        await api.createRequest({
          request_type: "admin_account",
          message: `New ${roleDisplayLabel(form.role)}: ${form.full_name} (${form.username})`,
          payload: { admin },
        });
        toast("Request submitted. Super Admin must approve before the account is active.", "success");
        loadPendingAdminRequests();
      } else {
        const payload = { ...form, viewer: me };
        if (form.id) await api.updateAdmin(form.id, payload);
        else await api.createAdmin(payload);
        toast(form.id ? "Admin updated." : "Admin created.", "success");
      }
      setModal(null);
      reload();
    } catch (e) { toast(e.message, "error"); }
    finally { setSaving(false); }
  }

  async function toggleActive(admin) {
    try {
      await api.updateAdmin(admin.id, { is_active: admin.is_active ? 0 : 1, viewer: me });
      toast(admin.is_active ? "Admin deactivated." : "Admin activated.", "success");
      reload();
    } catch (e) { toast(e.message, "error"); }
  }

  async function removeAdmin(admin) {
    if (Number(admin.id) === Number(me?.id)) {
      toast("You cannot delete your own account.", "error");
      return;
    }
    const ok = window.confirm(`Delete ${admin.full_name} (${admin.username}) permanently?`);
    if (!ok) return;
    try {
      await api.deleteAdmin(admin.id, { viewer: me });
      toast("Admin deleted.", "success");
      reload();
    } catch (e) {
      toast(e.message, "error");
    }
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>
            {isSatellitePastor ? "Team leaders" : isCountryAdmin ? "Country admin accounts" : "Admin Accounts"}
          </h2>
          <p className="sa-text-muted sa-text-sm">
            {isCountryAdmin
              ? `${admins.length} administrator${admins.length !== 1 ? "s" : ""} in ${branchCountryLabel(me?.branch_country) || "your country"}. Manage branch, state, service unit, and sub-unit admins. Service units and sub-units are created by Super / General Admin only.`
              : isSatellitePastor
                ? `${admins.length} leader account${admins.length !== 1 ? "s" : ""} under your satellite.`
                : `${admins.length} visible / ${scopedAdmins.length} total administrator${scopedAdmins.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {(isGlobalAdmin || isServiceLeader || isCountryAdmin || isSatellitePastor) && !isStateAdmin && (
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
          )}
          {(isGlobalAdmin || isServiceLeader || isCountryAdmin || isSatellitePastor) && (
            <button
              className="sa-btn sa-btn-primary"
              onClick={() =>
                setModal({
                  role: isCountryAdmin
                    ? "state_super_admin"
                    : isServiceLeader
                      ? "sub_unit_leader"
                      : isSatellitePastor
                        ? "service_unit_leader"
                        : "general_admin",
                  service_unit_id: isServiceLeader ? me.service_unit_id : "",
                  branch_country: isCountryAdmin || isSatellitePastor ? me.branch_country : "",
                  branch_state: isSatellitePastor ? me.branch_state : "",
                  satellite_site: isSatellitePastor ? me.satellite_site : "",
                })
              }
            >
              {isCountryAdmin
                ? "+ Request Branch/State Admin"
                : isServiceLeader
                  ? "+ New sub-unit admin"
                  : isSatellitePastor
                    ? "+ New team leader"
                    : "+ New Admin"}
            </button>
          )}
        </div>
      </div>

      <div className="sa-card">
        <div className="sa-table-wrap">
          {admins.length === 0 ? (
            <div className="sa-empty"><div className="sa-empty-icon">👤</div><div className="sa-empty-text">No admins yet.</div></div>
          ) : (
            <table className="sa-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Scope</th>
                  <th>Status</th>
                  <th>Last Login</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div className="sa-avatar" style={{ width: 30, height: 30, fontSize: 12 }}>
                          {adminInitials(a.full_name)}
                        </div>
                        <div className="sa-fw-600">{a.full_name}</div>
                        {a.id === +me.id && <span className="sa-badge viewer">You</span>}
                      </div>
                    </td>
                    <td className="sa-text-muted">{a.username}</td>
                    <td>{a.email}</td>
                    <td><span className={`sa-badge ${a.role}`}>{roleDisplayLabel(a.role)}</span></td>
                    <td className="sa-text-muted sa-text-sm">{formatAdminScope(a)}</td>
                    <td><span className={`sa-badge ${a.is_active ? "active" : "inactive"}`}>{a.is_active ? "Active" : "Inactive"}</span></td>
                    <td className="sa-text-muted">{fmtDate(a.last_login)}</td>
                    <td>
                      <div className="sa-table-actions">
                        {!isStateAdmin &&
                          !(a.role === "super_admin" && !isRootSuper) &&
                          (!isCountryAdmin || canCountryAdminManageRole(a.role)) && (
                          <button className="sa-btn sa-btn-outline sa-btn-sm" onClick={() => setModal(a)}>
                            Edit
                          </button>
                        )}
                        {!isStateAdmin &&
                          a.id !== +me.id &&
                          !(a.role === "super_admin" && !isRootSuper) &&
                          (!isCountryAdmin || canCountryAdminManageRole(a.role)) && (
                          <button className="sa-btn sa-btn-danger sa-btn-sm" onClick={() => toggleActive(a)}>
                            {a.is_active ? "Deactivate" : "Activate"}
                          </button>
                        )}
                        {!isStateAdmin &&
                          ((isGlobalAdmin && a.id !== +me.id && (isRootSuper || a.role !== "super_admin")) ||
                          (isSatellitePastor && a.id !== +me.id) ||
                          (isServiceLeader && a.id !== +me.id && a.role === "sub_unit_leader") ||
                          (isCountryAdmin && a.id !== +me.id && canCountryAdminManageRole(a.role))) && (
                          <button className="sa-btn sa-btn-danger sa-btn-sm" onClick={() => removeAdmin(a)}>
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {isCountryAdmin && pendingAdminRequests.length > 0 && (
        <div className="sa-card" style={{ marginBottom: 16 }}>
          <div className="sa-card-body">
            <h3 className="sa-fw-600" style={{ fontSize: 14, marginBottom: 8 }}>
              Pending approval ({pendingAdminRequests.length})
            </h3>
            <p className="sa-text-muted sa-text-sm" style={{ marginBottom: 12 }}>
              These accounts are in review with Super Admin and cannot sign in until approved.
            </p>
            <ul className="sa-text-sm" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
              {pendingAdminRequests.map((r) => {
                const a = adminFromRequestPayload(r);
                return (
                  <li key={r.id}>
                    {a.full_name || "—"} · {roleDisplayLabel(a.role)} ·{" "}
                    <span className="sa-badge in_review">In review</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      <AdminModal
        open={!!modal}
        data={modal}
        unitList={unitList}
        existingAdmins={data?.data ?? []}
        pendingAdminRequests={pendingAdminRequests}
        onClose={() => setModal(null)}
        onSave={save}
        saving={saving}
        me={me}
      />
    </>
  );
}

function AdminModal({ open, data, unitList, existingAdmins, pendingAdminRequests = [], onClose, onSave, saving, me }) {
  const isRootSuper = isRootSuperAdmin(me?.role);
  const isGlobalAdmin = isGlobalAdminRole(me?.role);
  const isCountryAdmin = isCountrySuperAdmin(me?.role);
  const isSatellitePastor = me?.role === "satellite_church_admin";
  const isServiceLeader = isServiceUnitLeader(me?.role);
  const isEdit = !!data?.id;
  const emptyForm = useCallback(
    () => ({
      full_name: "",
      username: "",
      email: "",
      password: "",
      role: isCountryAdmin
        ? "satellite_church_admin"
        : isServiceLeader
          ? "sub_unit_leader"
          : isSatellitePastor
            ? "service_unit_leader"
            : isGlobalAdmin
              ? "general_admin"
              : "service_unit_leader",
      service_unit_id: isServiceLeader ? me?.service_unit_id : "",
      sub_unit_name: "",
      branch_country: isCountryAdmin || isSatellitePastor ? me?.branch_country || "" : "",
      branch_state: isSatellitePastor ? coerceStateForCountry(me?.branch_country || "", me?.branch_state || "") : "",
      satellite_site: isSatellitePastor ? me?.satellite_site || "" : "",
      is_active: 1,
    }),
    [
      isServiceLeader,
      isGlobalAdmin,
      isCountryAdmin,
      isSatellitePastor,
      me?.service_unit_id,
      me?.branch_country,
      me?.branch_state,
      me?.satellite_site,
    ]
  );
  const [form, setForm] = useState(() => emptyForm());
  const [churches, setChurches] = useState([]);

  useEffect(() => {
    if (!open) {
      setChurches([]);
      return;
    }
    fetchChurchesCatalog()
      .then(setChurches)
      .catch(() => setChurches([]));
  }, [open]);

  const satelliteOptions = useMemo(
    () => satelliteSitesForBranch(churches, form.branch_country, form.branch_state),
    [churches, form.branch_country, form.branch_state],
  );

  useEffect(() => {
    if (!open) {
      setForm(emptyForm());
      return;
    }
    if (!data) {
      setForm(emptyForm());
      return;
    }
    if (data.id) {
      const country = data.branch_country || "";
      setForm({
        id: data.id,
        full_name: data.full_name || "",
        username: data.username || "",
        email: data.email || "",
        password: "",
        role:
          data.role ||
          (isServiceLeader ? "sub_unit_leader" : isGlobalAdmin ? "general_admin" : "service_unit_leader"),
        service_unit_id: data.service_unit_id || (isServiceLeader ? me?.service_unit_id : ""),
        sub_unit_name: data.sub_unit_name || "",
        branch_country: country,
        branch_state: coerceStateForCountry(country, data.branch_state || ""),
        satellite_site: data.satellite_site || "",
        is_active: data.is_active ?? 1,
      });
    } else {
      const country = data.branch_country || "";
      setForm({
        ...emptyForm(),
        role: data.role ?? emptyForm().role,
        service_unit_id: data.service_unit_id ?? emptyForm().service_unit_id,
        sub_unit_name: data.sub_unit_name ?? "",
        branch_country: country,
        branch_state: coerceStateForCountry(country, data.branch_state || ""),
        satellite_site: data.satellite_site ?? "",
      });
    }
  }, [open, data, emptyForm, isServiceLeader, isGlobalAdmin, me?.service_unit_id]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const selectedUnit = unitList.find((u) => Number(u.id) === Number(form.service_unit_id));

  const takenCountries = occupiedCountryCodes(existingAdmins, pendingAdminRequests, isEdit ? form.id : null);
  const countryOptions = BRANCH_COUNTRIES.filter((c) => {
    if (form.role !== "country_super_admin" || isEdit) return true;
    return !takenCountries.has(String(c.code).toUpperCase());
  });
  const takenStates = occupiedStateCodes(
    existingAdmins,
    pendingAdminRequests,
    form.branch_country,
    isEdit ? form.id : null,
  );
  const stateOptions = branchStatesForCountry(form.branch_country).filter((s) => {
    if (form.role !== "state_super_admin" || isEdit) return true;
    return !takenStates.has(String(s.code).toUpperCase());
  });

  return (
    <Modal
      open={open} onClose={onClose}
      title={
        isEdit
          ? isServiceLeader
            ? "Edit sub-unit admin"
            : "Edit Admin Account"
          : isCountryAdmin
            ? "Request new admin account"
            : isServiceLeader
              ? "Create sub-unit admin"
              : isSatellitePastor
                ? "Create team leader"
                : "Create Admin Account"
      }
      size="md"
      footer={<>
        <button className="sa-btn sa-btn-outline" onClick={onClose}>Cancel</button>
        <button className="sa-btn sa-btn-primary" onClick={() => onSave(form)} disabled={saving}>
          {saving
            ? "Saving…"
            : isEdit
              ? "Save Changes"
              : isCountryAdmin
                ? "Submit request"
                : "Create"}
        </button>
      </>}
    >
      <div className="sa-form-row">
        <div className="sa-field">
          <label className="sa-label">Full Name <span className="sa-required">*</span></label>
          <input className="sa-input" value={form.full_name} onChange={set("full_name")} placeholder="John Doe" />
        </div>
        <div className="sa-field">
          <label className="sa-label">Username <span className="sa-required">*</span></label>
          <input
            className="sa-input"
            value={form.username}
            onChange={set("username")}
            placeholder={form.role === "country_super_admin" ? "gb.country.admin" : "johndoe"}
            disabled={isEdit}
          />
          {form.role === "country_super_admin" && !isEdit && (
            <div className="sa-field-hint">
              Usernames are unique across all countries. For United Kingdom use something like{" "}
              <strong>gb.country.admin</strong> (not <strong>country.admin</strong>, which is already used).
            </div>
          )}
        </div>
      </div>
      <div className="sa-field">
        <label className="sa-label">Email <span className="sa-required">*</span></label>
        <input className="sa-input" type="email" value={form.email} onChange={set("email")} placeholder="john@example.com" />
      </div>
      <div className="sa-field">
        <label className="sa-label">{isEdit ? "New Password (leave blank to keep current)" : "Password"} {!isEdit && <span className="sa-required">*</span>}</label>
        <input className="sa-input" type="password" value={form.password} onChange={set("password")} placeholder="Min 8 characters" />
      </div>
      <div className="sa-form-row">
        <div className="sa-field">
          <label className="sa-label">Role</label>
          <select
            className="sa-field-select"
            value={form.role}
            disabled={isServiceLeader}
            onChange={(e) => {
              const role = e.target.value;
              const geoRoles = ROLES_WITH_COUNTRY;
              setForm((f) => {
                const next = {
                  ...f,
                  role,
                  service_unit_id: ["service_unit_leader", "sub_unit_leader"].includes(role) ? f.service_unit_id : "",
                  sub_unit_name: role === "sub_unit_leader" ? f.sub_unit_name : "",
                  branch_country: geoRoles.includes(role)
                    ? f.branch_country
                    : isCountryAdmin
                      ? me?.branch_country || ""
                      : "",
                  branch_state: ROLES_WITH_STATE.includes(role) ? f.branch_state : "",
                  satellite_site: role === "satellite_church_admin" ? f.satellite_site : "",
                };
                if (
                  role === "country_super_admin" &&
                  shouldAutoFillCountryAdminUsername(f.username)
                ) {
                  next.username = suggestedCountryAdminUsername(next.branch_country);
                }
                return next;
              });
            }}
          >
            {(isGlobalAdmin
              ? ROLES.filter((r) => {
                  if (r.value === "super_admin") {
                    if (!isEdit) return false;
                    return isRootSuper;
                  }
                  return true;
                })
              : isCountryAdmin
                ? ROLES.filter((r) =>
                    ["satellite_church_admin", "state_super_admin", "service_unit_leader", "sub_unit_leader"].includes(
                      r.value,
                    ),
                  )
                : isSatellitePastor
                  ? ROLES.filter((r) => ["service_unit_leader", "sub_unit_leader"].includes(r.value))
                  : ROLES.filter((r) => r.value === "sub_unit_leader")
            ).map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <div className="sa-field-hint">{ROLES.find((r) => r.value === form.role)?.desc}</div>
        </div>
        {!(isCountryAdmin && !isEdit) ? (
          <div className="sa-field">
            <label className="sa-label">Status</label>
            <select className="sa-field-select" value={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: +e.target.value }))}>
              <option value={1}>Active</option>
              <option value={0}>Inactive</option>
            </select>
          </div>
        ) : (
          <div className="sa-field">
            <label className="sa-label">Status</label>
            <div className="sa-field-hint" style={{ marginTop: 6 }}>
              Submitted as <span className="sa-badge in_review">In review</span> until Super Admin approves.
            </div>
          </div>
        )}
      </div>

      {ROLES_WITH_COUNTRY.includes(form.role) && (
        <div className="sa-form-row">
          <div className="sa-field">
            <label className="sa-label">Country <span className="sa-required">*</span></label>
            <select
              className="sa-field-select"
              value={form.branch_country}
              onChange={(e) => {
                const branch_country = e.target.value;
                setForm((f) => {
                  const next = {
                    ...f,
                    branch_country,
                    branch_state: "",
                    satellite_site: f.role === "satellite_church_admin" ? "" : f.satellite_site,
                  };
                  if (
                    f.role === "country_super_admin" &&
                    shouldAutoFillCountryAdminUsername(f.username)
                  ) {
                    next.username = suggestedCountryAdminUsername(branch_country);
                  }
                  return next;
                });
              }}
              disabled={isCountryAdmin || (form.role === "country_super_admin" && isEdit)}
            >
              <option value="">Select country</option>
              {(form.role === "country_super_admin" && !isEdit ? countryOptions : BRANCH_COUNTRIES).map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
            {form.role === "country_super_admin" && !isEdit && countryOptions.length === 0 && (
              <div className="sa-field-hint">Every country already has a Country Admin (or one pending approval).</div>
            )}
          </div>
          {ROLES_WITH_STATE.includes(form.role) && (
            <div className="sa-field">
              <label className="sa-label">State / region <span className="sa-required">*</span></label>
              <select
                className="sa-field-select"
                value={form.branch_state}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    branch_state: e.target.value,
                    satellite_site: f.role === "satellite_church_admin" ? "" : f.satellite_site,
                  }))
                }
                disabled={!form.branch_country || (form.role === "state_super_admin" && isEdit)}
              >
                <option value="">{form.branch_country ? "Select state" : "Select country first"}</option>
                {(form.role === "state_super_admin" && !isEdit
                  ? stateOptions
                  : branchStatesForCountry(form.branch_country)
                ).map((s) => (
                  <option key={s.code} value={s.code}>{s.name}</option>
                ))}
              </select>
              {form.role === "state_super_admin" && !isEdit && form.branch_country && stateOptions.length === 0 && (
                <div className="sa-field-hint">Every state in this country already has a State Branch Admin (or one pending approval).</div>
              )}
            </div>
          )}
        </div>
      )}

      {form.role === "satellite_church_admin" && (
        <div className="sa-field">
          <label className="sa-label">Satellite church <span className="sa-required">*</span></label>
          <SearchableSelect
            value={form.satellite_site}
            onChange={(e) => setForm((f) => ({ ...f, satellite_site: e.target.value }))}
            options={satelliteOptions}
            disabled={!form.branch_country || !form.branch_state}
            placeholder={
              !form.branch_country
                ? "Select country first"
                : !form.branch_state
                  ? "Select state first"
                  : "Select satellite church"
            }
            searchPlaceholder="Search satellite churches…"
            emptyMessage="No satellite churches in this state"
            searchAriaLabel="Filter satellite churches"
          />
          <div className="sa-field-hint">
            {form.branch_country && form.branch_state && satelliteOptions.length === 0
              ? "No churches listed for this state yet. Add branches via Data Entry or approve a location request first."
              : "Pastor admin is scoped to this satellite within the selected state."}
          </div>
        </div>
      )}

      {["service_unit_leader", "sub_unit_leader"].includes(form.role) && (
        <div className="sa-form-row">
          <div className="sa-field">
            <label className="sa-label">Service Unit <span className="sa-required">*</span></label>
            <select
              className="sa-field-select"
              value={form.service_unit_id}
              onChange={(e) => setForm((f) => ({ ...f, service_unit_id: e.target.value, sub_unit_name: "" }))}
              disabled={isServiceLeader}
            >
              <option value="">Select unit</option>
              {(isServiceLeader ? unitList.filter((u) => Number(u.id) === Number(me.service_unit_id)) : unitList).map(
                (u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ),
              )}
            </select>
            {isSatellitePastor && (
              <div className="sa-field-hint">Choose the ministry unit this person leads (must already exist, or request a new unit first).</div>
            )}
          </div>
          {form.role === "sub_unit_leader" && (
            <div className="sa-field">
              <label className="sa-label">Sub-unit <span className="sa-required">*</span></label>
              <select className="sa-field-select" value={form.sub_unit_name} onChange={(e) => setForm((f) => ({ ...f, sub_unit_name: e.target.value }))}>
                <option value="">Select sub-unit</option>
                {(selectedUnit?.sub_units || []).map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

