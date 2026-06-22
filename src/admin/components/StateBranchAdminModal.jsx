import { useEffect, useMemo, useState } from "react";
import { Modal } from "./Modal.jsx";
import {
  branchCountryLabel,
  branchStateLabel,
  hydrateBranchLabelsFromDirectoryStates,
} from "../branchRegions.js";
import { SearchableSelect } from "./SearchableSelect.jsx";
import { api } from "../api.js";
import {
  allStatesInCountry,
  availableStatesForCountryAdmin,
  occupiedStateCodes,
  suggestedStateAdminUsername,
  validateStateBranchAdminForm,
} from "../stateAdminForm.js";
import { usesAdminInviteCreate } from "../adminAccountForm.js";
import { AdminInviteBanner } from "./AdminInviteBanner.jsx";
import { adminCreateButtonLabel } from "../adminInviteUi.js";
import { useAdminLocationCatalog } from "../hooks/useAdminLocationCatalog.js";
import { churchSelectOptionsForBranch } from "../satelliteSites.js";
import { parseHqChurchValue } from "../catalogGeoOptions.js";
import { StateRegionSelect } from "./StateRegionSelect.jsx";

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
  churches: churchesProp = null,
  catalog: catalogProp = null,
}) {
  const isEdit = !!editData?.id;
  const inviteCreate = usesAdminInviteCreate(isEdit);
  const cc = String(countryCode || "").toUpperCase();

  const hasExternalCatalog = catalogProp != null;
  const { churches: loadedChurches, catalog: loadedCatalog, loading: catalogLoading } = useAdminLocationCatalog({
    enabled: open && !hasExternalCatalog,
  });
  const catalog = hasExternalCatalog ? catalogProp : loadedCatalog;
  const churches = churchesProp?.length ? churchesProp : loadedChurches;

  const [directoryStates, setDirectoryStates] = useState([]);
  const [statesLoading, setStatesLoading] = useState(false);

  useEffect(() => {
    if (!open || !cc) {
      setDirectoryStates([]);
      setStatesLoading(false);
      return;
    }
    let cancelled = false;
    setStatesLoading(true);
    api
      .catalogStatesForCountry(cc)
      .then((res) => {
        if (cancelled) return;
        const rows = Array.isArray(res?.states) ? res.states : [];
        hydrateBranchLabelsFromDirectoryStates(cc, rows);
        setDirectoryStates(rows);
      })
      .catch(() => {
        if (!cancelled) setDirectoryStates([]);
      })
      .finally(() => {
        if (!cancelled) setStatesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, cc]);

  const allCountryStates = useMemo(
    () => allStatesInCountry(cc, { catalog, churches, directoryStates }),
    [cc, catalog, churches, directoryStates],
  );

  const [form, setForm] = useState({
    full_name: "",
    username: "",
    email: "",
    password: "",
    branch_state: "",
    satellite_site: "",
    is_active: 1,
  });

  const stateOptions = useMemo(
    () =>
      availableStatesForCountryAdmin(cc, existingAdmins, pendingRequests, isEdit ? editData?.id : null, {
        catalog,
        churches,
        directoryStates,
      }),
    [cc, existingAdmins, pendingRequests, isEdit, editData?.id, catalog, churches, directoryStates],
  );

  const churchOptions = useMemo(() => {
    if (!cc || !form.branch_state) return [];
    return churchSelectOptionsForBranch(churches, cc, form.branch_state).map((o) => ({
      value: parseHqChurchValue(o.value).satellite_site,
      label: o.label,
    }));
  }, [churches, cc, form.branch_state]);

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
        satellite_site: editData.satellite_site || "",
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
      satellite_site: "",
      is_active: 1,
    });
  }, [open, editData, initialStateCode, cc]);

  const set = (k) => (e) => {
    const v = k === "is_active" ? Number(e.target.value) : e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
  };

  function submit() {
    const takenStates = occupiedStateCodes(existingAdmins, pendingRequests, cc, isEdit ? editData?.id : null);
    const msg = validateStateBranchAdminForm(
      { ...form, branch_country: cc, role: "state_super_admin" },
      { countryCode: cc, takenStates, isEdit, inviteCreate, churches },
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
      satellite_site: form.satellite_site,
    });
  }

  const countryLabel = branchCountryLabel(cc);
  const editStateLabel =
    isEdit && form.branch_state ? branchStateLabel(cc, form.branch_state) : form.branch_state;

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
            disabled={saving || (!isEdit && stateOptions.length === 0 && !initialStateCode && !statesLoading)}
          >
            {adminCreateButtonLabel({ saving, isEdit, reassignOnly })}
          </button>
        </>
      }
    >
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
            <StateRegionSelect
              stateRows={stateOptions}
              countryCode={cc}
              value={form.branch_state}
              onChange={(code) => {
                setForm((f) => {
                  const next = { ...f, branch_state: code, satellite_site: "" };
                  if (shouldAutoFillUsername(f.username)) {
                    next.username = suggestedStateAdminUsername(cc, code);
                  }
                  return next;
                });
              }}
              emptyOption={!cc ? "—" : statesLoading ? "Loading states…" : "Select state"}
              disabled={!cc || statesLoading}
            />
          )}
          {!isEdit && !statesLoading && stateOptions.length === 0 && allCountryStates.length > 0 && (
            <div className="sa-field-hint">Every state in this country already has a State Branch Admin.</div>
          )}
          {!isEdit && !statesLoading && allCountryStates.length === 0 && (
            <div className="sa-field-hint">
              No states found for {countryLabel || cc} in the directory yet. Add locations via Data Entry or the branch
              catalog first.
            </div>
          )}
        </div>
      </div>
      {!reassignOnly && !isEdit ? (
        <div className="sa-field">
          <label className="sa-label">
            Church branch <span className="sa-required">*</span>
          </label>
          <SearchableSelect
            value={form.satellite_site}
            onChange={set("satellite_site")}
            options={churchOptions}
            disabled={!form.branch_state || catalogLoading}
            placeholder={
              !form.branch_state
                ? "Select state first"
                : catalogLoading
                  ? "Loading churches…"
                  : churchOptions.length
                    ? "Select church branch"
                    : "No churches in this state yet"
            }
            searchPlaceholder="Search church branches…"
            emptyMessage="No churches match your search"
            searchAriaLabel="Filter church branches"
          />
          <div className="sa-field-hint">
            {form.branch_state && !catalogLoading && churchOptions.length === 0
              ? "No churches listed for this state yet. Add branches via Data Entry or approve a location request first."
              : "State Branch Admin is tied to this church location within the selected state."}
          </div>
        </div>
      ) : null}
      {!reassignOnly ? (
        <>
          {inviteCreate ? <AdminInviteBanner /> : null}
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
