import { useEffect, useMemo, useState } from "react";
import { Modal } from "./Modal.jsx";
import { BRANCH_COUNTRIES, branchCountryLabel, branchStateLabel, branchStatesForCountry } from "../branchRegions.js";
import { fetchChurchesCatalog } from "../../lib/churchesCatalog.js";
import { SearchableDropdown } from "./SearchableDropdown.jsx";
import { isActingAsStateAdmin } from "../adminViewMode.js";
import { isCountrySuperAdmin } from "../roles.js";

/**
 * Scope tiers visible per role for announcement audience.
 * true = visible & editable, false = hidden/removed.
 * Super/General Admin see everything (default).
 */
const SCOPE_VISIBILITY = {
  country_super_admin:    { country: false, state: true,  satellite: true,  unit: false, subunit: false },
  state_super_admin:      { country: false, state: true,  satellite: true,  unit: true,  subunit: true  },
  satellite_church_admin: { country: false, state: false, satellite: true,  unit: true,  subunit: true  },
  service_unit_leader:    { country: false, state: false, satellite: false, unit: true,  subunit: true  },
  sub_unit_leader:        { country: false, state: false, satellite: false, unit: false, subunit: true  },
};

function getScopeVisibility(role) {
  return SCOPE_VISIBILITY[role] || { country: true, state: true, satellite: true, unit: true, subunit: true };
}

const ADMIN_ROLE_OPTIONS = [
  { value: "general_admin", label: "General Admin" },
  { value: "country_super_admin", label: "Country Admin" },
  { value: "state_super_admin", label: "State Branch Admin" },
  { value: "satellite_church_admin", label: "Satellite / Branch Admin" },
];

const COUNTRY_ADMIN_ROLE_OPTIONS = ADMIN_ROLE_OPTIONS.filter((r) => r.value !== "general_admin");

function LockedCountryField({ countryCode }) {
  const label = branchCountryLabel(countryCode) || countryCode || "—";
  return (
    <div className="sa-field" style={{ marginBottom: 0 }}>
      <label className="sa-label">Country</label>
      <input className="sa-input" value={label} readOnly disabled />
      <div className="sa-field-hint">Announcements are limited to this country.</div>
    </div>
  );
}

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
  leaders: { mode: "all", branch_country: "", branch_state: "", satellite_site: "", service_unit_id: "", sub_unit: "" },
  admins: { roles: ["general_admin"], branch_country: "", branch_state: "", satellite_site: "" },
});

function AudienceGeoScope({ scope, onScopeChange, churches, countryOptions, requireCountry, vis, lockedCountryCode, lockedStateCode }) {
  const v = vis || { country: true, state: true, satellite: true };
  const cc = lockedCountryCode || scope.branch_country;

  const stateOptions = useMemo(() => {
    if (!cc) return [];
    return [
      { value: "", label: "All states" },
      ...branchStatesForCountry(cc).map((s) => ({
        value: s.code,
        label: s.name,
      })),
    ];
  }, [cc]);

  const satelliteOptions = useMemo(() => {
    const st = lockedStateCode || scope.branch_state;
    const rows = branchSatelliteOptions(churches, cc, st);
    return [{ value: "", label: "All satellites" }, ...rows];
  }, [churches, cc, scope.branch_state, lockedStateCode]);

  return (
    <div className="sa-ann-scope-grid">
      {lockedCountryCode ? (
        <LockedCountryField countryCode={lockedCountryCode} />
      ) : v.country ? (
        <div className="sa-field" style={{ marginBottom: 0 }}>
          <label className="sa-label">
            Country {requireCountry ? <span className="sa-required">*</span> : null}
          </label>
          <SearchableDropdown
            value={scope.branch_country}
            onChange={(code) => onScopeChange({ branch_country: code, branch_state: "", satellite_site: "" })}
            options={countryOptions}
            placeholder="Select country"
            searchPlaceholder="Search country"
            emptyMessage="No countries match"
            ariaLabel="Country"
          />
        </div>
      ) : null}
      {v.state && (
        <div className="sa-field" style={{ marginBottom: 0 }}>
          <label className="sa-label">State / region</label>
          {lockedStateCode ? (
            <>
              <input
                className="sa-input"
                value={branchStateLabel(cc, lockedStateCode) || lockedStateCode}
                readOnly
                disabled
              />
              <div className="sa-field-hint">State is fixed to your headquarters while in State Branch Admin view.</div>
            </>
          ) : (
            <SearchableDropdown
              value={scope.branch_state}
              onChange={(code) => onScopeChange({ branch_state: code, satellite_site: "" })}
              options={stateOptions}
              disabled={!cc}
              placeholder={cc ? "All states" : "Select country first"}
              searchPlaceholder="Search state"
              emptyMessage="No states match"
              ariaLabel="State / region"
            />
          )}
        </div>
      )}
      {v.satellite && (
        <div className="sa-field" style={{ marginBottom: 0 }}>
          <label className="sa-label">Satellite / branch</label>
          <SearchableDropdown
            value={scope.satellite_site}
            onChange={(site) => onScopeChange({ satellite_site: site })}
            options={satelliteOptions}
            disabled={!cc || !(lockedStateCode || scope.branch_state)}
            placeholder={
              !cc
                ? "Select country first"
                : !(lockedStateCode || scope.branch_state)
                  ? "Select state first"
                  : "All satellites"
            }
            searchPlaceholder="Search by name or address"
            emptyMessage="No branches match"
            ariaLabel="Satellite / branch"
          />
        </div>
      )}
    </div>
  );
}

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

