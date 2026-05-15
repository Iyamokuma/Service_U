import { useState, useEffect, useCallback } from "react";
import { api } from "../api.js";
import { Modal } from "../components/Modal.jsx";
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

export function AdminUsers({ data, units, reload }) {
  const toast = useToast();
  const { admin: me } = useAdminAuth();
  const isRootSuper = isRootSuperAdmin(me?.role);
  const isGlobalAdmin = isGlobalAdminRole(me?.role);
  const isCountryAdmin = me?.role === "country_super_admin";
  const isServiceLeader = isServiceUnitLeader(me?.role);
  const isSatellitePastor = me?.role === "satellite_church_admin";
  const [showInactive, setShowInactive] = useState(false);
  const scopedAdmins = (data?.data ?? []).filter((a) => {
    if (isGlobalAdmin) return true;
    if (isCountryAdmin) {
      if (!a?.branch_country) return false;
      return String(a.branch_country).toUpperCase() === String(me?.branch_country || "").toUpperCase();
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

  async function save(form) {
    setSaving(true);
    try {
      const payload = { ...form, viewer: me };
      if (form.id) await api.updateAdmin(form.id, payload);
      else await api.createAdmin(payload);
      toast(form.id ? "Admin updated." : "Admin created.", "success");
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
          {(isGlobalAdmin || isServiceLeader || isCountryAdmin || isSatellitePastor) && (
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
                        {!(a.role === "super_admin" && !isRootSuper) &&
                          (!isCountryAdmin || canCountryAdminManageRole(a.role)) && (
                          <button className="sa-btn sa-btn-outline sa-btn-sm" onClick={() => setModal(a)}>
                            Edit
                          </button>
                        )}
                        {a.id !== +me.id &&
                          !(a.role === "super_admin" && !isRootSuper) &&
                          (!isCountryAdmin || canCountryAdminManageRole(a.role)) && (
                          <button className="sa-btn sa-btn-danger sa-btn-sm" onClick={() => toggleActive(a)}>
                            {a.is_active ? "Deactivate" : "Activate"}
                          </button>
                        )}
                        {((isGlobalAdmin && a.id !== +me.id && (isRootSuper || a.role !== "super_admin")) ||
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

      <AdminModal
        open={!!modal}
        data={modal}
        unitList={unitList}
        onClose={() => setModal(null)}
        onSave={save}
        saving={saving}
        me={me}
      />
    </>
  );
}

function AdminModal({ open, data, unitList, onClose, onSave, saving, me }) {
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

  return (
    <Modal
      open={open} onClose={onClose}
      title={
        isEdit
          ? isServiceLeader
            ? "Edit sub-unit admin"
            : "Edit Admin Account"
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
          {saving ? "Saving…" : (isEdit ? "Save Changes" : "Create")}
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
            <motion className="sa-field-hint">
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
              const branchRoles = ["country_super_admin", "state_super_admin", "satellite_church_admin"];
              setForm((f) => {
                const next = {
                  ...f,
                  role,
                  service_unit_id: ["service_unit_leader", "sub_unit_leader"].includes(role) ? f.service_unit_id : "",
                  sub_unit_name: role === "sub_unit_leader" ? f.sub_unit_name : "",
                  branch_country: branchRoles.includes(role) ? f.branch_country : "",
                  branch_state: ["state_super_admin", "satellite_church_admin"].includes(role) ? f.branch_state : "",
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
        <div className="sa-field">
          <label className="sa-label">Status</label>
          <select className="sa-field-select" value={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: +e.target.value }))}>
            <option value={1}>Active</option>
            <option value={0}>Inactive</option>
          </select>
        </div>
      </div>

      {["country_super_admin", "state_super_admin", "satellite_church_admin"].includes(form.role) && (
        <div className="sa-form-row">
          <div className="sa-field">
            <label className="sa-label">Country <span className="sa-required">*</span></label>
            <select
              className="sa-field-select"
              value={form.branch_country}
              onChange={(e) => {
                const branch_country = e.target.value;
                setForm((f) => {
                  const next = { ...f, branch_country, branch_state: "" };
                  if (
                    f.role === "country_super_admin" &&
                    shouldAutoFillCountryAdminUsername(f.username)
                  ) {
                    next.username = suggestedCountryAdminUsername(branch_country);
                  }
                  return next;
                });
              }}
              disabled={isCountryAdmin}
            >
              <option value="">Select country</option>
              {BRANCH_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          </div>
          {["state_super_admin", "satellite_church_admin"].includes(form.role) && (
            <div className="sa-field">
              <label className="sa-label">State / region <span className="sa-required">*</span></label>
              <select
                className="sa-field-select"
                value={form.branch_state}
                onChange={(e) => setForm((f) => ({ ...f, branch_state: e.target.value }))}
                disabled={!form.branch_country}
              >
                <option value="">{form.branch_country ? "Select state" : "Select country first"}</option>
                {branchStatesForCountry(form.branch_country).map((s) => (
                  <option key={s.code} value={s.code}>{s.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {form.role === "satellite_church_admin" && (
        <div className="sa-field">
          <label className="sa-label">Satellite / assembly label</label>
          <input
            className="sa-input"
            value={form.satellite_site}
            onChange={set("satellite_site")}
            placeholder="e.g. Satellite name or assembly (optional)"
          />
          <div className="sa-field-hint">Stored on the admin record for display; registration scoping uses country + state.</div>
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

