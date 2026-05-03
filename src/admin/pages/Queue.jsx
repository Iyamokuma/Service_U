import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { MONTHS as MONTHS_LONG } from "../../data.js";
import { api } from "../api.js";
import {
  BRANCH_COUNTRIES,
  branchCountryLabel,
  branchStateLabel,
  branchStatesForCountry,
  coerceStateForCountry,
} from "../branchRegions.js";
import { Modal, ConfirmModal } from "../components/Modal.jsx";
import { useToast } from "../components/Toast.jsx";
import { useAdminAuth } from "../AdminContext.jsx";

const STATUSES = ["new", "in_progress", "accepted", "rejected"];
const MONTHS   = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmtDate(str) {
  if (!str) return "—";
  const d = new Date(str);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}
function fullName(r) { return [r.first_name, r.surname].filter(Boolean).join(" "); }

function fmtMonthName(m) {
  if (m === undefined || m === null || m === "") return "";
  const n = Number(m);
  if (!Number.isFinite(n) || n < 1 || n > 12) return String(m);
  return MONTHS_LONG[n - 1] || String(m);
}
function fmtMdY(month, day, year) {
  const mo = fmtMonthName(month);
  const parts = [mo, day || "", year || ""].filter((x) => x !== "" && x !== undefined && x !== null);
  return parts.length ? parts.join(" ") : "—";
}
function fmtMy(month, year) {
  const mo = fmtMonthName(month);
  if (!mo && !year) return "—";
  return [mo, year || ""].filter(Boolean).join(" ");
}

function wolbiDetail(r) {
  if (!r.wolbi || r.wolbi === "No") return r.wolbi || "—";
  if (r.wolbi !== "Yes") return r.wolbi;
  const when = fmtMy(r.wolbi_month, r.wolbi_year);
  const level = r.wolbi_level || "";
  const parts = [when !== "—" ? when : "", level].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Yes";
}

function RegistrationDetails({ r }) {
  const ba = r.born_again === "Yes";
  return (
    <div className="sa-detail-inner">
      {r.photo_path && (
        <div className="sa-detail-field" style={{ gridColumn: "1 / -1" }}>
          <div className="sa-detail-label">Photo</div>
          <img src={r.photo_path} alt="" className="sa-photo" style={{ maxWidth: 140, maxHeight: 140, objectFit: "cover", borderRadius: 8 }} />
        </div>
      )}
      <Field label="Registration ref" value={String(r.id)} />
      <Field label="Other names" value={r.other_names || "—"} />
      <Field label="Date of birth" value={fmtMdY(r.dob_month, r.dob_day, r.dob_year)} />
      <Field label="Sex" value={r.sex || "—"} />
      <Field label="Marital status" value={r.marital_status || "—"} />
      <Field label="Nationality" value={r.nationality || "—"} />
      <Field label="Country (residence)" value={branchCountryLabel(r.branch_country)} />
      <Field label="State / region" value={branchStateLabel(r.branch_country, r.branch_state)} />
      <Field label="Residential address" value={r.address || "—"} />
      <Field label="Nearest bus stop" value={r.bus_stop || "—"} />
      <Field label="Primary phone" value={r.phone1 || "—"} />
      <Field label="Secondary phone" value={r.phone2 || "—"} />
      <Field label="Email" value={r.email || "—"} />
      <Field label="Workplace" value={r.workplace || "—"} />
      <Field label="Tithe card" value={r.tithe_card || "—"} />
      <Field label="Homecell" value={r.homecell || "—"} />
      <Field label="Service unit" value={r.unit_name || "—"} />
      <Field label="Sub-unit" value={r.sub_unit || "—"} />
      <Field label="Joined church" value={fmtMy(r.joined_church_month, r.joined_church_year)} />
      <Field label="Born again" value={r.born_again || "—"} />
      {ba && <Field label="Year born again" value={r.born_again_year || "—"} />}
      <Field label="Foundation class" value={ba ? r.foundation || "—" : "—"} />
      {ba && <Field label="Foundation class (when)" value={r.foundation === "Yes" ? fmtMy(r.foundation_month, r.foundation_year) : "—"} />}
      <Field label="Water baptised" value={ba ? r.baptised || "—" : "—"} />
      {ba && <Field label="Baptism (when)" value={r.baptised === "Yes" ? fmtMy(r.baptised_month, r.baptised_year) : "—"} />}
      <Field label="WOLBI" value={ba ? wolbiDetail(r) : "—"} />
      {r.notes ? <Field label="Internal notes" value={r.notes} /> : <Field label="Internal notes" value="—" />}
    </div>
  );
}

