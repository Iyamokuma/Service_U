import { useEffect, useMemo, useState } from "react";
import { Modal } from "./Modal.jsx";
import { branchCountryLabel, branchStateLabel } from "../branchRegions.js";
import { fetchAdminChurchesCatalog } from "../churchesCatalog.js";
import { SearchableDropdown } from "./SearchableDropdown.jsx";
import {
  announcementDestinationTabsForPolicy,
  applyAnnouncementScopeLocks,
  getAnnouncementScopePolicy,
  initialAnnouncementGeoForm,
  sendAllAudienceOptionsForPolicy,
} from "../announcementScopePolicy.js";
import { unitHasSubUnits } from "../../serviceUnitUtils.js";
import { AnnouncementAudienceGeoScope, LockedGeoField } from "./AnnouncementAudienceGeoScope.jsx";
import { AnnouncementDestinationPicker } from "./AnnouncementDestinationPicker.jsx";
import { AnnouncementSendAllScope } from "./AnnouncementSendAllScope.jsx";

const emptyForm = () => ({
  title: "",
  body: "",
  destination_type: "members",
  medium_email: true,
  medium_push: true,
  scheduled_at: "",
  members: { branch_country: "", branch_state: "", satellite_site: "", service_unit_id: "", sub_unit: "" },
  leaders: { mode: "all", branch_country: "", branch_state: "", satellite_site: "", service_unit_id: "", sub_unit: "" },
  admins: { roles: ["general_admin"], branch_country: "", branch_state: "", satellite_site: "" },
  send_all: {
    audiences: [],
    branch_country: "",
    branch_state: "",
    satellite_site: "",
    service_unit_id: "",
    sub_unit: "",
  },
});

function sharedGeoFromForm(form, destinationType) {
  const key =
    destinationType === "send_all"
      ? "send_all"
      : destinationType === "leaders"
        ? "leaders"
        : destinationType === "admins"
          ? "admins"
          : "members";
  const bucket = form[key];
  return {
    branch_country: bucket.branch_country || "",
    branch_state: bucket.branch_state || "",
    satellite_site: bucket.satellite_site || "",
  };
}

function applySharedGeoPatch(form, patch) {
  const geo = { ...patch };
  return {
    ...form,
    members: { ...form.members, ...geo },
    leaders: { ...form.leaders, ...geo },
    admins: { ...form.admins, ...geo },
    send_all: { ...form.send_all, ...geo },
  };
}

