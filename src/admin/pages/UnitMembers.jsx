import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useToast } from "../components/Toast.jsx";
import { useAdminAuth } from "../AdminContext.jsx";

export function UnitMembers({ units }) {
  const toast = useToast();
  const { admin } = useAdminAuth();
  const isLeader = ["service_unit_leader", "sub_unit_leader"].includes(admin?.role);
  const [rows, setRows] = useState([]);
  const [pag, setPag] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ search: "", unit_id: "" });

  const load = async (page = 1) => {
    setLoading(true);
    try {
      const res = await api.members({
        ...filters,
        page,
        per_page: 25,
        viewer: admin,
        unit_id: isLeader ? admin?.service_unit_id : filters.unit_id,
      });
      setRows(res.data || []);
      setPag(res.pagination || { page: 1, pages: 1, total: 0 });
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(1); }, [filters.search, filters.unit_id]);

  return (
    <div className="sa-card">
      <div className="sa-filters">
        <input className="sa-input" placeholder="Search member name/email/phone" value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} />
        <select className="sa-select" value={isLeader ? admin?.service_unit_id || "" : filters.unit_id} onChange={(e) => setFilters((f) => ({ ...f, unit_id: e.target.value }))} disabled={isLeader}>
          <option value="">All Units</option>
          {(units?.data || []).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>

      <div className="sa-table-wrap">
        {loading ? <div className="sa-loading"><div className="sa-spinner" /><span>Loading…</span></div> : (
          <table className="sa-table">
            <thead>
              <tr>
                <th>Ref</th><th>Name</th><th>Phone</th><th>Email</th><th>Unit</th><th>Sub-unit</th><th>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>{r.first_name} {r.surname}</td>
                  <td>{r.phone1}</td>
                  <td>{r.email || "—"}</td>
                  <td>{r.unit_name}</td>
                  <td>{r.sub_unit || "—"}</td>
                  <td>{new Date(r.submitted_at).toLocaleString()}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan="7" className="sa-empty-text" style={{ textAlign: "center", padding: "20px" }}>No approved members found.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
      {pag.pages > 1 && (
        <div className="sa-pagination">
          <span>Page {pag.page} of {pag.pages}</span>
          <div className="sa-pag-btns">
            <button className="sa-pag-btn" disabled={pag.page <= 1} onClick={() => load(pag.page - 1)}>‹</button>
            <button className="sa-pag-btn" disabled={pag.page >= pag.pages} onClick={() => load(pag.page + 1)}>›</button>
          </div>
        </div>
      )}
    </div>
  );
}

