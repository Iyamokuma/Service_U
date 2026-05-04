import { useState, useEffect, useCallback } from "react";
import { api } from "../api.js";
import { Modal, ConfirmModal } from "../components/Modal.jsx";
import { useToast } from "../components/Toast.jsx";

export function ServiceUnits({ data, reload }) {
  const toast = useToast();
  const units = data?.data ?? [];

  const [expanded, setExpanded] = useState(null);
  const [unitModal, setUnitModal] = useState(null);
  const [subModal, setSubModal] = useState(null);
  const [delUnit, setDelUnit] = useState(null);
  const [delSub, setDelSub] = useState(null);
  const [saving, setSaving] = useState(false);

  async function saveUnit(form) {
    setSaving(true);
    try {
      if (form.id) {
        await api.updateUnit(form.id, form);
        toast("Unit updated.", "success");
      } else {
        const fn = String(form.leader_full_name || "").trim();
        const un = String(form.leader_username || "").trim();
        const em = String(form.leader_email || "").trim();
        const pw = String(form.leader_password || "");
        if (!fn || !un || !em || !pw) {
          toast("Fill all service unit leader fields.", "error");
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
        await api.createAdmin({
          full_name: fn,
          username: un,
          email: em,
          password: pw,
          role: "service_unit_leader",
          service_unit_id: unit.id,
          sub_unit_name: "",
          is_active: 1,
        });
        toast(`Unit created. Leader is saved to Admin Accounts and can sign in as “${un}” with the password you set.`, "success");
      }
      setUnitModal(null);
      reload();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDeleteUnit() {
    try {
      await api.deleteUnit(delUnit.id);
      toast("Unit deleted.", "success");
      setDelUnit(null);
      reload();
    } catch (e) {
      toast(e.message, "error");
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

  async function confirmDeleteSub() {
    try {
      await api.deleteSub(delSub.id);
      toast("Sub-unit deleted.", "success");
      setDelSub(null);
      reload();
    } catch (e) {
      toast(e.message, "error");
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
                <button className="sa-btn sa-btn-danger sa-btn-sm" onClick={() => setDelUnit(unit)}>
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
                      <button className="sa-btn sa-btn-danger sa-btn-sm" onClick={() => setDelSub(sub)}>
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

      <UnitModal open={!!unitModal} data={unitModal} onClose={() => setUnitModal(null)} onSave={saveUnit} saving={saving} />

      <SubModal open={!!subModal} data={subModal} onClose={() => setSubModal(null)} onSave={saveSub} saving={saving} />

      <ConfirmModal
        open={!!delUnit}
        onClose={() => setDelUnit(null)}
        onConfirm={confirmDeleteUnit}
        title="Delete Service Unit"
        message={`Delete "${delUnit?.name}"? All sub-units will be removed. This cannot be undone.`}
        danger
      />

      <ConfirmModal
        open={!!delSub}
        onClose={() => setDelSub(null)}
        onConfirm={confirmDeleteSub}
        title="Delete Sub-unit"
        message={`Delete sub-unit "${delSub?.name}"?`}
        danger
      />
    </>
  );
}

function UnitModal({ open, data, onClose, onSave, saving }) {
  const emptyCreateForm = useCallback(
    () => ({
      name: "",
      is_active: 1,
      leader_full_name: "",
      leader_username: "",
      leader_email: "",
      leader_password: "",
    }),
    []
  );
  const [form, setForm] = useState(() => emptyCreateForm());
  const [wizardStep, setWizardStep] = useState(0);

  useEffect(() => {
    if (!open) {
      setForm(emptyCreateForm());
      setWizardStep(0);
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
        leader_full_name: "",
        leader_username: "",
        leader_email: "",
        leader_password: "",
      });
    } else {
      setWizardStep(0);
      setForm(emptyCreateForm());
    }
  }, [open, data?.id, emptyCreateForm]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const isCreate = !form.id;

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
      size="md"
      footer={isCreate ? (wizardStep === 0 ? createFooterStep0 : createFooterStep1) : editFooter}
    >
      {isCreate ? (
        <>
          <p className="sa-text-muted sa-text-sm" style={{ marginBottom: 12 }}>
            {wizardStep === 0
              ? "Step 1 of 2 — Enter unit details first. You will add the service unit leader on the next screen."
              : "Step 2 of 2 — Service unit leader (required). This account can sign in and manage the queue for this unit."}
          </p>
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
              <div className="sa-form-row">
                <div className="sa-field">
                  <label className="sa-label">
                    Username <span className="sa-required">*</span>
                  </label>
                  <input className="sa-input" value={form.leader_username} onChange={set("leader_username")} placeholder="Login id" autoComplete="username" />
                </div>
                <div className="sa-field">
                  <label className="sa-label">
                    Email <span className="sa-required">*</span>
                  </label>
                  <input className="sa-input" type="email" value={form.leader_email} onChange={set("leader_email")} placeholder="leader@example.com" autoComplete="email" />
                </div>
              </div>
              <div className="sa-field">
                <label className="sa-label">
                  Password <span className="sa-required">*</span>
                </label>
                <input className="sa-input" type="password" value={form.leader_password} onChange={set("leader_password")} placeholder="Initial password" autoComplete="new-password" />
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
        </>
      )}
    </Modal>
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