export function Queue({ units }) {
  const toast = useToast();
  const { admin } = useAdminAuth();
  const isServiceLeader = admin?.role === "service_unit_leader";
  const isSubUnitLeader = admin?.role === "sub_unit_leader";
  const canDelete = admin?.role === "super_admin";
  const canEditBranch = admin?.role === "super_admin";
  const [rows, setRows] = useState([]);
  const [sideBySide, setSideBySide] = useState([]);
  const [overdue, setOverdue] = useState([]);
  const [pag, setPag] = useState({ page: 1, per_page: 25, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [statusModal, setStatusModal] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);
  const [branchModal, setBranchModal] = useState(null);
  const [filters, setFilters] = useState({ search: "", unit_id: "", status: "", sex: "", from: "", to: "", sort: "submitted_at", dir: "DESC" });
  const [subUnitTab, setSubUnitTab] = useState("all");
  const debounce = useRef(null);

  const load = useCallback(async (params) => {
    setLoading(true);
    try {
      const res = await api.queue({ ...params, page: params.page ?? 1, per_page: 25, viewer: admin });
      setRows(res.data);
      setPag(res.pagination);
    } catch (e) { toast(e.message, "error"); }
    finally { setLoading(false); }
  }, [toast, admin]);

  useEffect(() => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      const scoped = {
        ...filters,
        page: 1,
        viewer: admin,
        unit_id: isSubUnitLeader ? admin?.service_unit_id : filters.unit_id,
        sub_unit: isSubUnitLeader ? admin?.sub_unit_name || admin?.sub_unit : subUnitTab === "all" ? "" : subUnitTab,
      };
      load(scoped);
    }, 300);
  }, [filters, subUnitTab, load, admin, isSubUnitLeader]);

  useEffect(() => {
    if (!isServiceLeader) return;
    api.subUnitQueuesByUnit(admin).then((r) => setSideBySide(r.data || [])).catch(() => {});
    api.overdueAlerts(admin).then((r) => setOverdue(r.data || [])).catch(() => {});
  }, [isServiceLeader, admin, rows.length]);

  const setFilter = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));
  const gotoPage = (p) => load({ ...filters, page: p, sub_unit: subUnitTab === "all" ? "" : subUnitTab });

  async function updateStatus(id, status, notes) {
    try {
      await api.updateStatus(id, { status, notes, viewer: admin });
      toast("Status updated.", "success");
      setStatusModal(null);
      load({ ...filters, page: pag.page, sub_unit: subUnitTab === "all" ? "" : subUnitTab });
    } catch (e) { toast(e.message, "error"); }
  }

  async function deleteReg(id) {
    try {
      await api.deleteReg(id);
      toast("Registration deleted.", "success");
      setDeleteModal(null);
      load({ ...filters, page: pag.page, sub_unit: subUnitTab === "all" ? "" : subUnitTab });
    } catch (e) { toast(e.message, "error"); }
  }

  async function saveRegistrationBranch(id, branch_country, branch_state) {
    try {
      await api.updateRegistrationBranch(id, { branch_country, branch_state, viewer: admin });
      toast("Country and state updated.", "success");
      setBranchModal(null);
      load({ ...filters, page: pag.page, sub_unit: subUnitTab === "all" ? "" : subUnitTab });
    } catch (e) {
      toast(e.message, "error");
    }
  }

  const unitOpts = units?.data ?? [];
  const allowedStatus = (current) => {
    const c = current || "new";
    if (!["service_unit_leader", "sub_unit_leader"].includes(admin?.role)) return STATUSES;
    if (c === "new") return ["new", "in_progress", "accepted", "rejected"];
    if (c === "in_progress") return ["in_progress", "accepted", "rejected", "new"];
    return [c];
  };

  return (
    <>
      <div className="sa-card">
        {isServiceLeader && (
          <div className="sa-card-body" style={{ borderBottom: "1px solid var(--sa-border)", display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["all", ...new Set(sideBySide.map((b) => b.sub_unit).filter(Boolean))].map((sub) => (
              <button key={sub} className={`sa-btn sa-btn-sm ${subUnitTab === sub ? "sa-btn-primary" : "sa-btn-outline"}`} style={{ width: "auto" }} onClick={() => setSubUnitTab(sub)}>
                {sub === "all" ? "All" : sub}
              </button>
            ))}
          </div>
        )}
        <div className="sa-filters">
          <div className="sa-search" style={{ minWidth: 240 }}>
            <span className="sa-search-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>
            <input placeholder="Search name, email, phone…" value={filters.search} onChange={setFilter("search")} />
          </div>
          <select className="sa-select" value={isServiceLeader || isSubUnitLeader ? admin?.service_unit_id || "" : filters.unit_id} onChange={setFilter("unit_id")} disabled={isServiceLeader || isSubUnitLeader}>
            <option value="">All Units</option>
            {unitOpts.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <select className="sa-select" value={filters.status} onChange={setFilter("status")}>
            <option value="">All Statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
          </select>
          <select className="sa-select" value={filters.sex} onChange={setFilter("sex")}>
            <option value="">All Genders</option><option value="Male">Male</option><option value="Female">Female</option>
          </select>
          <input className="sa-date-input" type="date" value={filters.from} onChange={setFilter("from")} />
          <input className="sa-date-input" type="date" value={filters.to} onChange={setFilter("to")} />
          <button className="sa-btn sa-btn-outline sa-btn-sm" onClick={() => setFilters({ search: "", unit_id: "", status: "", sex: "", from: "", to: "", sort: "submitted_at", dir: "DESC" })}>Clear</button>
          <span className="sa-text-muted sa-text-sm" style={{ marginLeft: "auto", whiteSpace: "nowrap" }}>{pag.total} result{pag.total !== 1 ? "s" : ""}</span>
        </div>

        <div className="sa-table-wrap">
          {loading ? <div className="sa-loading"><div className="sa-spinner"/><span>Loading…</span></div> : rows.length === 0 ? (
            <div className="sa-empty"><div className="sa-empty-icon">📋</div><div className="sa-empty-text">No registrations found.</div></div>
          ) : (
            <table className="sa-table">
              <thead><tr><th>#</th><th>Photo</th><th>Name</th><th>Unit</th><th>Phone</th><th>Email</th><th>Status</th><th>Submitted</th><th>Actions</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <Fragment key={r.id}>
                    <tr style={{ cursor: "pointer" }}>
                      <td className="sa-text-muted">{r.id}</td>
                      <td>{r.photo_path ? <img src={r.photo_path} className="sa-photo" alt="" /> : <div className="sa-photo-placeholder">{(r.first_name?.[0] || "?").toUpperCase()}</div>}</td>
                      <td><div className="sa-fw-600">{fullName(r)}</div>{r.other_names && <div className="sa-text-sm sa-text-muted">{r.other_names}</div>}</td>
                      <td><div>{r.unit_name}</div>{r.sub_unit && <div className="sa-text-sm sa-text-muted">{r.sub_unit}</div>}</td>
                      <td>{r.phone1}</td>
                      <td className="sa-truncate">{r.email || "—"}</td>
                      <td><span className={`sa-badge ${r.status}`}>{r.status}</span></td>
                      <td className="sa-text-muted">{fmtDate(r.submitted_at)}</td>
                      <td>
                        <div className="sa-table-actions">
                          <button type="button" className="sa-btn sa-btn-ghost sa-btn-sm" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>{expanded === r.id ? "▲" : "▼"}</button>
                          <button type="button" className="sa-btn sa-btn-outline sa-btn-sm" onClick={() => setStatusModal({ id: r.id, status: r.status, notes: r.notes || "" })}>Update</button>
                          {canEditBranch && (
                            <button type="button" className="sa-btn sa-btn-outline sa-btn-sm" onClick={() => setBranchModal({ id: r.id, branch_country: r.branch_country || "", branch_state: r.branch_state || "" })}>
                              Country / state
                            </button>
                          )}
                          {canDelete && <button type="button" className="sa-btn sa-btn-danger sa-btn-sm" onClick={() => setDeleteModal(r.id)}>Delete</button>}
                        </div>
                      </td>
                    </tr>
                    {expanded === r.id && (
                      <tr className="sa-detail-row">
                        <td colSpan={9}>
                          <RegistrationDetails r={r} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {isServiceLeader && (
        <>
          <div className="sa-card sa-gap-top">
            <div className="sa-card-head"><span className="sa-card-title">Sub-unit Queues (Side by Side)</span></div>
            <div className="sa-card-body" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 14 }}>
              {sideBySide.map((block) => (
                <div key={block.sub_unit} className="sa-unit-node"><div className="sa-unit-header"><div className="sa-unit-name">{block.sub_unit}</div></div><div className="sa-unit-subs">{block.items.slice(0, 8).map((i) => <div key={i.id} className="sa-sub-row"><span>{i.first_name} {i.surname}</span><span className={`sa-badge ${i.status}`}>{i.status.replace("_", " ")}</span></div>)}{block.items.length === 0 && <div className="sa-text-muted sa-text-sm">No queue items.</div>}</div></div>
              ))}
              {sideBySide.length === 0 && <div className="sa-text-muted">No sub-unit queues found.</div>}
            </div>
          </div>
          <div className="sa-card sa-gap-top">
            <div className="sa-card-head"><span className="sa-card-title">Overdue Alerts</span></div>
            <div className="sa-card-body">
              {overdue.length === 0 ? <div className="sa-text-muted">No overdue alerts right now.</div> : (
                <table className="sa-table"><thead><tr><th>Ref</th><th>Name</th><th>Sub-unit</th><th>Status</th><th>Submitted</th></tr></thead><tbody>
                  {overdue.map((o) => <tr key={o.id}><td>{o.id}</td><td>{o.first_name} {o.surname}</td><td>{o.sub_unit || "—"}</td><td><span className={`sa-badge ${o.status}`}>{o.status.replace("_", " ")}</span></td><td>{fmtDate(o.submitted_at)}</td></tr>)}
                </tbody></table>
              )}
              <div className="sa-field-hint" style={{ marginTop: 10 }}>Email notifications are simulated in this demo via this alert panel.</div>
            </div>
          </div>
        </>
      )}

      <StatusModal open={!!statusModal} data={statusModal} onClose={() => setStatusModal(null)} onSave={updateStatus} allowedStatus={allowedStatus} />
      <BranchGeoModal open={!!branchModal} data={branchModal} onClose={() => setBranchModal(null)} onSave={saveRegistrationBranch} />
      <ConfirmModal open={!!deleteModal} onClose={() => setDeleteModal(null)} onConfirm={() => deleteReg(deleteModal)} title="Delete Registration" message="Are you sure you want to permanently delete this registration? This cannot be undone." danger />
    </>
  );
}

function BranchGeoModal({ open, data, onClose, onSave }) {
  const [country, setCountry] = useState("");
  const [state, setState] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !data) return;
    const c = data.branch_country || "";
    setCountry(c);
    setState(coerceStateForCountry(c, data.branch_state || ""));
  }, [open, data?.id, data?.branch_country, data?.branch_state]);

  async function save() {
    if (!country || (branchStatesForCountry(country).length > 0 && !state)) return;
    setSaving(true);
    try {
      await onSave(data.id, country, state);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit country & state"
      size="sm"
      footer={
        <>
          <button type="button" className="sa-btn sa-btn-outline" onClick={onClose}>Cancel</button>
          <button type="button" className="sa-btn sa-btn-primary" onClick={save} disabled={saving || !country || (branchStatesForCountry(country).length > 0 && !state)}>
            {saving ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <p className="sa-text-muted sa-text-sm" style={{ marginBottom: 12 }}>
        Applies to this registration only. The detail panel updates after save.
      </p>
      <div className="sa-field">
        <label className="sa-label">Country</label>
        <select
          className="sa-field-select"
          value={country}
          onChange={(e) => {
            const c = e.target.value;
            setCountry(c);
            setState("");
          }}
        >
          <option value="">Select country</option>
          {BRANCH_COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>{c.name}</option>
          ))}
        </select>
      </div>
      <div className="sa-field">
        <label className="sa-label">State / region</label>
        <select
          className="sa-field-select"
          value={state}
          onChange={(e) => setState(e.target.value)}
          disabled={!country}
        >
          <option value="">{country ? "Select state" : "Select country first"}</option>
          {branchStatesForCountry(country).map((s) => (
            <option key={s.code} value={s.code}>{s.name}</option>
          ))}
        </select>
      </div>
    </Modal>
  );
}

function StatusModal({ open, data, onClose, onSave, allowedStatus }) {
  const [status, setStatus] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (data) { setStatus(data.status); setNotes(data.notes || ""); } }, [data]);
  async function save() { setSaving(true); await onSave(data.id, status, notes); setSaving(false); }
  return (
    <Modal open={open} onClose={onClose} title="Update Application Status" size="sm" footer={<><button className="sa-btn sa-btn-outline" onClick={onClose}>Cancel</button><button className="sa-btn sa-btn-primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</button></>}>
      <div className="sa-field"><label className="sa-label">Status</label><select className="sa-field-select" value={status} onChange={(e) => setStatus(e.target.value)}>{(allowedStatus(data?.status) || []).map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</select></div>
      <div className="sa-field"><label className="sa-label">Notes (optional)</label><textarea className="sa-textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add internal notes…" /></div>
    </Modal>
  );
}

function Field({ label, value }) {
  return (
    <div className="sa-detail-field">
      <div className="sa-detail-label">{label}</div>
      <div className="sa-detail-value">{value}</div>
    </div>
  );
}

