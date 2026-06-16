import { useState, useEffect, useCallback } from "react";
import { api } from "../api.js";
import { Modal } from "../components/Modal.jsx";
import { DeleteConfirmWithMath } from "../components/DeleteConfirmWithMath.jsx";
import { AdminLoginMeta } from "../components/AdminLoginMeta.jsx";
import { useToast } from "../components/Toast.jsx";
import { AdminInviteBanner } from "../components/AdminInviteBanner.jsx";
import { toastAfterAdminCreate } from "../adminInviteUi.js";

export function ServiceUnits({ data, reload }) {
  const toast = useToast();
  const units = data?.data ?? [];

  const [expanded, setExpanded] = useState(null);
  const [unitModal, setUnitModal] = useState(null);
  const [subModal, setSubModal] = useState(null);
  const [delUnit, setDelUnit] = useState(null);
  const [delSub, setDelSub] = useState(null);
  const [delUnitInfo, setDelUnitInfo] = useState(null);
  const [delSubInfo, setDelSubInfo] = useState(null);
  const [allAdmins, setAllAdmins] = useState([]);
  const [saving, setSaving] = useState(false);

  const loadAdmins = useCallback(() => {
    api
      .admins()
      .then((r) => setAllAdmins(r.data || []))
      .catch(() => setAllAdmins([]));
  }, []);

  useEffect(() => {
    loadAdmins();
  }, [loadAdmins]);

  async function saveUnit(form) {
    setSaving(true);
    try {
      if (form.id) {
        await api.updateUnit(form.id, {
          name: form.name,
          description: form.description || "",
          coordinator: form.coordinator || "",
          sort_order: form.sort_order ?? 0,
          is_active: form.is_active,
          overdue_threshold_days:
            form.overdue_threshold_days === "" || form.overdue_threshold_days == null
              ? null
              : form.overdue_threshold_days,
        });
        toast("Unit updated.", "success");
      } else {
        const fn = String(form.leader_full_name || "").trim();
        const em = String(form.leader_email || "").trim();
        if (!fn || !em) {
          toast("Enter the service unit leader's full name and email.", "error");
          setSaving(false);
          return;
        }
        const { data: unit } = await api.createUnit({
          name: form.name,
          description: "",
          coordinator: "",
          sort_order: 0,
          is_active: form.is_active,
        });
        const res = await api.createAdmin({
          full_name: fn,
          email: em,
          role: "service_unit_leader",
          service_unit_id: unit.id,
          sub_unit_name: "",
          is_active: 1,
        });
        toastAfterAdminCreate(toast, { res, email: em, isEdit: false });
      }
      setUnitModal(null);
      reload();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function openDeleteUnit(unit) {
    setDelUnit(unit);
    setDelUnitInfo(null);
    try {
      const info = await api.unitDeleteInfo(unit.id);
      setDelUnitInfo(info);
    } catch (e) {
      toast(e.message, "error");
      setDelUnit(null);
    }
  }

  async function confirmDeleteUnit() {
    if (!delUnit) return;
    setSaving(true);
    try {
      await api.deleteUnit(delUnit.id);
      toast("Unit deleted.", "success");
      setDelUnit(null);
      setDelUnitInfo(null);
      loadAdmins();
      reload();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function saveSub(form) {
    setSaving(true);
    try {
      if (form.id) await api.updateSub(form.id, form);
      else await api.createSub(form);
      toast(form.id ? "Sub-unit updated." : "Sub-unit created.", "success");
      setSubModal(null);
      reload();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function openDeleteSub(sub) {
    setDelSub(sub);
    setDelSubInfo(null);
    try {
      const info = await api.subDeleteInfo(sub.id);
      setDelSubInfo(info);
    } catch (e) {
      toast(e.message, "error");
      setDelSub(null);
    }
  }

  async function confirmDeleteSub() {
    if (!delSub) return;
    setSaving(true);
    try {
      await api.deleteSub(delSub.id);
      toast("Sub-unit deleted.", "success");
      setDelSub(null);
      setDelSubInfo(null);
      loadAdmins();
      reload();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>Service Units</h2>
          <p className="sa-text-muted sa-text-sm">{units.length} units configured</p>
        </div>
        <button className="sa-btn sa-btn-primary" onClick={() => setUnitModal({})}>
          + New Unit
        </button>
      </div>

      <div className="sa-unit-tree">
        {units.length === 0 && (
          <div className="sa-empty">
            <div className="sa-empty-icon">🏷</div>
            <div className="sa-empty-text">No service units yet.</div>
          </div>
        )}
        {units.map((unit) => (
          <div className="sa-unit-node" key={unit.id}>
            <div className="sa-unit-header" onClick={() => setExpanded(expanded === unit.id ? null : unit.id)}>
              <div className="sa-unit-name">
                <span className={`sa-unit-chevron${expanded === unit.id ? " open" : ""}`}>▶</span>
                {unit.name}
                <span className={`sa-badge ${unit.is_active ? "active" : "inactive"}`} style={{ marginLeft: 6 }}>
                  {unit.is_active ? "Active" : "Inactive"}
                </span>
                {unit.sub_units?.length > 0 && (
                  <span className="sa-text-muted sa-text-sm">
                    · {unit.sub_units.length} sub-unit{unit.sub_units.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <div className="sa-table-actions" onClick={(e) => e.stopPropagation()}>
                {unit.coordinator && <span className="sa-text-muted sa-text-sm">{unit.coordinator}</span>}
                <button className="sa-btn sa-btn-outline sa-btn-sm" onClick={() => setUnitModal(unit)}>
                  Edit
                </button>
                <button className="sa-btn sa-btn-danger sa-btn-sm" onClick={() => openDeleteUnit(unit)}>
                  Delete
                </button>
              </div>
            </div>

            {expanded === unit.id && (
              <div className="sa-unit-subs">
                {unit.sub_units?.map((sub) => (
                  <div className="sa-sub-row" key={sub.id}>
                    <div className="sa-sub-name">
                      · {sub.name}
                      {!sub.is_active && (
                        <span className="sa-badge inactive" style={{ marginLeft: 6 }}>
                          Inactive
                        </span>
                      )}
                    </div>
                    <div className="sa-table-actions">
                      <button className="sa-btn sa-btn-ghost sa-btn-sm" onClick={() => setSubModal({ ...sub })}>
                        Edit
                      </button>
                      <button className="sa-btn sa-btn-danger sa-btn-sm" onClick={() => openDeleteSub(sub)}>
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
                <button className="sa-add-sub-btn" onClick={() => setSubModal({ unit_id: unit.id })}>
                  + Add sub-unit to {unit.name}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <UnitModal
        open={!!unitModal}
        data={unitModal}
        unitAdmins={
          unitModal?.id
            ? allAdmins.filter(
                (a) =>
                  Number(a.service_unit_id) === Number(unitModal.id) &&
                  (a.role === "service_unit_leader" || a.role === "sub_unit_leader"),
              )
            : []
        }
        subUnits={unitModal?.id ? units.find((u) => Number(u.id) === Number(unitModal.id))?.sub_units || [] : []}
        onClose={() => setUnitModal(null)}
        onSave={saveUnit}
        onAdminChange={() => {
          loadAdmins();
          reload();
        }}
        onInviteSent={(res, email) => toastAfterAdminCreate(toast, { res, email, isEdit: false })}
        saving={saving}
      />

      <SubModal open={!!subModal} data={subModal} onClose={() => setSubModal(null)} onSave={saveSub} saving={saving} />

      <DeleteConfirmWithMath
        open={!!delUnit && !!delUnitInfo}
        onClose={() => {
          setDelUnit(null);
          setDelUnitInfo(null);
        }}
        onConfirm={confirmDeleteUnit}
        title="Delete service unit"
        busy={saving}
        confirmLabel="Delete unit"
        message={`Delete "${delUnitInfo?.name || delUnit?.name}"?\n\nThis unit has ${delUnitInfo?.memberCount ?? 0} unit member${delUnitInfo?.memberCount === 1 ? "" : "s"}. All sub-units will be removed. This cannot be undone.\n\nAre you really sure?`}
      />

      <DeleteConfirmWithMath
        open={!!delSub && !!delSubInfo}
        onClose={() => {
          setDelSub(null);
          setDelSubInfo(null);
        }}
        onConfirm={confirmDeleteSub}
        title="Delete sub-unit"
        busy={saving}
        confirmLabel="Delete sub-unit"
        message={`Delete "${delSubInfo?.name || delSub?.name}"?\n\nThis sub-unit has ${delSubInfo?.memberCount ?? 0} member${delSubInfo?.memberCount === 1 ? "" : "s"}. All members will be removed. This cannot be undone.\n\nAre you really sure?`}
      />
    </>
  );
}

function roleLabel(role) {
  if (role === "service_unit_leader") return "Service unit leader";
  if (role === "sub_unit_leader") return "Sub-unit leader";
  return role;
}

function UnitModal({ open, data, unitAdmins = [], subUnits = [], onClose, onSave, onAdminChange, onInviteSent, saving }) {
  const emptyCreateForm = useCallback(
    () => ({
      name: "",
      is_active: 1,
      leader_full_name: "",
      leader_email: "",
    }),
    []
  );
  const [form, setForm] = useState(() => emptyCreateForm());
  const [wizardStep, setWizardStep] = useState(0);
  const [showAddLeader, setShowAddLeader] = useState(false);
  const [addLeaderForm, setAddLeaderForm] = useState({
    role: "sub_unit_leader",
    full_name: "",
    email: "",
    sub_unit_name: "",
  });

  useEffect(() => {
    if (!open) {
      setForm(emptyCreateForm());
      setWizardStep(0);
      setShowAddLeader(false);
      return;
    }
    if (data?.id) {
      setWizardStep(0);
      setForm({
        id: data.id,
        name: data.name || "",
        description: data.description || "",
        coordinator: data.coordinator || "",
        sort_order: data.sort_order ?? 0,
        is_active: data.is_active ?? 1,
        overdue_threshold_days: data.overdue_threshold_days ?? "",
        leader_full_name: "",
        leader_email: "",
      });
    } else {
      setWizardStep(0);
      setForm(emptyCreateForm());
    }
  }, [open, data?.id, emptyCreateForm]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const isCreate = !form.id;
  const leaders = unitAdmins || [];
  const subs = subUnits || [];
  const hasSubUnits = subs.length > 0;
  const hasUnitLeader = leaders.some((a) => a.role === "service_unit_leader");

  async function removeAdminAccount(admin) {
    if (!window.confirm(`Delete ${admin.full_name} (${admin.username}) permanently? They can be invited again with the same email.`)) return;
    try {
      await api.deleteAdmin(admin.id);
      onAdminChange?.();
    } catch (e) {
      /* toast from parent if needed */
      window.alert(e.message);
    }
  }

  async function saveNewLeader(e) {
    e.preventDefault();
    if (!form.id) return;
    const body = {
      full_name: addLeaderForm.full_name.trim(),
      email: addLeaderForm.email.trim(),
      role: addLeaderForm.role,
      service_unit_id: form.id,
      sub_unit_name: addLeaderForm.role === "sub_unit_leader" ? addLeaderForm.sub_unit_name : "",
      is_active: 1,
    };
    if (!body.full_name || !body.email) {
      window.alert("Enter the leader's full name and email.");
      return;
    }
    if (body.role === "service_unit_leader" && hasUnitLeader) {
      window.alert("This unit already has a service unit leader. Remove or reassign the existing one first.");
      return;
    }
    if (body.role === "sub_unit_leader" && !hasSubUnits) {
      window.alert("This service unit has no sub-units. Add sub-units first or assign a service unit leader.");
      return;
    }
    if (body.role === "sub_unit_leader" && !body.sub_unit_name) {
      window.alert("Select a sub-unit for this leader.");
      return;
    }
    try {
      const res = await api.createAdmin(body);
      setShowAddLeader(false);
      setAddLeaderForm({
        role: "sub_unit_leader",
        full_name: "",
        email: "",
        sub_unit_name: "",
      });
      onAdminChange?.();
      onInviteSent?.(res, body.email);
    } catch (err) {
      window.alert(err.message);
    }
  }

  async function reassignSubLeader(admin, subUnitName) {
    try {
      await api.updateAdmin(admin.id, { sub_unit_name: subUnitName });
      onAdminChange?.();
    } catch (e) {
      window.alert(e.message);
    }
  }

  function goNext() {
    if (!String(form.name || "").trim()) return;
    setWizardStep(1);
  }

  function goBack() {
    setWizardStep(0);
  }

  const editFooter = (
    <>
      <button type="button" className="sa-btn sa-btn-outline" onClick={onClose}>
        Cancel
      </button>
      <button type="button" className="sa-btn sa-btn-primary" onClick={() => onSave(form)} disabled={saving || !form.name.trim()}>
        {saving ? "Saving…" : "Save Changes"}
      </button>
    </>
  );

  const createFooterStep0 = (
    <>
      <button type="button" className="sa-btn sa-btn-outline" onClick={onClose}>
        Cancel
      </button>
      <button type="button" className="sa-btn sa-btn-primary" onClick={goNext} disabled={!String(form.name || "").trim()}>
        Next
      </button>
    </>
  );

  const createFooterStep1 = (
    <>
      <button type="button" className="sa-btn sa-btn-outline" onClick={goBack}>
        Back
      </button>
      <button type="button" className="sa-btn sa-btn-primary" onClick={() => onSave(form)} disabled={saving}>
        {saving ? "Saving…" : "Create unit & leader"}
      </button>
    </>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={form.id ? "Edit Service Unit" : "New Service Unit"}
      size="lg"
      footer={isCreate ? (wizardStep === 0 ? createFooterStep0 : createFooterStep1) : editFooter}
    >
      {isCreate ? (
        <>
          {wizardStep === 0 ? (
            <div className="sa-wizard-step">
              <div className="sa-field">
                <label className="sa-label">
                  Unit Name <span className="sa-required">*</span>
                </label>
                <input className="sa-input" value={form.name} onChange={set("name")} placeholder="e.g. Choir" autoFocus />
              </div>
              <div className="sa-field">
                <label className="sa-label">Status</label>
                <select className="sa-field-select" value={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: +e.target.value }))}>
                  <option value={1}>Active</option>
                  <option value={0}>Inactive</option>
                </select>
              </div>
            </div>
          ) : (
            <div className="sa-wizard-step">
              <AdminInviteBanner />
              <div className="sa-field">
                <label className="sa-label">
                  Leader full name <span className="sa-required">*</span>
                </label>
                <input
                  className="sa-input"
                  value={form.leader_full_name}
                  onChange={set("leader_full_name")}
                  placeholder="e.g. Jane Doe"
                  autoComplete="name"
                  autoFocus
                />
              </div>
              <div className="sa-field">
                <label className="sa-label">
                  Leader email <span className="sa-required">*</span>
                </label>
                <input
                  className="sa-input"
                  type="email"
                  value={form.leader_email}
                  onChange={set("leader_email")}
                  placeholder="leader@church.org"
                  autoComplete="email"
                />
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="sa-field">
            <label className="sa-label">
              Unit Name <span className="sa-required">*</span>
            </label>
            <input className="sa-input" value={form.name} onChange={set("name")} placeholder="e.g. Choir" autoFocus />
          </div>
          <div className="sa-field">
            <label className="sa-label">Status</label>
            <select className="sa-field-select" value={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: +e.target.value }))}>
              <option value={1}>Active</option>
              <option value={0}>Inactive</option>
            </select>
          </div>
          <div className="sa-field">
            <label className="sa-label">Overdue threshold override (days)</label>
            <input
              className="sa-input"
              type="number"
              min={1}
              max={30}
              placeholder="Use global default from Settings"
              value={form.overdue_threshold_days === null || form.overdue_threshold_days === undefined ? "" : form.overdue_threshold_days}
              onChange={(e) => {
                const v = e.target.value;
                setForm((f) => ({
                  ...f,
                  overdue_threshold_days: v === "" ? null : Math.min(30, Math.max(1, Number(v))),
                }));
              }}
            />
            <div className="sa-field-hint">Leave blank to use the global default (1–30 days). Applies to this unit only.</div>
          </div>

          <UnitAdminsPanel
            unitAdmins={unitAdmins}
            subUnits={subUnits}
            showAddLeader={showAddLeader}
            setShowAddLeader={setShowAddLeader}
            addLeaderForm={addLeaderForm}
            setAddLeaderForm={setAddLeaderForm}
            hasUnitLeader={hasUnitLeader}
            onRemove={removeAdminAccount}
            onReassign={reassignSubLeader}
            onSaveLeader={saveNewLeader}
          />
        </>
      )}
    </Modal>
  );
}

function UnitAdminsPanel({
  unitAdmins,
  subUnits,
  showAddLeader,
  setShowAddLeader,
  addLeaderForm,
  setAddLeaderForm,
  hasUnitLeader,
  onRemove,
  onReassign,
  onSaveLeader,
}) {
  return (
    <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--sa-border)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span className="sa-label" style={{ margin: 0 }}>
          Leaders &amp; admins for this unit
        </span>
        <button type="button" className="sa-btn sa-btn-outline sa-btn-sm" onClick={() => setShowAddLeader((v) => !v)}>
          {showAddLeader ? "Cancel" : "+ Add admin"}
        </button>
      </div>

      {unitAdmins.length === 0 ? (
        <p className="sa-text-sm sa-text-muted">No leader accounts linked to this unit yet.</p>
      ) : (
        <div className="sa-table-wrap" style={{ maxHeight: 220 }}>
          <table className="sa-table" style={{ fontSize: 13 }}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Sub-unit</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {unitAdmins.map((a) => (
                <tr key={a.id}>
                  <td>
                    <div>{a.full_name}</div>
                    <AdminLoginMeta username={a.username} email={a.email} />
                  </td>
                  <td>{roleLabel(a.role)}</td>
                  <td>
                    {a.role === "sub_unit_leader" ? (
                      <select
                        className="sa-field-select"
                        style={{ minWidth: 140, padding: "4px 8px", fontSize: 12 }}
                        value={a.sub_unit_name || ""}
                        onChange={(e) => onReassign(a, e.target.value)}
                      >
                        <option value="">—</option>
                        {subUnits.map((s) => (
                          <option key={s.id} value={s.name}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    <button type="button" className="sa-btn sa-btn-danger sa-btn-sm" onClick={() => onRemove(a)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAddLeader ? (
        <form onSubmit={onSaveLeader} style={{ marginTop: 14, padding: 12, background: "var(--sa-surface-2, #f8fafc)", borderRadius: 8 }}>
          <AdminInviteBanner />
          <div className="sa-field">
            <label className="sa-label">Role</label>
            <select
              className="sa-field-select"
              value={addLeaderForm.role}
              onChange={(e) => setAddLeaderForm((f) => ({ ...f, role: e.target.value }))}
            >
              <option value="sub_unit_leader" disabled={!hasSubUnits}>
                Sub-unit leader{!hasSubUnits ? " (no sub-units)" : ""}
              </option>
              <option value="service_unit_leader" disabled={hasUnitLeader}>
                Service unit leader{hasUnitLeader ? " (already assigned)" : ""}
              </option>
            </select>
          </div>
          {addLeaderForm.role === "sub_unit_leader" && hasSubUnits && (
            <div className="sa-field">
              <label className="sa-label">Sub-unit</label>
              <select
                className="sa-field-select"
                value={addLeaderForm.sub_unit_name}
                onChange={(e) => setAddLeaderForm((f) => ({ ...f, sub_unit_name: e.target.value }))}
                required
              >
                <option value="">Select sub-unit</option>
                {subs.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {addLeaderForm.role === "sub_unit_leader" && !hasSubUnits ? (
            <p className="sa-text-muted sa-text-sm" style={{ margin: "0 0 12px" }}>
              Add sub-units to this service unit before inviting a sub-unit leader.
            </p>
          ) : null}
          <div className="sa-field">
            <label className="sa-label">Full name</label>
            <input
              className="sa-input"
              value={addLeaderForm.full_name}
              onChange={(e) => setAddLeaderForm((f) => ({ ...f, full_name: e.target.value }))}
              placeholder="Jane Doe"
              required
            />
          </div>
          <div className="sa-field">
            <label className="sa-label">Email</label>
            <input
              className="sa-input"
              type="email"
              value={addLeaderForm.email}
              onChange={(e) => setAddLeaderForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="leader@church.org"
              required
            />
          </div>
          <button type="submit" className="sa-btn sa-btn-primary sa-btn-sm">
            Send invitation
          </button>
        </form>
      ) : null}
    </div>
  );
}

function SubModal({ open, data, onClose, onSave, saving }) {
  const [form, setForm] = useState({ name: "", sort_order: 0, is_active: 1 });

  if (open && data && form.name !== (data.name || "") && !form._init) {
    setForm({ name: data.name || "", sort_order: data.sort_order ?? 0, is_active: data.is_active ?? 1, unit_id: data.unit_id, id: data.id, _init: true });
  }
  if (!open && form._init) setForm({ name: "", sort_order: 0, is_active: 1 });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={form.id ? "Edit Sub-unit" : "Add Sub-unit"}
      size="sm"
      footer={
        <>
          <button type="button" className="sa-btn sa-btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="sa-btn sa-btn-primary" onClick={() => onSave(form)} disabled={saving || !form.name.trim()}>
            {saving ? "Saving…" : form.id ? "Save" : "Add"}
          </button>
        </>
      }
    >
      <div className="sa-field">
        <label className="sa-label">
          Sub-unit Name <span className="sa-required">*</span>
        </label>
        <input className="sa-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Lessons & teaching" autoFocus />
      </div>
      <div className="sa-form-row">
        <div className="sa-field">
          <label className="sa-label">Sort Order</label>
          <input className="sa-input" type="number" value={form.sort_order} onChange={(e) => setForm((f) => ({ ...f, sort_order: +e.target.value }))} min="0" />
        </div>
        <div className="sa-field">
          <label className="sa-label">Status</label>
          <select className="sa-field-select" value={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: +e.target.value }))}>
            <option value={1}>Active</option>
            <option value={0}>Inactive</option>
          </select>
        </div>
      </div>
    </Modal>
  );
}