export function AnnouncementCreateModal({ open, onClose, onSubmit, saving, unitList = [], admin, viewMode }) {
  const policy = useMemo(() => getAnnouncementScopePolicy(admin, viewMode), [admin, viewMode]);
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
    const audienceOptions = sendAllAudienceOptionsForPolicy(policy);
    if (policy.membersOnly) {
      base.destination_type = "members";
    }
    if (policy.showSendAllTab) {
      const geo = policy.isGlobal
        ? { branch_country: "", branch_state: "", satellite_site: "" }
        : admin
          ? {
              branch_country: policy.lockedCountry || admin.branch_country || "",
              branch_state: policy.lockedState || "",
              satellite_site: policy.lockedSatellite || admin.satellite_site || "",
            }
          : { branch_country: "", branch_state: "", satellite_site: "" };
      base.send_all = {
        audiences: audienceOptions.map((a) => a.value),
        ...geo,
        service_unit_id: "",
        sub_unit: "",
      };
      if (!policy.isGlobal && admin) {
        base.members = { ...base.members, ...geo };
        base.leaders = { ...base.leaders, ...geo };
        base.admins = { ...base.admins, ...geo, roles: [...policy.defaultAdminRoles] };
      }
    } else if (!policy.isGlobal && admin) {
      const geo = initialAnnouncementGeoForm(admin, policy);
      base.members = { ...base.members, ...geo };
      base.leaders = { ...base.leaders, ...geo };
      base.admins = { ...base.admins, ...geo, roles: [...policy.defaultAdminRoles] };
    }
    setForm(base);
    fetchAdminChurchesCatalog().then(setChurches).catch(() => setChurches([]));
  }, [open, admin, policy]);

  const branchCountries = useMemo(() => {
    const map = new Map();
    for (const ch of churches || []) {
      const code = String(ch.branch_country || "").trim().toUpperCase();
      if (!code || map.has(code)) continue;
      map.set(code, branchCountryLabel(code) || code);
    }
    return [...map.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([code, name]) => ({ code, name }));
  }, [churches]);

  const destinationTabs = useMemo(
    () => announcementDestinationTabsForPolicy(policy),
    [policy],
  );

  const scopedUnitList = useMemo(() => {
    if (!policy.lockedServiceUnitId) return unitList;
    return unitList.filter((u) => String(u.id) === String(policy.lockedServiceUnitId));
  }, [unitList, policy.lockedServiceUnitId]);

  const unitOptions = useMemo(
    () => [
      { value: "", label: policy.lockedServiceUnitId ? "Your unit" : "All units" },
      ...scopedUnitList.map((u) => ({ value: String(u.id), label: u.name })),
    ],
    [scopedUnitList, policy.lockedServiceUnitId],
  );

  const memberSubUnitOptions = useMemo(() => {
    const unit = scopedUnitList.find((u) => Number(u.id) === Number(form.members.service_unit_id));
    return [
      { value: "", label: policy.lockedSubUnit ? policy.lockedSubUnit : "All sub-units" },
      ...(unit?.sub_units || []).map((s) => ({ value: s.name, label: s.name })),
    ];
  }, [scopedUnitList, form.members.service_unit_id, policy.lockedSubUnit]);

  const memberSelectedUnit = useMemo(
    () => scopedUnitList.find((u) => Number(u.id) === Number(form.members.service_unit_id)),
    [scopedUnitList, form.members.service_unit_id],
  );
  const memberUnitHasSubUnits = unitHasSubUnits(memberSelectedUnit) || Boolean(policy.lockedSubUnit);

  const sendAllAudienceOptions = useMemo(
    () => sendAllAudienceOptionsForPolicy(policy),
    [policy],
  );

  const destLabels = policy.destinationLabels;
  const useUnifiedGeo = Boolean(policy.useUnifiedGeo);
  const sharedGeoScope = useMemo(
    () => sharedGeoFromForm(form, form.destination_type),
    [form, form.destination_type],
  );

  const leaderModeOptions = useMemo(
    () => destLabels.leaderModeOptions.map((m) => ({ value: m.value, label: m.label })),
    [destLabels.leaderModeOptions],
  );

  const leaderUnitOptions = useMemo(
    () => [
      { value: "", label: "Select unit" },
      ...scopedUnitList.map((u) => ({ value: String(u.id), label: u.name })),
    ],
    [scopedUnitList],
  );

  const leaderSubUnitOptions = useMemo(() => {
    const unit = scopedUnitList.find((u) => Number(u.id) === Number(form.leaders.service_unit_id));
    return [
      { value: "", label: "Select sub-unit" },
      ...(unit?.sub_units || []).map((s) => ({ value: s.name, label: s.name })),
    ];
  }, [scopedUnitList, form.leaders.service_unit_id]);

  const leaderSelectedUnit = useMemo(
    () => scopedUnitList.find((u) => Number(u.id) === Number(form.leaders.service_unit_id)),
    [scopedUnitList, form.leaders.service_unit_id],
  );
  const leaderUnitHasSubUnits = unitHasSubUnits(leaderSelectedUnit) || Boolean(policy.lockedSubUnit);

  const leaderTypePlaceholder = policy.isSatellitePastor
    ? "Select service unit head role"
    : policy.isServiceUnitLeader
      ? "Select sub-unit leaders"
      : "Select audience";
  const leaderTypeAriaLabel = policy.isSatellitePastor
    ? "Service unit head role"
    : policy.isServiceUnitLeader
      ? "Sub Unit Leaders"
      : "Leader audience type";
  const showLeaderTypeInScope = useUnifiedGeo && form.destination_type === "leaders";

  function buildPayload(workflow_action) {
    const destination_type = form.destination_type;
    let destination_config = {};
    if (destination_type === "send_all") {
      destination_config = { ...form.send_all };
    } else if (destination_type === "members") {
      destination_config = { ...form.members };
    } else if (destination_type === "leaders") {
      destination_config = { ...form.leaders };
    } else {
      destination_config = { ...form.admins };
    }
    destination_config = applyAnnouncementScopeLocks(destination_config, policy);
    return {
      title: form.title.trim(),
      body: form.body.trim(),
      destination_type,
      destination_config,
      medium_email: form.medium_email,
      medium_push: form.medium_push,
      workflow_action,
      scheduled_at: workflow_action === "schedule" ? form.scheduled_at : "",
    };
  }

  function validate() {
    if (!form.title.trim() || !form.body.trim()) return "Title and message are required.";
    if (!form.medium_email && !form.medium_push) {
      return "Select at least one medium: Email or Push notification.";
    }
    if (form.destination_type === "send_all") {
      if (!form.send_all.audiences?.length) {
        return "Select at least one audience under Send all.";
      }
      return "";
    }
    if (policy.membersOnly && form.destination_type !== "members") {
      return "Sub-unit leaders may only send announcements to their unit members.";
    }
    if (policy.membersOnly && !policy.lockedSubUnit) {
      return "Your sub-unit assignment is not configured. Update your profile or contact an administrator.";
    }
    if (form.destination_type === "members" && !useUnifiedGeo && !form.members.branch_country && !policy.lockedCountry) {
      return `Select a country for ${destLabels.typePrefix.members.toLowerCase()} announcements.`;
    }
    if (form.destination_type === "leaders") {
      if (!useUnifiedGeo && !form.leaders.branch_country && !policy.lockedCountry) {
        return `Select a country for ${destLabels.typePrefix.leaders.toLowerCase()} announcements.`;
      }
      if (form.leaders.mode === "service_unit" && !useUnifiedGeo && !form.leaders.service_unit_id && !policy.lockedServiceUnitId) {
        return destLabels.usesBranchAudienceLabels
          ? "Select a service unit for service unit head targeting."
          : "Select a service unit for leader targeting.";
      }
      if (form.leaders.mode === "sub_unit" && !useUnifiedGeo) {
        if (!form.leaders.service_unit_id && !policy.lockedServiceUnitId) return "Select a service unit.";
        const leaderUnit = scopedUnitList.find(
          (u) => Number(u.id) === Number(form.leaders.service_unit_id || policy.lockedServiceUnitId),
        );
        if (!unitHasSubUnits(leaderUnit) && !policy.lockedSubUnit) {
          return "The selected service unit has no sub-units.";
        }
        if (!form.leaders.sub_unit && !policy.lockedSubUnit) {
          if (policy.isServiceUnitLeader) return "Select a sub-unit for sub-unit leader targeting.";
          return destLabels.usesBranchAudienceLabels
            ? "Select a sub-unit for sub-unit head targeting."
            : "Select a sub-unit for sub-unit leader targeting.";
        }
      }
      if (policy.isServiceUnitLeader && !policy.lockedServiceUnitId) {
        return "Your service unit assignment is not configured. Contact an administrator.";
      }
    }
    if (form.destination_type === "admins") {
      if (!useUnifiedGeo && !form.admins.branch_country && !policy.lockedCountry) {
        return `Select a country for ${destLabels.typePrefix.admins.toLowerCase()} announcements.`;
      }
      if (!form.admins.roles || form.admins.roles.length === 0) {
        return policy.isStateBranchAudience
          ? "Select at least one satellite pastor."
          : policy.isCountryAdmin
            ? "Select at least one pastor type (State Branch or Satellite)."
            : "Select at least one admin role.";
      }
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

  const setDest = (type) =>
    setForm((f) => {
      const geo = sharedGeoFromForm(f, f.destination_type);
      let next = applySharedGeoPatch({ ...f, destination_type: type }, geo);
      if (type === "send_all" && !next.send_all.audiences?.length) {
        next = {
          ...next,
          send_all: {
            ...next.send_all,
            audiences: sendAllAudienceOptions.map((a) => a.value),
          },
        };
      }
      return next;
    });
  const scopeHint = policy.scopeHint;

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

      {!policy.membersOnly ? (
        <AnnouncementDestinationPicker
          tabs={destinationTabs}
          destinationType={form.destination_type}
          onDestinationChange={setDest}
          adminsSubtitle={form.destination_type === "admins" ? destLabels.pastorsSubtitle : ""}
          sendAllAudiences={policy.showSendAllTab ? sendAllAudienceOptions : null}
          selectedAudiences={form.send_all.audiences}
          onAudiencesChange={(audiences) =>
            setForm((f) => ({ ...f, send_all: { ...f.send_all, audiences } }))
          }
        />
      ) : (
        <p className="sa-field-hint" style={{ margin: "0 0 16px", lineHeight: 1.55 }}>
          {scopeHint}
        </p>
      )}

      {useUnifiedGeo && (
        <AnnouncementSendAllScope
          scope={sharedGeoScope}
          onScopeChange={(patch) => setForm((f) => applySharedGeoPatch(f, patch))}
          churches={churches}
          branchCountries={branchCountries}
          allowAllCountries={policy.isGlobal}
          allowAllSatellites
          vis={policy.visibility}
          scopeHint={scopeHint}
          lockedCountryCode={policy.lockedCountry}
          lockedStateCode={policy.lockedState}
          lockedSatelliteSite={policy.lockedSatellite}
          showLeaderType={showLeaderTypeInScope}
          leaderMode={form.leaders.mode}
          leaderModeOptions={leaderModeOptions}
          onLeaderModeChange={(mode) =>
            setForm((f) => ({
              ...f,
              leaders: {
                ...f.leaders,
                mode,
                service_unit_id: policy.lockedServiceUnitId || "",
                sub_unit: "",
              },
            }))
          }
          leaderTypeLabel={destLabels.leaderTypeLabel}
          leaderTypeHint={destLabels.leaderTypeHint}
          leaderTypePlaceholder={leaderTypePlaceholder}
          leaderTypeAriaLabel={leaderTypeAriaLabel}
        />
      )}

      {form.destination_type === "members" && (!useUnifiedGeo || policy.membersOnly || policy.isServiceUnitLeader) && (
        <section
          className="sa-ann-scope"
          aria-label={destLabels.usesBranchAudienceLabels ? "Service unit member audience" : "Member audience"}
        >
          <div className="sa-ann-scope-title">
            {policy.membersOnly
              ? "Your sub-unit members"
              : policy.isServiceUnitLeader
                ? "Your service unit members"
                : "Audience scope"}
          </div>
          {policy.membersOnly || policy.isServiceUnitLeader ? (
            <div className="sa-ann-scope-grid" style={{ marginBottom: 14 }}>
              {policy.lockedCountry ? (
                <LockedGeoField
                  label="Country"
                  value={branchCountryLabel(policy.lockedCountry) || policy.lockedCountry}
                />
              ) : null}
              {policy.lockedState ? (
                <LockedGeoField
                  label="State / region"
                  value={branchStateLabel(policy.lockedCountry, policy.lockedState) || policy.lockedState}
                />
              ) : null}
              {policy.lockedSatellite ? (
                <LockedGeoField label="Satellite church" value={policy.lockedSatellite} />
              ) : null}
              {policy.lockedServiceUnitId ? (
                <LockedGeoField
                  label="Service unit"
                  value={scopedUnitList[0]?.name || `Unit #${policy.lockedServiceUnitId}`}
                />
              ) : null}
              {policy.lockedSubUnit ? (
                <LockedGeoField label="Sub-unit" value={policy.lockedSubUnit} hint="All members in this sub-unit." />
              ) : null}
              {policy.isServiceUnitLeader && policy.lockedServiceUnitId && !policy.lockedSubUnit ? (
                <LockedGeoField
                  label="Service unit"
                  value={scopedUnitList[0]?.name || `Unit #${policy.lockedServiceUnitId}`}
                  hint="All approved members in this service unit."
                />
              ) : null}
            </div>
          ) : null}
          {!policy.membersOnly && !policy.isServiceUnitLeader && !useUnifiedGeo ? (
            <AnnouncementAudienceGeoScope
              scope={form.members}
              onScopeChange={(patch) => setForm((f) => ({ ...f, members: { ...f.members, ...patch } }))}
              churches={churches}
              branchCountries={branchCountries}
              requireCountry
              vis={policy.visibility}
              lockedCountryCode={policy.lockedCountry}
              lockedStateCode={policy.lockedState}
              lockedSatelliteSite={policy.lockedSatellite}
            />
          ) : null}
          {!policy.membersOnly && policy.visibility.unit && !useUnifiedGeo && (
            <div className="sa-ann-scope-grid" style={{ marginTop: 14 }}>
              <div className="sa-field" style={{ marginBottom: 0 }}>
                <label className="sa-label">Service unit</label>
                {policy.lockedServiceUnitId ? (
                  <LockedGeoField
                    label=""
                    value={scopedUnitList[0]?.name || `Unit #${policy.lockedServiceUnitId}`}
                    hint="Service unit is fixed to your assignment."
                  />
                ) : (
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
                )}
              </div>
              {policy.visibility.subunit && (form.members.service_unit_id || policy.lockedServiceUnitId) && memberUnitHasSubUnits ? (
                <div className="sa-field" style={{ marginBottom: 0 }}>
                  <label className="sa-label">Sub-unit</label>
                  {policy.lockedSubUnit ? (
                    <LockedGeoField label="" value={policy.lockedSubUnit} hint="Sub-unit is fixed to your assignment." />
                  ) : (
                    <SearchableDropdown
                      value={form.members.sub_unit}
                      onChange={(name) => setForm((f) => ({ ...f, members: { ...f.members, sub_unit: name } }))}
                      options={memberSubUnitOptions}
                      placeholder="All sub-units"
                      searchPlaceholder="Search sub-unit"
                      emptyMessage="No sub-units match"
                      ariaLabel="Sub-unit"
                    />
                  )}
                </div>
              ) : null}
            </div>
          )}
          {!policy.membersOnly ? (
            <p className="sa-field-hint" style={{ marginTop: 12, marginBottom: 0 }}>
              {scopeHint}
            </p>
          ) : null}
        </section>
      )}

      {!policy.membersOnly && form.destination_type === "leaders" && !showLeaderTypeInScope && (
        <section
          className="sa-ann-scope"
          aria-label={
            policy.isServiceUnitLeader
              ? "Sub unit leader audience"
              : policy.isSatellitePastor
                ? "Service unit head audience"
                : destLabels.usesBranchAudienceLabels
                  ? "Service unit head audience"
                  : "Leader audience"
          }
        >
          <div className="sa-ann-scope-title">
            {policy.isServiceUnitLeader
              ? "Sub Unit Leaders"
              : policy.isSatellitePastor
                ? destLabels.leaderScopeSectionTitle || "Service unit heads"
                : useUnifiedGeo
                  ? destLabels.leaderTypeTitle || "Leader type"
                : destLabels.usesBranchAudienceLabels
                  ? destLabels.leaderScopeSectionTitle || "Service unit heads"
                  : "Audience scope"}
          </div>
          {policy.isServiceUnitLeader ? (
            <div className="sa-ann-scope-grid" style={{ marginBottom: 14 }}>
              {policy.lockedCountry ? (
                <LockedGeoField
                  label="Country"
                  value={branchCountryLabel(policy.lockedCountry) || policy.lockedCountry}
                />
              ) : null}
              {policy.lockedState ? (
                <LockedGeoField
                  label="State / region"
                  value={branchStateLabel(policy.lockedCountry, policy.lockedState) || policy.lockedState}
                />
              ) : null}
              {policy.lockedSatellite ? (
                <LockedGeoField label="Satellite church" value={policy.lockedSatellite} />
              ) : null}
              {policy.lockedServiceUnitId ? (
                <LockedGeoField
                  label="Service unit"
                  value={scopedUnitList[0]?.name || `Unit #${policy.lockedServiceUnitId}`}
                  hint="Sub-unit leaders must belong to this unit."
                />
              ) : null}
            </div>
          ) : null}
          {!policy.isServiceUnitLeader && !useUnifiedGeo ? (
            <AnnouncementAudienceGeoScope
            scope={form.leaders}
            onScopeChange={(patch) => setForm((f) => ({ ...f, leaders: { ...f.leaders, ...patch } }))}
            churches={churches}
            branchCountries={branchCountries}
            requireCountry
            vis={policy.visibility}
            lockedCountryCode={policy.lockedCountry}
            lockedStateCode={policy.lockedState}
            lockedSatelliteSite={policy.lockedSatellite}
            />
          ) : null}
          {!useUnifiedGeo ? (
          <p className="sa-field-hint" style={{ marginTop: 12, marginBottom: 14 }}>
            {scopeHint}
          </p>
          ) : null}
          {(policy.visibility.unit || policy.isServiceUnitLeader) && (
            <>
              {!useUnifiedGeo ? <div className="sa-ann-scope-title">{destLabels.leaderTypeTitle}</div> : null}
              <div className="sa-field" style={{ marginBottom: useUnifiedGeo ? 0 : 14 }}>
                <label className="sa-label">{destLabels.leaderTypeLabel}</label>
                <SearchableDropdown
                  value={form.leaders.mode}
                  onChange={(mode) =>
                    setForm((f) => ({
                      ...f,
                      leaders: { ...f.leaders, mode, service_unit_id: policy.lockedServiceUnitId || "", sub_unit: "" },
                    }))
                  }
                  options={leaderModeOptions}
                  placeholder={
                    policy.isSatellitePastor
                      ? "Select service unit head role"
                      : policy.isServiceUnitLeader
                        ? "Select sub-unit leaders"
                        : "Select audience"
                  }
                  searchPlaceholder="Search option"
                  emptyMessage="No options"
                  ariaLabel={
                    policy.isSatellitePastor
                      ? "Service unit head role"
                      : policy.isServiceUnitLeader
                        ? "Sub Unit Leaders"
                        : "Leader audience type"
                  }
                />
                <div className="sa-field-hint">{destLabels.leaderTypeHint}</div>
              </div>
              {!useUnifiedGeo && (policy.isServiceUnitLeader ? form.leaders.mode === "sub_unit" : form.leaders.mode !== "all") && (
                <div className="sa-ann-scope-grid">
                  {!policy.isServiceUnitLeader ? (
                    <div className="sa-field" style={{ marginBottom: 0 }}>
                      <label className="sa-label">
                        Service unit {form.leaders.mode !== "all" ? <span className="sa-required">*</span> : null}
                      </label>
                      {policy.lockedServiceUnitId ? (
                        <LockedGeoField label="" value={scopedUnitList[0]?.name || `Unit #${policy.lockedServiceUnitId}`} />
                      ) : (
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
                      )}
                    </div>
                  ) : null}
                  {(policy.visibility.subunit || policy.isServiceUnitLeader) && form.leaders.mode === "sub_unit" && leaderUnitHasSubUnits && (
                    <div className="sa-field" style={{ marginBottom: 0 }}>
                      <label className="sa-label">
                        Sub-unit <span className="sa-required">*</span>
                      </label>
                      {policy.lockedSubUnit ? (
                        <LockedGeoField label="" value={policy.lockedSubUnit} />
                      ) : (
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
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      )}

      {!policy.membersOnly && !policy.isSatellitePastor && form.destination_type === "admins" && (
        <section
          className="sa-ann-scope"
          aria-label={
            policy.isStateBranchAudience
              ? "Satellite pastor audience"
              : policy.isCountryAdmin
                ? "Pastor audience"
                : "Admin audience"
          }
        >
          {!useUnifiedGeo ? <div className="sa-ann-scope-title">Audience scope</div> : null}
          {!useUnifiedGeo ? (
          <AnnouncementAudienceGeoScope
            scope={form.admins}
            onScopeChange={(patch) => setForm((f) => ({ ...f, admins: { ...f.admins, ...patch } }))}
            churches={churches}
            branchCountries={branchCountries}
            requireCountry
            vis={policy.visibility}
            lockedCountryCode={policy.lockedCountry}
            lockedStateCode={policy.lockedState}
            lockedSatelliteSite={policy.lockedSatellite}
          />
          ) : null}
          {!useUnifiedGeo ? (
          <p className="sa-field-hint" style={{ marginTop: 12, marginBottom: 14 }}>
            {scopeHint}
          </p>
          ) : null}
          <div className="sa-ann-scope-title">{destLabels.adminRolesSectionTitle}</div>
          {!useUnifiedGeo ? (
          <p className="sa-field-hint" style={{ marginTop: 0, marginBottom: 12 }}>
            {destLabels.adminRolesHint ||
              (policy.isGlobal
                ? "Tick all boxes to reach every admin tier, or limit to selected roles only."
                : "Only admin tiers within your jurisdiction are available.")}
          </p>
          ) : null}
          <div className="sa-ann-admin-role-row" role="group" aria-label="Admin roles">
            {policy.adminRoleOptions.map((r) => (
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
                checked={form.medium_push}
                onChange={(e) => setForm((f) => ({ ...f, medium_push: e.target.checked }))}
              />
              <span className="sa-field-toggle-label">Push notification</span>
            </label>
          </div>
          <p className="sa-field-hint" style={{ marginTop: 8, marginBottom: 0 }}>
            Email sends to recipient addresses. Push delivers in-app notifications to admin accounts in your audience
            (leaders and pastors).
          </p>
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
