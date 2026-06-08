import { useEffect, useMemo, useState } from "react";
import { Modal } from "./Modal.jsx";
import { branchCountryLabel, branchStateLabel, branchStatesForCountry } from "../branchRegions.js";
import {
  availableStatesForCountryAdmin,
  occupiedStateCodes,
  suggestedStateAdminUsername,
  validateStateBranchAdminForm,
} from "../stateAdminForm.js";
import { usesAdminInviteCreate } from "../adminAccountForm.js";

function shouldAutoFillUsername(username) {
  const u = String(username || "").trim().toLowerCase();
  return !u || /^[a-z0-9]{2,8}\.[a-z0-9]{1,12}\.admin$/.test(u);
}

export function StateBranchAdminModal({
  open,
  onClose,
  onSave,
  saving,
  countryCode,
  existingAdmins = [],
  pendingRequests = [],
  initialStateCode = "",
  editData = null,
  reassignOnly = false,
}) {
  const isEdit = !!editData?.id;
  const inviteCreate = usesAdminInviteCreate(isEdit);
  const cc = String(countryCode || "").toUpperCase();

  const [form, setForm] = useState({
    full_name: "",
    username: "",
    email: "",
    password: "",
    branch_state: "",
    is_active: 1,
  });

  const stateOptions = useMemo(
    () => availableStatesForCountryAdmin(cc, existingAdmins, pendingRequests, isEdit ? editData?.id : null),
    [cc, existingAdmins, pendingRequests, isEdit, editData?.id],
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
        branch_state: editData.branch_state || "",
        is_active: editData.is_active ?? 1,
      });
      return;
    }
    const st = initialStateCode || "";
    setForm({
      full_name: "",
      username: st ? suggestedStateAdminUsername(cc, st) : "",
      email: "",
      password: "",
      branch_state: st,
      is_active: 1,
    });
  }, [open, editData, initialStateCode, cc]);

  const set = (k) => (e) => {
    const v = k === "is_active" ? Number(e.target.value) : e.target.value;
    setForm((f) => {
      const next = { ...f, [k]: v };
      if (k === "branch_state" && shouldAutoFillUsername(f.username)) {
        next.username = suggestedStateAdminUsername(cc, v);
      }
      return next;
    });
  };

  function submit() {
    const takenStates = occupiedStateCodes(existingAdmins, pendingRequests, cc, isEdit ? editData?.id : null);
    const msg = validateStateBranchAdminForm(
      { ...form, branch_country: cc, role: "state_super_admin" },
      { countryCode: cc, takenStates, isEdit, inviteCreate },
    );
    if (msg) {
      onSave(null, msg);
      return;
    }
    onSave({
      ...form,
      role: "state_super_admin",
      branch_country: cc,
      branch_state: form.branch_state,
    });
  }

  const countryLabel = branchCountryLabel(cc);
  const editStateLabel =
    isEdit && form.branch_state
      ? branchStateLabel(cc, form.branch_state)
      : form.branch_state;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={reassignOnly ? "Reassign State Branch Admin" : isEdit ? "Edit State Branch Admin" : "New State Branch Admin"}
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
            disabled={saving || (!isEdit && stateOptions.length === 0 && !initialStateCode)}
          >
            {saving ? "Saving…" : reassignOnly ? "Save reassignment" : isEdit ? "Save changes" : "Create account"}
          </button>
        </>
      }
    >
      <p className="sa-text-muted sa-text-sm" style={{ margin: "0 0 16px", lineHeight: 1.55 }}>
        {reassignOnly
          ? "Move this admin to a different state. The previous state becomes vacant."
          : `Assign one State Branch Admin per state in ${countryLabel || cc}. They manage satellite pastor accounts for their state.`}
      </p>
      {reassignOnly && isEdit ? (
        <div className="sa-field" style={{ marginBottom: 16 }}>
          <label className="sa-label">Admin</label>
          <input className="sa-input" value={form.full_name} disabled readOnly />
        </div>
      ) : null}
      <div className="sa-form-row">
        <div className="sa-field">
          <label className="sa-label">Country</label>
          <input className="sa-input" value={countryLabel || cc} disabled readOnly />
        </div>
        <div className="sa-field">
          <label className="sa-label">
            State / region <span className="sa-required">*</span>
          </label>
          {isEdit && !reassignOnly ? (
            <input className="sa-input" value={editStateLabel || form.branch_state} disabled readOnly />
          ) : (
            <select className="sa-field-select" value={form.branch_state} onChange={set("branch_state")} disabled={!cc}>
              <option value="">{cc ? "Select state" : "—"}</option>
              {stateOptions.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
          {!isEdit && stateOptions.length === 0 && (
            <div className="sa-field-hint">Every state in this country already has a State Branch Admin.</div>
          )}
        </div>
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
                  placeholder="ng.la.admin"
                  disabled={isEdit}
                />
                {!isEdit && (
                  <div className="sa-field-hint">Usernames are unique worldwide — use country and state codes.</div>
                )}
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
