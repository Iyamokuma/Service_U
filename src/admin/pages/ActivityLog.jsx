import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { useToast } from "../components/Toast.jsx";
import { useAdminAuth } from "../AdminContext.jsx";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function fmtDateTime(str) { if (!str) return "—"; const d = new Date(str); return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`; }
function actionDotClass(action) { if (action.includes("login")) return "login"; if (action.includes("logout")) return "logout"; if (action.includes("create")) return "create"; if (action.includes("update") || action.includes("queue.update")) return "update"; if (action.includes("delete")) return "delete"; return "default"; }
function actionIcon(cls) { const map = { login: "→", logout: "←", create: "+", update: "✎", delete: "✕", default: "·" }; return map[cls] || "·"; }
const ACTION_TYPES = ["admin.login", "admin.logout", "admin.create", "admin.update", "admin.delete", "unit.create", "unit.update", "unit.delete", "queue.update", "queue.delete"];

export function ActivityLog() {
  const toast = useToast();
  const { admin } = useAdminAuth();
  const [rows, setRows] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [pag, setPag] = useState({ page: 1, per_page: 50, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ search: "", action: "", admin_id: "", entity: "", from: "", to: "" });
  const debounce = useRef(null);

  const load = useCallback(async (params) => {
    setLoading(true);
    try {
      const res = await api.activity({ ...params, page: params.page ?? 1, viewer: admin });
      setRows(res.data);
      setPag(res.pagination);
      if (res.admins?.length) setAdmins(res.admins);
    } catch (e) { toast(e.message, "error"); }
    finally { setLoading(false); }
  }, [toast, admin]);

  useEffect(() => { clearTimeout(debounce.current); debounce.current = setTimeout(() => load({ ...filters, page: 1 }), 300); }, [filters, load]);
  const setFilter = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));
  const gotoPage = (p) => load({ ...filters, page: p });

  return (
    <>
      <div style={{ marginBottom: 20 }}><h2 style={{ fontSize: 16, fontWeight: 700 }}>Activity Log</h2><p className="sa-text-muted sa-text-sm">Full audit trail of all admin actions.</p></div>
      <div className="sa-card">
        <div className="sa-filters">
          <div className="sa-search" style={{ minWidth: 220 }}><span className="sa-search-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span><input placeholder="Search description, admin…" value={filters.search} onChange={setFilter("search")} /></div>
          <select className="sa-select" value={filters.action} onChange={setFilter("action")}><option value="">All Actions</option>{ACTION_TYPES.map((a) => <option key={a} value={a}>{a}</option>)}</select>
          <select className="sa-select" value={filters.admin_id} onChange={setFilter("admin_id")}><option value="">All Admins</option>{admins.map((a) => <option key={a.admin_id} value={a.admin_id}>{a.admin_name}</option>)}</select>
          <select className="sa-select" value={filters.entity} onChange={setFilter("entity")}><option value="">All Entities</option><option value="registration">Registration</option><option value="unit">Unit</option><option value="admin">Admin</option></select>
          <div className="sa-date-range-group" aria-label="Date range">
            <div className="sa-date-field">
              <span className="sa-date-placeholder" aria-hidden="true">Start date</span>
              <input
                id="activity-filter-from"
                aria-label="Start date"
                className={`sa-date-field-input${!filters.from ? " sa-date-empty" : ""}`}
                type="date"
                value={filters.from}
                onChange={setFilter("from")}
              />
            </div>
            <div className="sa-date-field">
              <span className="sa-date-placeholder" aria-hidden="true">End date</span>
              <input
                id="activity-filter-to"
                aria-label="End date"
                className={`sa-date-field-input${!filters.to ? " sa-date-empty" : ""}`}
                type="date"
                value={filters.to}
                onChange={setFilter("to")}
              />
            </div>
          </div>
          <button className="sa-btn sa-btn-outline sa-btn-sm" onClick={() => setFilters({ search: "", action: "", admin_id: "", entity: "", from: "", to: "" })}>Clear</button>
          <span className="sa-text-muted sa-text-sm" style={{ marginLeft: "auto", whiteSpace: "nowrap" }}>{pag.total} event{pag.total !== 1 ? "s" : ""}</span>
        </div>
        {loading ? <div className="sa-loading"><div className="sa-spinner"/><span>Loading…</span></div> : rows.length === 0 ? <div className="sa-empty"><div className="sa-empty-icon">📋</div><div className="sa-empty-text">No activity found.</div></div> : (
          <div style={{ padding: "8px 20px" }}><ul className="sa-activity-list">{rows.map((a) => { const cls = actionDotClass(a.action); return <li key={a.id} className="sa-activity-item"><div className={`sa-activity-dot ${cls}`}>{actionIcon(cls)}</div><div className="sa-activity-info"><div className="sa-activity-desc"><strong>{a.admin_name || "System"}</strong>{" — "}{a.description || a.action}</div><div className="sa-activity-meta"><span className="sa-badge viewer" style={{ fontSize: 10, padding: "1px 6px" }}>{a.action}</span>{a.entity_type && <> · {a.entity_type} #{a.entity_id}</>}{a.ip_address && <> · {a.ip_address}</>}{" · "}{fmtDateTime(a.created_at)}</div></div></li>; })}</ul></div>
        )}
        {pag.pages > 1 && <div className="sa-pagination"><span>Page {pag.page} of {pag.pages} ({pag.total} total)</span><div className="sa-pag-btns"><button className="sa-pag-btn" disabled={pag.page <= 1} onClick={() => gotoPage(pag.page - 1)}>‹</button>{Array.from({ length: Math.min(7, pag.pages) }, (_, i) => { const p = pag.page <= 4 ? i + 1 : pag.page - 3 + i; if (p > pag.pages) return null; return <button key={p} className={`sa-pag-btn${p === pag.page ? " active" : ""}`} onClick={() => gotoPage(p)}>{p}</button>; })}<button className="sa-pag-btn" disabled={pag.page >= pag.pages} onClick={() => gotoPage(pag.page + 1)}>›</button></div></div>}
      </div>
    </>
  );
}

