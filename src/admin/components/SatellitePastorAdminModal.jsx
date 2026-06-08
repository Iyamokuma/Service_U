import { useEffect, useMemo, useState } from "react";
import { Modal } from "./Modal.jsx";
import { branchCountryLabel, branchStateLabel } from "../branchRegions.js";
import { SearchableDropdown } from "./SearchableDropdown.jsx";
import {
  availableSatellitesForState,
  occupiedSatelliteSites,
  suggestedSatellitePastorUsername,
  validateSatellitePastorAdminForm,
} from "../stateSatelliteForm.js";
import { usesAdminInviteCreate } from "../adminAccountForm.js";

function shouldAutoFillUsername(username) {
  const u = String(username || "").trim().toLowerCase();
  return !u || /^[a-z0-9]{2,12}\.[a-z0-9]{2,12}\.[a-z0-9]{2,12}\.pastor$/.test(u);
}

export function SatellitePastorAdminModal({
  open,
  onClose,
  onSave,
  saving,
  countryCode,
  stateCode,
  churches = [],
  existingAdmins = [],
  pendingRequests = [],
  initialSatellite = "",
  editData = null,
  reassignOnly = false,
}) {
  const isEdit = !!editData?.id;
  const inviteCreate = usesAdminInviteCreate(isEdit);
  const cc = String(countryCode || "").toUpperCase();
  const st = String(stateCode || "").toUpperCase();

  const [form, setForm] = useState({
    full_name: "",
    username: "",
    email: "",
    password: "",
    satellite_site: "",
    is_active: 1,
  });

  const satelliteOptions = useMemo(
    () =>
      availableSatellitesForState(churches, cc, st, existingAdmins, pendingRequests, isEdit ? editData?.id : null),
    [churches, cc, st, existingAdmins, pendingRequests, isEdit, editData?.id],
  );

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
        is_active: editData.is_active ?? 1,
      });
      return;
    }
    const site = initialSatellite || "";
    setForm({
      full_name: "",
      username: site ? suggestedSatellitePastorUsername(cc, st, site) : "",
      email: "",
      password: "",
      satellite_site: site,
      is_active: 1,
    });
  }, [open, editData, initialSatellite, cc, st]);

  const set = (k) => (e) => {
    const v = k === "is_active" ? Number(e.target.value) : e.target.value;
    setForm((f) => {
      const next = { ...f, [k]: v };
      if (k === "satellite_site" && shouldAutoFillUsername(f.username)) {
        next.username = suggestedSatellitePastorUsername(cc, st, v);
      }
      return next;
    });
  };

  function submit() {
    const takenSites = occupiedSatelliteSites(existingAdmins, pendingRequests, cc, st, isEdit ? editData?.id : null);
    const msg = validateSatellitePastorAdminForm(
      { ...form, branch_country: cc, branch_state: st, role: "satellite_church_admin" },
      { countryCode: cc, stateCode: st, takenSites, isEdit, churches, inviteCreate },
    );
    if (msg) {
      onSave(null, msg);
      return;
    }
    onSave({
      ...form,
      role: "satellite_church_admin",
      branch_country: cc,
      branch_state: st,
      satellite_site: form.satellite_site,
    });
  }

  const dropdownOptions = useMemo(
    () => satelliteOptions.map((s) => ({ value: s.name, label: s.name })),
    [satelliteOptions],
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        reassignOnly ? "Reassign Satellite Pastor Admin" : isEdit ? "Edit Satellite Pastor Admin" : "New Satellite Pastor Admin"
      }
      size="md"
      footer={
        <>
          <button type="button" className="sa-btn sa-btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="sa-btn sa-btn-primary"
            onClick={submit}
            disabled={saving || (!isEdit && satelliteOptions.length === 0 && !initialSatellite)}
          >
            {saving ? "Saving…" : reassignOnly ? "Save reassignment" : isEdit ? "Save changes" : "Create account"}
          </button>
        </>
      }
    >
      <p className="sa-text-muted sa-text-sm" style={{ margin: "0 0 16px", lineHeight: 1.55 }}>
        {reassignOnly
          ? "Move this pastor admin to a different satellite church in your state."
          : `Assign one Satellite Pastor Admin per church in ${branchStateLabel(cc, st) || st}, ${branchCountryLabel(cc) || cc}.`}
      </p>
      {reassignOnly && isEdit ? (
        <div className="sa-field" style={{ marginBottom: 16 }}>
          <label className="sa-label">Admin</label>
          <input className="sa-input" value={form.full_name} disabled readOnly />
        </div>
      ) : null}
      {!reassignOnly ? (
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
      ) : null}
      <div className="sa-field">
        <label className="sa-label">
          Satellite church <span className="sa-required">*</span>
        </label>
        {isEdit && !reassignOnly ? (
          <input className="sa-input" value={form.satellite_site} disabled readOnly />
        ) : (
          <SearchableDropdown
            value={form.satellite_site}
            onChange={(site) =>
              setForm((f) => {
                const next = { ...f, satellite_site: site };
                if (shouldAutoFillUsername(f.username)) {
                  next.username = suggestedSatellitePastorUsername(cc, st, site);
                }
                return next;
              })
            }
            options={dropdownOptions}
            placeholder={satelliteOptions.length ? "Select satellite" : "No vacant satellites"}
            searchPlaceholder="Search satellite churches…"
            emptyMessage="No satellites available"
            ariaLabel="Satellite church"
          />
        )}
        {!isEdit && satelliteOptions.length === 0 && (
          <div className="sa-field-hint">Every satellite in this state already has a pastor admin assigned.</div>
        )}
      </div>
      {!reassignOnly ? (
        <>
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
                <input
                  className="sa-input"
                  value={form.username}
                  onChange={set("username")}
                  placeholder="ng.la.ikeja.pastor"
                  disabled={isEdit}
                />
              </div>
            ) : null}
          </div>
          <div className="sa-field">
            <label className="sa-label">
              Email <span className="sa-required">*</span>
            </label>
            <input className="sa-input" type="email" value={form.email} onChange={set("email")} />
            {inviteCreate ? (
              <div className="sa-field-hint">
                An invitation email with an activation link will be sent to this address.
              </div>
            ) : null}
          </div>
          {!inviteCreate ? (
            <div className="sa-field">
              <label className="sa-label">
                {isEdit ? "New password (optional)" : "Password"}{" "}
                {!isEdit && <span className="sa-required">*</span>}
              </label>
              <input
                className="sa-input"
                type="password"
                value={form.password}
                onChange={set("password")}
                placeholder="Min 8 characters"
              />
            </div>
          ) : null}
          {isEdit ? (
            <div className="sa-field">
              <label className="sa-label">Status</label>
              <select className="sa-field-select" value={form.is_active} onChange={set("is_active")}>
                <option value={1}>Active</option>
                <option value={0}>Inactive</option>
              </select>
            </div>
          ) : null}
        </>
      ) : null}
    </Modal>
  );
}