export function AnnouncementCreateModal({ open, onClose, onSubmit, saving, unitList = [], admin, viewMode }) {
  const vis = useMemo(() => getScopeVisibility(admin?.role), [admin?.role]);
  const isGlobal = admin?.role === "super_admin" || admin?.role === "general_admin";
  const isCountryAdmin = isCountrySuperAdmin(admin?.role);
  const actingAsState = isActingAsStateAdmin(admin, viewMode);
  const lockedCountryCode = isCountryAdmin ? String(admin?.branch_country || "").trim().toUpperCase() : "";
  const lockedStateCode =
    isCountryAdmin && actingAsState ? String(admin?.branch_state || "").trim().toUpperCase() : "";
  const adminRoleOptions = isCountryAdmin ? COUNTRY_ADMIN_ROLE_OPTIONS : ADMIN_ROLE_OPTIONS;
  const [form, setForm] = useState(emptyForm);
  const [churches, setChurches] = useState([]);
  const [scheduleLater, setScheduleLater] = useState(false);

  useEffect(() => {
    if (!open) {
      setForm(emptyForm());
      setScheduleLater(false);
      return;
    }
    const base = emptyForm();
    if (!isGlobal && admin) {
      const geo = {
        branch_country: admin.branch_country || "",
        branch_state: actingAsState ? admin.branch_state || "" : "",
        satellite_site: admin.satellite_site || "",
      };
      base.members = { ...base.members, ...geo, service_unit_id: admin.service_unit_id || "", sub_unit: admin.sub_unit_name || "" };
      base.leaders = { ...base.leaders, ...geo, service_unit_id: admin.service_unit_id || "", sub_unit: admin.sub_unit_name || "" };
      base.admins = {
        ...base.admins,
        ...geo,
        roles: isCountryAdmin
          ? ["country_super_admin", "state_super_admin", "satellite_church_admin"]
          : base.admins.roles,
      };
    }
    setForm(base);
    fetchChurchesCatalog().then(setChurches).catch(() => setChurches([]));
  }, [open, admin, isGlobal, actingAsState, isCountryAdmin]);

  const countryOptions = useMemo(() => {
    if (lockedCountryCode) {
      const c = BRANCH_COUNTRIES.find((x) => x.code === lockedCountryCode);
      return c ? [{ value: c.code, label: c.name }] : [{ value: lockedCountryCode, label: branchCountryLabel(lockedCountryCode) || lockedCountryCode }];
    }
    return BRANCH_COUNTRIES.map((c) => ({ value: c.code, label: c.name }));
  }, [lockedCountryCode]);

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
    if (lockedCountryCode) {
      destination_config.branch_country = lockedCountryCode;
      if (actingAsState && admin?.branch_state) {
        destination_config.branch_state = admin.branch_state;
      }
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
      if (!form.leaders.branch_country) return "Select a country for leader announcements.";
      if (form.leaders.mode === "service_unit" && !form.leaders.service_unit_id) {
        return "Select a service unit for leader targeting.";
      }
      if (form.leaders.mode === "sub_unit") {
        if (!form.leaders.service_unit_id) return "Select a service unit.";
        if (!form.leaders.sub_unit) return "Select a sub-unit for sub-unit leader targeting.";
      }
    }
    if (form.destination_type === "admins") {
      if (!form.admins.branch_country) return "Select a country for admin announcements.";
      if (!form.admins.roles || form.admins.roles.length === 0) return "Select at least one admin role.";
    }
    return "";
  }

  function submit(workflow_action) {
    const err = validate();
    if (err) return onSubmit(null, err);
    if (workflow_action === "schedule") {
      if (!scheduleLater) return onSubmit(null, "Turn on \u201cSchedule send\u201d to schedule.");
      if (!form.scheduled_at?.trim()) return onSubmit(null, "Pick a date and time.");
    }
    onSubmit(buildPayload(workflow_action), null);
  }

  function scheduleToggle(enabled) {
    setScheduleLater(enabled);
    if (!enabled) setForm((f) => ({ ...f, scheduled_at: "" }));
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
          {scheduleLater ? (
            <button
              type="button"
              className="sa-btn sa-btn-outline"
              onClick={() => submit("schedule")}
              disabled={saving || !form.scheduled_at?.trim()}
            >
              Schedule send
            </button>
          ) : null}
          <button type="button" className="sa-btn sa-btn-primary" onClick={() => submit("send")} disabled={saving}>
            {saving ? "Sending\u2026" : "Send now"}
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
          placeholder="Write your announcement\u2026"
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
          <AudienceGeoScope
            scope={form.members}
            onScopeChange={(patch) => setForm((f) => ({ ...f, members: { ...f.members, ...patch } }))}
            churches={churches}
            countryOptions={countryOptions}
            requireCountry
            vis={vis}
            lockedCountryCode={lockedCountryCode}
            lockedStateCode={lockedStateCode}
          />
          {vis.unit && (
            <div className="sa-ann-scope-grid" style={{ marginTop: 14 }}>
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
              {vis.subunit && form.members.service_unit_id ? (
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
          )}
          <p className="sa-field-hint" style={{ marginTop: 12, marginBottom: 0 }}>
            {isGlobal
              ? "Narrow the audience step by step. Leave optional fields on \u201cAll\u201d to include everyone in the previous level."
              : isCountryAdmin
                ? actingAsState
                  ? "This announcement is scoped to your headquarters state only."
                  : "This announcement is scoped to your country. Optionally narrow by state or satellite within your country."
                : "Your announcement will be scoped to your jurisdiction. Use the visible fields to narrow further."}
          </p>
        </section>
      )}

      {form.destination_type === "leaders" && (
        <section className="sa-ann-scope" aria-label="Leader audience">
          <div className="sa-ann-scope-title">Audience scope</div>
          <AudienceGeoScope
            scope={form.leaders}
            onScopeChange={(patch) => setForm((f) => ({ ...f, leaders: { ...f.leaders, ...patch } }))}
            churches={churches}
            countryOptions={countryOptions}
            requireCountry
            vis={vis}
            lockedCountryCode={lockedCountryCode}
            lockedStateCode={lockedStateCode}
          />
          <p className="sa-field-hint" style={{ marginTop: 12, marginBottom: 14 }}>
            {isGlobal
              ? "Narrow geography step by step. Leave optional fields on \u201cAll\u201d to include everyone in the previous level."
              : isCountryAdmin
                ? actingAsState
                  ? "This announcement is scoped to your headquarters state only."
                  : "This announcement is scoped to your country. Optionally narrow by state or satellite."
                : "Your announcement will be scoped to your jurisdiction."}
          </p>
          {vis.unit && (
            <>
              <div className="sa-ann-scope-title">Leader type</div>
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
                  {vis.subunit && form.leaders.mode === "sub_unit" && (
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
            </>
          )}
        </section>
      )}

      {form.destination_type === "admins" && (
        <section className="sa-ann-scope" aria-label="Admin audience">
          <div className="sa-ann-scope-title">Audience scope</div>
          <AudienceGeoScope
            scope={form.admins}
            onScopeChange={(patch) => setForm((f) => ({ ...f, admins: { ...f.admins, ...patch } }))}
            churches={churches}
            countryOptions={countryOptions}
            requireCountry
            vis={vis}
            lockedCountryCode={lockedCountryCode}
            lockedStateCode={lockedStateCode}
          />
          <p className="sa-field-hint" style={{ marginTop: 12, marginBottom: 14 }}>
            {isGlobal
              ? "Narrow geography step by step. Leave optional fields on \u201cAll\u201d to include everyone in the previous level."
              : isCountryAdmin
                ? actingAsState
                  ? "Admin announcements are limited to your headquarters state."
                  : "Admin announcements are limited to admins in your country."
                : "Your announcement will be scoped to your jurisdiction."}
          </p>
          <div className="sa-ann-scope-title">Admin roles</div>
          <p className="sa-field-hint" style={{ marginTop: 0, marginBottom: 12 }}>
            {isCountryAdmin
              ? "Select admin tiers within your country. Global General Admin is not included."
              : "Tick all boxes to reach every admin tier, or limit to selected roles only."}
          </p>
          <div className="sa-ann-admin-role-row" role="group" aria-label="Admin roles">
            {adminRoleOptions.map((r) => (
              <label key={r.value} className="sa-field-toggle sa-ann-admin-role-item" style={{ cursor: "pointer" }}>
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
        <div className="sa-field" style={{ marginBottom: 0 }}>
          <label className="sa-field-toggle sa-ann-schedule-toggle">
            <input
              type="checkbox"
              checked={scheduleLater}
              onChange={(e) => scheduleToggle(Boolean(e.target.checked))}
            />
            <span className="sa-field-toggle-label">Schedule send (pick date &amp; time below)</span>
          </label>
          {scheduleLater ? (
            <div style={{ marginTop: 12 }}>
              <label className="sa-label">Send date &amp; time <span className="sa-required">*</span></label>
              <input
                type="datetime-local"
                className="sa-input"
                value={form.scheduled_at}
                onChange={(e) => setForm((f) => ({ ...f, scheduled_at: e.target.value }))}
              />
              <div className="sa-field-hint">
                Announcement publishes at this time. Use Schedule send in the footer, or turn off scheduling for Send now.
              </div>
            </div>
          ) : (
            <p className="sa-field-hint" style={{ marginTop: 8 }}>
              Turn this on to reveal the date picker, then confirm with Schedule send.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
