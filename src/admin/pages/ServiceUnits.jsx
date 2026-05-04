import { useState, useEffect, useCallback } from "react";
import { api } from "../api.js";
import { Modal, ConfirmModal } from "../components/Modal.jsx";
import { useToast } from "../components/Toast.jsx";

export function ServiceUnits({ data, reload }) {
  const toast = useToast();
  const units = data?.data ?? [];

  const [expanded,   setExpanded]   = useState(null);
  const [unitModal,  setUnitModal]  = useState(null);   // null | {} (create) | unit (edit)
  const [subModal,   setSubModal]   = useState(null);   // null | { unit_id } (create) | sub (edit)
  const [delUnit,    setDelUnit]    = useState(null);
  const [delSub,     setDelSub]     = useState(null);
  const [saving,     setSaving]     = useState(false);

  /* ── Unit CRUD ──────────────────────────────────────────── */
  async function saveUnit(form) {
    setSaving(true);
    try {
      if (form.id) {
        await api.updateUnit(form.id, form);
        toast("Unit updated.", "success");
      } else {
        if (form.create_leader) {
          const fn = String(form.leader_full_name || "").trim();
          const un = String(form.leader_username || "").trim();
          const em = String(form.leader_email || "").trim();
          const pw = String(form.leader_password || "");
          if (!fn || !un || !em || !pw) {
            toast("Fill all service unit leader fields, or turn off “Create unit leader”.", "error");
            setSaving(false);
            return;
          }
        }
        const { data: unit } = await api.createUnit(form);
        if (form.create_leader) {
          const fn = String(form.leader_full_name || "").trim();
          const un = String(form.leader_username || "").trim();
          const em = String(form.leader_email || "").trim();
          const pw = String(form.leader_password || "");
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
        } else {
          toast("Unit created.", "success");
        }
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
    } catch (e) { toast(e.message, "error"); }
  }

  /* ── Sub-unit CRUD ──────────────────────────────────────── */
  async function saveSub(form) {
    setSaving(true);
    try {
      if (form.id) await api.updateSub(form.id, form);
      else         await api.createSub(form);
      toast(form.id ? "Sub-unit updated." : "Sub-unit created.", "success");
      setSubModal(null);
      reload();
    } catch (e) { toast(e.message, "error"); }
    finally { setSaving(false); }
  }

  async function confirmDeleteSub() {
    try {
      await api.deleteSub(delSub.id);
      toast("Sub-unit deleted.", "success");
      setDelSub(null);
      reload();
    } catch (e) { toast(e.message, "error"); }
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
          <div className="sa-empty"><div className="sa-empty-icon">🏷</div><div className="sa-empty-text">No service units yet.</div></div>
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
                  <span className="sa-text-muted sa-text-sm">· {unit.sub_units.length} sub-unit{unit.sub_units.length !== 1 ? "s" : ""}</span>
                )}
              </div>
              <div className="sa-table-actions" onClick={(e) => e.stopPropagation()}>
                {unit.coordinator && <span className="sa-text-muted sa-text-sm">{unit.coordinator}</span>}
                <button className="sa-btn sa-btn-outline sa-btn-sm" onClick={() => setUnitModal(unit)}>Edit</button>
                <button className="sa-btn sa-btn-danger  sa-btn-sm" onClick={() => setDelUnit(unit)}>Delete</button>
              </div>
            </div>

            {expanded === unit.id && (
              <div className="sa-unit-subs">
                {unit.sub_units?.map((sub) => (
                  <div className="sa-sub-row" key={sub.id}>
                    <div className="sa-sub-name">
                      · {sub.name}
                      {!sub.is_active && <span className="sa-badge inactive" style={{ marginLeft: 6 }}>Inactive</span>}
                    </div>
                    <div className="sa-table-actions">
                      <button className="sa-btn sa-btn-ghost sa-btn-sm" onClick={() => setSubModal({ ...sub })}>Edit</button>
                      <button className="sa-btn sa-btn-danger sa-btn-sm" onClick={() => setDelSub(sub)}>✕</button>
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

      {/* Unit modal */}
      <UnitModal open={!!unitModal} data={unitModal} onClose={() => setUnitModal(null)} onSave={saveUnit} saving={saving} />

      {/* Sub-unit modal */}
      <SubModal open={!!subModal} data={subModal} onClose={() => setSubModal(null)} onSave={saveSub} saving={saving} />

      {/* Confirm delete unit */}
      <ConfirmModal
        open={!!delUnit}
        onClose={() => setDelUnit(null)}
        onConfirm={confirmDeleteUnit}
        title="Delete Service Unit"
        message={`Delete "${delUnit?.name}"? All sub-units will be removed. This cannot be undone.`}
        danger
      />

      {/* Confirm delete sub */}
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

/* ── Unit form modal ──────────────────────────────────────── */
function UnitModal({ open, data, onClose, onSave, saving }) {
  const emptyForm = useCallback(
    () => ({
      name: "",
      description: "",
      coordinator: "",
      sort_order: 0,
      is_active: 1,
      create_leader: false,
      leader_full_name: "",
      leader_username: "",
      leader_email: "",
      leader_password: "",
    }),
    []
  );
  const [form, setForm] = useState(() => emptyForm());

  useEffect(() => {
    if (!open) {
      setForm(emptyForm());
      return;
    }
    if (data?.id) {
      setForm({
        ...emptyForm(),
        id: data.id,
        name: data.name || "",
        description: data.description || "",
        coordinator: data.coordinator || "",
        sort_order: data.sort_order ?? 0,
        is_active: data.is_active ?? 1,
      });
    } else {
      setForm(emptyForm());
    }
  }, [open, data?.id, emptyForm]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const isCreate = !form.id;

  return (
    <Modal
      open={open} onClose={onClose}
      title={form.id ? "Edit Service Unit" : "New Service Unit"}
      size="md"
      footer={<>
        <button type="button" className="sa-btn sa-btn-outline" onClick={onClose}>Cancel</button>
        <button type="button" className="sa-btn sa-btn-primary" onClick={() => onSave(form)} disabled={saving || !form.name.trim()}>
          {saving ? "Saving…" : (form.id ? "Save Changes" : "Create Unit")}
        </button>
      </>}
    >
      <div className="sa-field">
        <label className="sa-label">Unit Name <span className="sa-required">*</span></label>
        <input className="sa-input" value={form.name} onChange={set("name")} placeholder="e.g. Choir" />
      </div>
      <div className="sa-field">
        <label className="sa-label">Description</label>
        <textarea className="sa-textarea" value={form.description} onChange={set("description")} placeholder="Brief description…" />
      </div>
      <div className="sa-form-row">
        <div className="sa-field">
          <label className="sa-label">Coordinator Name</label>
          <input className="sa-input" value={form.coordinator} onChange={set("coordinator")} placeholder="Full name" />
        </div>
        <div className="sa-field">
          <label className="sa-label">Sort Order</label>
          <input className="sa-input" type="number" value={form.sort_order} onChange={(e) => setForm((f) => ({ ...f, sort_order: +e.target.value }))} min="0" />
        </div>
      </div>
      <div className="sa-field">
        <label className="sa-label">Status</label>
        <select className="sa-field-select" value={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: +e.target.value }))}>
          <option value={1}>Active</option>
          <option value={0}>Inactive</option>
        </select>
      </div>

      {isCreate && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--sa-border)" }}>
          <label className="sa-label" style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={!!form.create_leader}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  create_leader: e.target.checked,
                  ...(!e.target.checked
                    ? { leader_full_name: "", leader_username: "", leader_email: "", leader_password: "" }
                    : {}),
                }))
              }
            />
            Create service unit leader for this unit
          </label>
          <p className="sa-field-hint" style={{ marginTop: 6 }}>
            Optional. Creates an admin account scoped to this unit so they can manage the queue after the unit is saved.
          </p>
          {form.create_leader && (
            <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
              <div className="sa-field">
                <label className="sa-label">Leader full name <span className="sa-required">*</span></label>
                <input
                  className="sa-input"
                  value={form.leader_full_name}
                  onChange={set("leader_full_name")}
                  placeholder="e.g. Jane Doe"
                  autoComplete="name"
                />
              </div>
              <div className="sa-form-row">
                <div className="sa-field">
                  <label className="sa-label">Username <span className="sa-required">*</span></label>
                  <input className="sa-input" value={form.leader_username} onChange={set("leader_username")} placeholder="login id" autoComplete="username" />
                </div>
                <div className="sa-field">
                  <label className="sa-label">Email <span className="sa-required">*</span></label>
                  <input className="sa-input" type="email" value={form.leader_email} onChange={set("leader_email")} placeholder="leader@example.com" autoComplete="email" />
                </div>
              </div>
              <div className="sa-field">
                <label className="sa-label">Password <span className="sa-required">*</span></label>
                <input className="sa-input" type="password" value={form.leader_password} onChange={set("leader_password")} placeholder="Initial password" autoComplete="new-password" />
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

/* ── Sub-unit form modal ──────────────────────────────────── */
function SubModal({ open, data, onClose, onSave, saving }) {
  const [form, setForm] = useState({ name: "", sort_order: 0, is_active: 1 });

  if (open && data && form.name !== (data.name || "") && !form._init) {
    setForm({ name: data.name || "", sort_order: data.sort_order ?? 0, is_active: data.is_active ?? 1, unit_id: data.unit_id, id: data.id, _init: true });
  }
  if (!open && form._init) setForm({ name: "", sort_order: 0, is_active: 1 });

  return (
    <Modal
      open={open} onClose={onClose}
      title={form.id ? "Edit Sub-unit" : "Add Sub-unit"}
      size="sm"
      footer={<>
        <button className="sa-btn sa-btn-outline" onClick={onClose}>Cancel</button>
        <button className="sa-btn sa-btn-primary" onClick={() => onSave(form)} disabled={saving || !form.name.trim()}>
          {saving ? "Saving…" : (form.id ? "Save" : "Add")}
        </button>
      </>}
    >
      <div className="sa-field">
        <label className="sa-label">Sub-unit Name <span className="sa-required">*</span></label>
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
