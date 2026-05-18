import { useEffect, useMemo, useState } from "react";
import { Modal } from "./Modal.jsx";
import { BRANCH_COUNTRIES, branchStatesForCountry } from "../branchRegions.js";
import { fetchChurchesCatalog } from "../../lib/churchesCatalog.js";
import { SearchableDropdown } from "./SearchableDropdown.jsx";

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

function branchSatelliteOptions(churches, branchCountry, branchState) {
  const cc = String(branchCountry || "").trim().toUpperCase();
  const st = String(branchState || "").trim().toUpperCase();
  if (!cc || !st) return [];
  const byName = new Map();
  for (const ch of churches || []) {
    if (String(ch.branch_country || "").toUpperCase() !== cc) continue;
    if (String(ch.branch_state || "").toUpperCase() !== st) continue;
    const name = String(ch.name || "").trim();
    if (!name || byName.has(name)) continue;
    byName.set(name, String(ch.address || "").trim());
  }
  return [...byName.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, address]) => ({
      value: name,
      label: name,
      meta: address,
    }));
}

export function AnnouncementCreateModal({ open, onClose, onSubmit, saving, unitList = [] }) {
  const [form, setForm] = useState(emptyForm);
  const [churches, setChurches] = useState([]);

  useEffect(() => {
    if (!open) {
      setForm(emptyForm());
      return;
    }
    fetchChurchesCatalog().then(setChurches).catch(() => setChurches([]));
  }, [open]);

  const countryOptions = useMemo(
    () => BRANCH_COUNTRIES.map((c) => ({ value: c.code, label: c.name })),
    [],
  );

  const memberStateOptions = useMemo(() => {
    if (!form.members.branch_country) return [];
    return [
      { value: "", label: "All states" },
      ...branchStatesForCountry(form.members.branch_country).map((s) => ({
        value: s.code,
        label: s.name,
      })),
    ];
  }, [form.members.branch_country]);

  const memberSatelliteOptions = useMemo(() => {
    const rows = branchSatelliteOptions(churches, form.members.branch_country, form.members.branch_state);
    return [{ value: "", label: "All satellites" }, ...rows];
  }, [churches, form.members.branch_country, form.members.branch_state]);

  const unitOptions = useMemo(
    () => [
      { value: "", label: "All units" },
      ...unitList.map((u) => ({ value: String(u.id), label: u.name })),
    ],
    [unitList],
  );

  const memberSubUnitOptions = useMemo(() => {
    const unit = unitList.find((u) => Number(u.id) === Number(form.members.service_unit_id));
    return [
      { value: "", label: "All sub-units" },
      ...(unit?.sub_units || []).map((s) => ({ value: s.name, label: s.name })),
    ];
  }, [unitList, form.members.service_unit_id]);

  const leaderModeOptions = useMemo(
    () => LEADER_MODES.map((m) => ({ value: m.value, label: m.label })),
    [],
  );

  const leaderUnitOptions = useMemo(
    () => [
      { value: "", label: "Select unit" },
      ...unitList.map((u) => ({ value: String(u.id), label: u.name })),
    ],
    [unitList],
  );

  const leaderSubUnitOptions = useMemo(() => {
    const unit = unitList.find((u) => Number(u.id) === Number(form.leaders.service_unit_id));
    return [
      { value: "", label: "Select sub-unit" },
      ...(unit?.sub_units || []).map((s) => ({ value: s.name, label: s.name })),
    ];
  }, [unitList, form.leaders.service_unit_id]);

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

  if (!open) return null;

  return (
    <Modal
      open
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
        <section className="sa-ann-scope" aria-label="Member audience">
          <div className="sa-ann-scope-title">Audience scope</div>
          <div className="sa-ann-scope-grid">
            <div className="sa-field" style={{ marginBottom: 0 }}>
              <label className="sa-label">Country <span className="sa-required">*</span></label>
              <SearchableDropdown
                value={form.members.branch_country}
                onChange={(code) =>
                  setForm((f) => ({
                    ...f,
                    members: { ...f.members, branch_country: code, branch_state: "", satellite_site: "" },
                  }))
                }
                options={countryOptions}
                placeholder="Select country"
                searchPlaceholder="Search country"
                emptyMessage="No countries match"
                ariaLabel="Country"
              />
            </div>
            <div className="sa-field" style={{ marginBottom: 0 }}>
              <label className="sa-label">State / region</label>
              <SearchableDropdown
                value={form.members.branch_state}
                onChange={(code) =>
                  setForm((f) => ({
                    ...f,
                    members: { ...f.members, branch_state: code, satellite_site: "" },
                  }))
                }
                options={memberStateOptions}
                disabled={!form.members.branch_country}
                placeholder={form.members.branch_country ? "All states" : "Select country first"}
                searchPlaceholder="Search state"
                emptyMessage="No states match"
                ariaLabel="State / region"
              />
            </div>
            <div className="sa-field" style={{ marginBottom: 0 }}>
              <label className="sa-label">Satellite / branch</label>
              <SearchableDropdown
                value={form.members.satellite_site}
                onChange={(site) => setForm((f) => ({ ...f, members: { ...f.members, satellite_site: site } }))}
                options={memberSatelliteOptions}
                disabled={!form.members.branch_country || !form.members.branch_state}
                placeholder={
                  !form.members.branch_country
                    ? "Select country first"
                    : !form.members.branch_state
                      ? "Select state first"
                      : "All satellites"
                }
                searchPlaceholder="Search by name or address"
                emptyMessage="No branches match"
                ariaLabel="Satellite / branch"
              />
            </div>
            <div className="sa-field" style={{ marginBottom: 0 }}>
              <label className="sa-label">Service unit</label>
              <SearchableDropdown
                value={form.members.service_unit_id ? String(form.members.service_unit_id) : ""}
                onChange={(id) =>
                  setForm((f) => ({
                    ...f,
                    members: { ...f.members, service_unit_id: id, sub_unit: "" },
                  }))
                }
                options={unitOptions}
                placeholder="All units"
                searchPlaceholder="Search service unit"
                emptyMessage="No units match"
                ariaLabel="Service unit"
              />
            </div>
            {form.members.service_unit_id ? (
              <div className="sa-field" style={{ marginBottom: 0 }}>
                <label className="sa-label">Sub-unit</label>
                <SearchableDropdown
                  value={form.members.sub_unit}
                  onChange={(name) => setForm((f) => ({ ...f, members: { ...f.members, sub_unit: name } }))}
                  options={memberSubUnitOptions}
                  placeholder="All sub-units"
                  searchPlaceholder="Search sub-unit"
                  emptyMessage="No sub-units match"
                  ariaLabel="Sub-unit"
                />
              </div>
            ) : null}
          </div>
          <p className="sa-field-hint" style={{ marginTop: 12, marginBottom: 0 }}>
            Narrow the audience step by step. Leave optional fields on “All” to include everyone in the previous level.
          </p>
        </section>
      )}

      {form.destination_type === "leaders" && (
        <section className="sa-ann-scope" aria-label="Leader audience">
          <div className="sa-ann-scope-title">Leader audience</div>
          <div className="sa-field" style={{ marginBottom: 14 }}>
            <label className="sa-label">Leaders</label>
            <SearchableDropdown
              value={form.leaders.mode}
              onChange={(mode) =>
                setForm((f) => ({
                  ...f,
                  leaders: { ...f.leaders, mode, service_unit_id: "", sub_unit: "" },
                }))
              }
              options={leaderModeOptions}
              placeholder="Select audience"
              searchPlaceholder="Search option"
              emptyMessage="No options"
              ariaLabel="Leader audience type"
            />
            <div className="sa-field-hint">
              Service unit only: unit leaders. Sub-unit: pick a unit and sub-unit for sub-unit leaders.
            </div>
          </div>
          {form.leaders.mode !== "all" && (
            <div className="sa-ann-scope-grid">
              <div className="sa-field" style={{ marginBottom: 0 }}>
                <label className="sa-label">
                  Service unit {form.leaders.mode !== "all" ? <span className="sa-required">*</span> : null}
                </label>
                <SearchableDropdown
                  value={form.leaders.service_unit_id ? String(form.leaders.service_unit_id) : ""}
                  onChange={(id) =>
                    setForm((f) => ({
                      ...f,
                      leaders: { ...f.leaders, service_unit_id: id, sub_unit: "" },
                    }))
                  }
                  options={leaderUnitOptions}
                  placeholder="Select unit"
                  searchPlaceholder="Search service unit"
                  emptyMessage="No units match"
                  ariaLabel="Service unit"
                />
              </div>
              {form.leaders.mode === "sub_unit" && (
                <div className="sa-field" style={{ marginBottom: 0 }}>
                  <label className="sa-label">
                    Sub-unit <span className="sa-required">*</span>
                  </label>
                  <SearchableDropdown
                    value={form.leaders.sub_unit}
                    onChange={(name) => setForm((f) => ({ ...f, leaders: { ...f.leaders, sub_unit: name } }))}
                    options={leaderSubUnitOptions}
                    disabled={!form.leaders.service_unit_id}
                    placeholder={form.leaders.service_unit_id ? "Select sub-unit" : "Select unit first"}
                    searchPlaceholder="Search sub-unit"
                    emptyMessage="No sub-units match"
                    ariaLabel="Sub-unit"
                  />
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {form.destination_type === "admins" && (
        <section className="sa-ann-scope" aria-label="Admin audience">
          <div className="sa-ann-scope-title">Admin roles</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
        </section>
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
          <div className="sa-field-hint">Use Schedule below, or Send now to publish immediately.</div>
        </div>
      </div>
    </Modal>
  );
}
