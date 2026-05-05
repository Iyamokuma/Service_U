import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useToast } from "../components/Toast.jsx";
import { useAdminAuth } from "../AdminContext.jsx";

export function Requests() {
  const toast = useToast();
  const { admin } = useAdminAuth();
  const isSuper = admin?.role === "super_admin" || admin?.role === "general_admin";
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState("");

  const load = async () => {
    try {
      const res = await api.requests(isSuper ? {} : { from_admin_id: admin.id });
      setRows(res.data || []);
    } catch (e) {
      toast(e.message, "error");
    }
  };

  useEffect(() => { load(); }, []);

  const send = async () => {
    if (!message.trim()) return;
    try {
      await api.createRequest({
        from_admin_id: admin.id,
        from_name: admin.full_name,
        from_role: admin.role,
        message: message.trim(),
      });
      setMessage("");
      toast("Request sent.", "success");
      load();
    } catch (e) {
      toast(e.message, "error");
    }
  };

  const mark = async (id, status) => {
    try {
      await api.updateRequest(id, { status });
      toast("Request updated.", "success");
      load();
    } catch (e) {
      toast(e.message, "error");
    }
  };

  return (
    <div className="sa-card">
      {!isSuper && (
        <div className="sa-card-body" style={{ borderBottom: "1px solid var(--sa-border)" }}>
          <div className="sa-field">
            <label className="sa-label">Send request to Super Admin</label>
            <textarea className="sa-textarea" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Type your request..." />
          </div>
          <button className="sa-btn sa-btn-primary" style={{ width: "auto" }} onClick={send}>Send Request</button>
        </div>
      )}

      <div className="sa-table-wrap">
        <table className="sa-table">
          <thead>
            <tr><th>Date</th><th>From</th><th>Role</th><th>Message</th><th>Status</th><th>Action</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.created_at).toLocaleString()}</td>
                <td>{r.from_name}</td>
                <td><span className={`sa-badge ${r.from_role}`}>{r.from_role.replace(/_/g, " ")}</span></td>
                <td>{r.message}</td>
                <td><span className={`sa-badge ${r.status}`}>{r.status}</span></td>
                <td>
                  {isSuper ? (
                    <select className="sa-select" value={r.status} onChange={(e) => mark(r.id, e.target.value)}>
                      <option value="open">open</option>
                      <option value="in_review">in_review</option>
                      <option value="resolved">resolved</option>
                    </select>
                  ) : "—"}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan="6" style={{ textAlign: "center", padding: "20px" }}>No requests found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

