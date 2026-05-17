import { useEffect, useMemo, useState } from "react";
import { Modal } from "./Modal.jsx";
import { BRANCH_COUNTRIES, branchStatesForCountry } from "../branchRegions.js";
import { fetchChurchesCatalog } from "../../lib/churchesCatalog.js";

const ADMIN_ROLE_OPTIONS = [
  { value: "general_admin", label: "General Admin" },
  { value: "country_super_admin", label: "Country Admin" },
  { value: "state_super_admin", label: "State Branch Admin" },
  { value: "satellite_church_admin", label: "Satellite / Branch Admin" },
];

const LEADER_MODES = [
  { value: "all", label: "All leaders (service unit & sub-unit)" },
  { value: "service_unit", label: "Service unit leaders only" },
  { value: "sub_unit", label: "Sub-unit leaders (select unit + sub-unit)" },
];

const emptyForm = () => ({
  title: "",
  body: "",
  destination_type: "members",
  medium_email: true,
  medium_sms: false,
  scheduled_at: "",
  members: { branch_country: "", branch_state: "", satellite_site: "", service_unit_id: "", sub_unit: "" },
  leaders: { mode: "all", branch_country: "", branch_state: "", service_unit_id: "", sub_unit: "" },
  admins: { roles: ["general_admin"], branch_country: "", branch_state: "" },
});

