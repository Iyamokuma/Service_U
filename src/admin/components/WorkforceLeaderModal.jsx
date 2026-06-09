import { useEffect, useMemo, useState } from "react";
import { Modal } from "./Modal.jsx";
import { SearchableDropdown } from "./SearchableDropdown.jsx";
import { branchCountryLabel, branchStateLabel } from "../branchRegions.js";
import { satelliteSitesForBranch } from "../satelliteSites.js";
import { usesAdminInviteCreate } from "../adminAccountForm.js";
import { AdminInviteBanner } from "./AdminInviteBanner.jsx";
import { adminCreateButtonLabel } from "../adminInviteUi.js";
import { validateWorkforceLeaderForm } from "../stateLeaderForm.js";

export function WorkforceLeaderModal({
  open,
  onClose,
  onSave,
  saving,
  countryCode,
  stateCode,
  churches = [],
  units = [],
  initialRole = "service_unit_leader",
  editData = null,
  lockedSatelliteSite = "",
}) {
  const cc = String(countryCode || "").toUpperCase();
  const st = String(stateCode || "").toUpperCase();
  const isEdit = !!editData?.id;
  const inviteCreate = usesAdminInviteCreate(isEdit);
  const role = isEdit ? editData.role : initialRole;
  const isSubUnit = role === "sub_unit_leader";

  const [form, setForm] = useState({
    full_name: "",
    username: "",
    email: "",
    password: "",
    satellite_site: "",
    service_unit_id: "",
    sub_unit_name: "",
    is_active: 1,
  });

  const satelliteOptions = useMemo(
    () => satelliteSitesForBranch(churches, cc, st),
    [churches, cc, st],
  );

  const unitOptions = useMemo(
    () => (units || []).filter((u) => Number(u.is_active) !== 0),
    [units],
  );

  const subUnitOptions = useMemo(() => {
    const unit = unitOptions.find((u) => Number(u.id) === Number(form.service_unit_id));
    return (unit?.sub_units || []).filter((s) => Number(s.is_active) !== 0);
  }, [unitOptions, form.service_unit_id]);

  useEffect(() => {
    if (!open) return;
    if (editData?.id) {
      setForm({
        id: editData.id,
        full_name: editData.full_name || "",
        username: editData.username || "",
        email: editData.email || "",
        password: "",
        satellite_site: editData.satellite_site || "",
        service_unit_id: editData.service_unit_id || "",
        sub_unit_name: editData.sub_unit_name || "",
        is_active: editData.is_active ?? 1,
      });
      return;
    }
    setForm({
      full_name: "",
      username: "",
      email: "",
      password: "",
      satellite_site: lockedSatelliteSite || "",
      service_unit_id: unitOptions[0]?.id ? String(unitOptions[0].id) : "",
      sub_unit_name: "",
      is_active: 1,
    });
  }, [open, editData, unitOptions, lockedSatelliteSite]);

  const set = (k) => (e) => {
    const v = k === "service_unit_id" ? e.target.value : e.target.value;
    setForm((f) => {
      const next = { ...f, [k]: v };
      if (k === "service_unit_id") next.sub_unit_name = "";
      return next;
    });
  };

  function submit() {
    const msg = validateWorkforceLeaderForm(
      { ...form, role },
      { isEdit, role, units: unitOptions, inviteCreate },
    );
    if (msg) {
      onSave(null, msg);
      return;
    }
    onSave({
      ...form,
      role,
      branch_country: cc,
      branch_state: st,
      satellite_site: lockedSatelliteSite || form.satellite_site,
    });
  }

  const title = isEdit
    ? isSubUnit
      ? "Edit Sub-Unit Leader"
      : "Edit Service Unit Leader"
    : isSubUnit
      ? "New Sub-Unit Leader"
      : "New Service Unit Leader";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="md"
      footer={
        <>
          <button type="button" className="sa-btn sa-btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="sa-btn sa-btn-primary" onClick={submit} disabled={saving}>
            {adminCreateButtonLabel({ saving, isEdit })}
          </button>
        </>
      }
    >
      <div className="sa-form-row">
        <div className="sa-field">
          <label className="sa-label">Country</label>
          <input className="sa-input" value={branchCountryLabel(cc) || cc} disabled readOnly />
        </div>
        <div className="sa-field">
          <label className="sa-label">State / region</label>
          <input className="sa-input" value={branchStateLabel(cc, st) || st} disabled readOnly />
        </div>
      </div>
      <div className="sa-field">
        <label className="sa-label">
          Satellite church <span className="sa-required">*</span>
        </label>
        {isEdit || lockedSatelliteSite ? (
          <input
            className="sa-input"
            value={lockedSatelliteSite || form.satellite_site}
            disabled
            readOnly
          />
        ) : (
          <SearchableDropdown
            value={form.satellite_site}
            onChange={(site) => setForm((f) => ({ ...f, satellite_site: site }))}
            options={satelliteOptions.map((name) => ({ value: name, label: name }))}
            placeholder={satelliteOptions.length ? "Select satellite" : "No satellites in state"}
            searchPlaceholder="Search satellite churches…"
            emptyMessage="No satellites configured"
            ariaLabel="Satellite church"
          />
        )}
      </div>
      <div className="sa-field">
        <label className="sa-label">
          Service unit <span className="sa-required">*</span>
        </label>
        <select
          className="sa-field-select"
          value={form.service_unit_id}
          onChange={set("service_unit_id")}
          disabled={isEdit}
        >
          <option value="">Select unit</option>
          {unitOptions.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>
      {isSubUnit ? (
        <div className="sa-field">
          <label className="sa-label">
            Sub-unit <span className="sa-required">*</span>
          </label>
          <select
            className="sa-field-select"
            value={form.sub_unit_name}
            onChange={set("sub_unit_name")}
            disabled={!form.service_unit_id || isEdit}
          >
            <option value="">Select sub-unit</option>
            {subUnitOptions.map((s) => (
              <option key={s.id || s.name} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {inviteCreate ? <AdminInviteBanner /> : null}
      <div className={inviteCreate ? "sa-invite-form-section" : undefined}>
      <div className="sa-form-row">
        <div className="sa-field">
          <label className="sa-label">
            Full name <span className="sa-required">*</span>
          </label>
          <input className="sa-input" value={form.full_name} onChange={set("full_name")} placeholder="Jane Doe" />
        </div>
        {!inviteCreate ? (
          <div className="sa-field">
            <label className="sa-label">
              Username {!isEdit && <span className="sa-required">*</span>}
            </label>
            <input className="sa-input" value={form.username} onChange={set("username")} disabled={isEdit} />
          </div>
        ) : null}
      </div>
      <div className="sa-field">
        <label className="sa-label">
          Email <span className="sa-required">*</span>
        </label>
        <input className="sa-input" type="email" value={form.email} onChange={set("email")} placeholder="leader@church.org" />
      </div>
      {!inviteCreate ? (
        <div className="sa-field">
          <label className="sa-label">
            {isEdit ? "New password (optional)" : "Password"}{" "}
            {!isEdit && <span className="sa-required">*</span>}
          </label>
          <input className="sa-input" type="password" value={form.password} onChange={set("password")} />
        </div>
      ) : null}
      {isEdit ? (
        <div className="sa-field">
          <label className="sa-label">Status</label>
          <select
            className="sa-field-select"
            value={form.is_active}
            onChange={(e) => setForm((f) => ({ ...f, is_active: Number(e.target.value) }))}
          >
            <option value={1}>Active</option>
            <option value={0}>Inactive</option>
          </select>
        </div>
      ) : null}
      </div>
    </Modal>
  );
}
