import { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";
import { branchCountryLabel, branchStateLabel } from "../branchRegions.js";
import { useToast } from "../components/Toast.jsx";
import { useAdminAuth } from "../AdminContext.jsx";
import { canPostAnnouncements, isGlobalAdminRole } from "../roles.js";

function scopeHint(role) {
  switch (role) {
    case "sub_unit_leader":
      return "Posts are visible only to admins in your sub-unit.";
    case "service_unit_leader":
    case "data_entry_admin":
      return "Posts are visible only to admins for your service unit (whole unit, all sub-units).";
    case "country_super_admin":
      return "Posts are visible to admins in your country (country and state / satellite roles).";
    case "state_super_admin":
      return "Posts are visible to admins in your state, including satellite churches there.";
    case "satellite_church_admin":
      return "Satellite Pastor: posts reach admins scoped to your satellite site (same site label on their account).";
    case "super_admin":
    case "general_admin":
      return "Platform-wide posts (no country set) are visible to Super and General admins only. Use the API with a country code if you need a country-targeted post.";
    default:
      return null;
  }
}

function formatScope(r, unitNames) {
  const uid = r.scope_unit_id != null ? Number(r.scope_unit_id) : 0;
  if (uid > 0) {
    const un = unitNames[uid] || `Unit #${uid}`;
    return r.scope_sub_unit ? `${un} · ${r.scope_sub_unit}` : `${un} (whole unit)`;
  }
  const country = r.branch_country ? branchCountryLabel(r.branch_country) : "";
  const st = r.scope_branch_state
    ? branchStateLabel(r.branch_country, r.scope_branch_state)
    : "";
  const sat = (r.scope_satellite_site || "").trim();
  if (!country && !st && !sat) return "Platform-wide";
  return [country, st, sat].filter(Boolean).join(" · ") || "—";
}

export function Announcements() {
  const toast = useToast();
  const { admin } = useAdminAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [unitNames, setUnitNames] = useState({});
  const canCreate = canPostAnnouncements(admin?.role);
  const hint = scopeHint(admin?.role);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.announcements();
      setRows(res.data || []);
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api
      .units()
      .then((res) => {
        const m = {};
        (res?.data || []).forEach((u) => {
          m[u.id] = u.name;
        });
        setUnitNames(m);
      })
      .catch(() => {});
  }, []);

  async function createAnnouncement() {
    if (!title.trim() || !body.trim()) return;
    try {
      await api.createAnnouncement({ title: title.trim(), body: body.trim() });
      setTitle("");
      setBody("");
      toast("Announcement created.", "success");
      load();
    } catch (e) {
      toast(e.message, "error");
    }
  }

  async function removeAnnouncement(id) {
    if (!window.confirm("Delete this announcement?")) return;
    try {
      await api.deleteAnnouncement(id);
      toast("Announcement deleted.", "success");
      load();
    } catch (e) {
      toast(e.message, "error");
    }
  }

  function canDeleteRow(r) {
    if (isGlobalAdminRole(admin?.role)) return true;
    return Number(r.created_by_admin_id) === Number(admin?.id);
  }

  return (
    <div className="sa-card">
      {canCreate && (
        <div className="sa-card-body" style={{ borderBottom: "1px solid var(--sa-border)" }}>
          {hint ? (
            <p className="sa-text-sm sa-text-muted" style={{ marginBottom: 12 }}>
              {hint}
            </p>
          ) : null}
          <div className="sa-form-row">
            <div className="sa-field">
              <label className="sa-label">Title</label>
              <input
                className="sa-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Announcement title"
              />
            </div>
          </div>
          <div className="sa-field">
            <label className="sa-label">Message</label>
            <textarea
              className="sa-textarea"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Announcement body"
            />
          </div>
          <button className="sa-btn sa-btn-primary" style={{ width: "auto" }} onClick={createAnnouncement}>
            Create announcement
          </button>
        </div>
      )}

      <div className="sa-table-wrap">
        {loading ? (
          <div className="sa-loading">
            <div className="sa-spinner" />
            <span>Loading…</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="sa-empty">
            <div className="sa-empty-text">No announcements in your scope yet.</div>
          </div>
        ) : (
          <table className="sa-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Scope</th>
                <th>Title</th>
                <th>Message</th>
                <th>By</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.created_at).toLocaleString()}</td>
                  <td>{formatScope(r, unitNames)}</td>
                  <td>{r.title}</td>
                  <td>{r.body}</td>
                  <td>{r.created_by_name || "—"}</td>
                  <td>
                    {canDeleteRow(r) ? (
                      <button className="sa-btn sa-btn-danger sa-btn-sm" onClick={() => removeAnnouncement(r.id)}>
                        Delete
                      </button>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