export function AnnouncementCreateModal({ open, onClose, onSubmit, saving, unitList }) {
  const [form, setForm] = useState(emptyForm);
  const [churches, setChurches] = useState([]);

  useEffect(() => {
    if (!open) {
      setForm(emptyForm());
      return;
    }
    fetchChurchesCatalog().then(setChurches).catch(() => setChurches([]));
  }, [open]);

  const satellites = useMemo(() => {
    const cc = String(form.members.branch_country || "").toUpperCase();
    const st = String(form.members.branch_state || "").toUpperCase();
    const names = new Set();
    for (const ch of churches) {
      if (cc && String(ch.branch_country || "").toUpperCase() !== cc) continue;
      if (st && String(ch.branch_state || "").toUpperCase() !== st) continue;
      const n = String(ch.name || "").trim();
      if (n) names.add(n);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [churches, form.members.branch_country, form.members.branch_state]);

  const selectedUnit = unitList.find((u) => Number(u.id) === Number(form.members.service_unit_id));
  const leaderUnit = unitList.find((u) => Number(u.id) === Number(form.leaders.service_unit_id));

  function buildPayload(workflow_action) {
    const destination_type = form.destination_type;
    let destination_config = {};
    if (destination_type === "members") {
      destination_config = { ...form.members };
    } else if (destination_type === "leaders") {
      destination_config = { ...form.leaders };
    } else {
      destination_config = { ...form.admins };
    }
    return {
      title: form.title.trim(),
      body: form.body.trim(),
      destination_type,
      destination_config,
      medium_email: form.medium_email,
      medium_sms: form.medium_sms,
      workflow_action,
      scheduled_at: workflow_action === "schedule" ? form.scheduled_at : "",
    };
  }

  function validate() {
    if (!form.title.trim() || !form.body.trim()) return "Title and message are required.";
    if (!form.medium_email && !form.medium_sms) return "Select at least one medium: Email or SMS.";
    if (form.destination_type === "members" && !form.members.branch_country) {
      return "Select a country for member announcements.";
    }
    if (form.destination_type === "leaders") {
      if (form.leaders.mode === "service_unit" && !form.leaders.service_unit_id) {
        return "Select a service unit for leader targeting.";
      }
      if (form.leaders.mode === "sub_unit") {
        if (!form.leaders.service_unit_id) return "Select a service unit.";
        if (!form.leaders.sub_unit) return "Select a sub-unit for sub-unit leader targeting.";
      }
    }
    if (form.destination_type === "admins" && (!form.admins.roles || form.admins.roles.length === 0)) {
      return "Select at least one admin role.";
    }
    return "";
  }

  function submit(workflow_action) {
    const err = validate();
    if (err) return onSubmit(null, err);
    if (workflow_action === "schedule" && !form.scheduled_at) {
      return onSubmit(null, "Pick a date and time to schedule.");
    }
    onSubmit(buildPayload(workflow_action), null);
  }

  const setDest = (type) => setForm((f) => ({ ...f, destination_type: type }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create announcement"
      size="lg"
      footer={
        <>
          <button type="button" className="sa-btn sa-btn-outline" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="sa-btn sa-btn-outline" onClick={() => submit("draft")} disabled={saving}>
            Save draft
          </button>
          <button type="button" className="sa-btn sa-btn-outline" onClick={() => submit("schedule")} disabled={saving}>
            Schedule
          </button>
          <button type="button" className="sa-btn sa-btn-primary" onClick={() => submit("send")} disabled={saving}>
            {saving ? "Sending…" : "Send now"}
          </button>
        </>
      }
    >
      <div className="sa-field">
        <label className="sa-label">Title <span className="sa-required">*</span></label>
        <input
          className="sa-input"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          placeholder="Announcement title"
        />
      </div>

      <div className="sa-field">
        <label className="sa-label">Message <span className="sa-required">*</span></label>
        <textarea
          className="sa-textarea"
          rows={4}
          value={form.body}
          onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
          placeholder="Write your announcement…"
        />
      </div>

      <div className="sa-field">
        <label className="sa-label">Destination</label>
        <div className="sa-radio-row" style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 8 }}>
          {[
            { id: "members", label: "For Members" },
            { id: "leaders", label: "For Leaders" },
            { id: "admins", label: "For Admins" },
          ].map((opt) => (
            <label key={opt.id} className="sa-field-toggle" style={{ cursor: "pointer" }}>
              <input
                type="radio"
                name="ann-dest"
                checked={form.destination_type === opt.id}
                onChange={() => setDest(opt.id)}
              />
              <span className="sa-field-toggle-label">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      {form.destination_type === "members" && (
        <div className="sa-form-row" style={{ marginTop: 12 }}>
          <div className="sa-field">
            <label className="sa-label">Country <span className="sa-required">*</span></label>
            <select
              className="sa-field-select"
              value={form.members.branch_country}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  members: { ...f.members, branch_country: e.target.value, branch_state: "", satellite_site: "" },
                }))
              }
            >
              <option value="">Select country</option>
              {BRANCH_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="sa-field">
            <label className="sa-label">State</label>
            <select
              className="sa-field-select"
              value={form.members.branch_state}
              disabled={!form.members.branch_country}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  members: { ...f.members, branch_state: e.target.value, satellite_site: "" },
                }))
              }
            >
              <option value="">All states</option>
              {branchStatesForCountry(form.members.branch_country).map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="sa-field">
            <label className="sa-label">Satellite / branch</label>
            <select
              className="sa-field-select"
              value={form.members.satellite_site}
              disabled={!form.members.branch_country}
              onChange={(e) => setForm((f) => ({ ...f, members: { ...f.members, satellite_site: e.target.value } }))}
            >
              <option value="">All satellites</option>
              {satellites.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="sa-field">
            <label className="sa-label">Service unit</label>
            <select
              className="sa-field-select"
              value={form.members.service_unit_id}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  members: { ...f.members, service_unit_id: e.target.value, sub_unit: "" },
                }))
              }
            >
              <option value="">All units</option>
              {unitList.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          {form.members.service_unit_id ? (
            <div className="sa-field">
              <label className="sa-label">Sub-unit</label>
              <select
                className="sa-field-select"
                value={form.members.sub_unit}
                onChange={(e) => setForm((f) => ({ ...f, members: { ...f.members, sub_unit: e.target.value } }))}
              >
                <option value="">All sub-units</option>
                {(selectedUnit?.sub_units || []).map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
      )}

      {form.destination_type === "leaders" && (
        <div style={{ marginTop: 12 }}>
          <div className="sa-field">
            <label className="sa-label">Leaders</label>
            <select
              className="sa-field-select"
              value={form.leaders.mode}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  leaders: { ...f.leaders, mode: e.target.value, sub_unit: "" },
                }))
              }
            >
              {LEADER_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <div className="sa-field-hint">
              If sub-unit is left empty with “service unit leaders only”, only service unit leaders receive it.
            </div>
          </div>
          {form.leaders.mode !== "all" && (
            <div className="sa-form-row" style={{ marginTop: 10 }}>
              <div className="sa-field">
                <label className="sa-label">Service unit</label>
                <select
                  className="sa-field-select"
                  value={form.leaders.service_unit_id}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      leaders: { ...f.leaders, service_unit_id: e.target.value, sub_unit: "" },
                    }))
                  }
                >
                  <option value="">Select unit</option>
                  {unitList.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
              {form.leaders.mode === "sub_unit" && (
                <div className="sa-field">
                  <label className="sa-label">Sub-unit</label>
                  <select
                    className="sa-field-select"
                    value={form.leaders.sub_unit}
                    onChange={(e) => setForm((f) => ({ ...f, leaders: { ...f.leaders, sub_unit: e.target.value } }))}
                  >
                    <option value="">Select sub-unit</option>
                    {(leaderUnit?.sub_units || []).map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {form.destination_type === "admins" && (
        <div className="sa-field" style={{ marginTop: 12 }}>
          <label className="sa-label">Admin roles</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            {ADMIN_ROLE_OPTIONS.map((r) => (
              <label key={r.value} className="sa-field-toggle" style={{ cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={form.admins.roles.includes(r.value)}
                  onChange={(e) => {
                    setForm((f) => {
                      const roles = new Set(f.admins.roles);
                      if (e.target.checked) roles.add(r.value);
                      else roles.delete(r.value);
                      return { ...f, admins: { ...f.admins, roles: [...roles] } };
                    });
                  }}
                />
                <span className="sa-field-toggle-label">{r.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="sa-form-row" style={{ marginTop: 16 }}>
        <div className="sa-field">
          <label className="sa-label">Medium</label>
          <div style={{ display: "flex", gap: 20, marginTop: 8 }}>
            <label className="sa-field-toggle" style={{ cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={form.medium_email}
                onChange={(e) => setForm((f) => ({ ...f, medium_email: e.target.checked }))}
              />
              <span className="sa-field-toggle-label">Email</span>
            </label>
            <label className="sa-field-toggle" style={{ cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={form.medium_sms}
                onChange={(e) => setForm((f) => ({ ...f, medium_sms: e.target.checked }))}
              />
              <span className="sa-field-toggle-label">SMS</span>
            </label>
          </div>
        </div>
        <div className="sa-field">
          <label className="sa-label">Schedule for (optional)</label>
          <input
            type="datetime-local"
            className="sa-input"
            value={form.scheduled_at}
            onChange={(e) => setForm((f) => ({ ...f, scheduled_at: e.target.value }))}
          />
          <div className="sa-field-hint">Use Schedule button below, or Send now to publish immediately.</div>
        </div>
      </div>
    </Modal>
  );
}
