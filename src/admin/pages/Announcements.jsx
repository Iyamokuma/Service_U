import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { branchCountryLabel, branchStateLabel } from "../branchRegions.js";
import { useToast } from "../components/Toast.jsx";
import { useAdminAuth } from "../AdminContext.jsx";
import { canPostAnnouncements, isGlobalAdminRole } from "../roles.js";
import { AnnouncementCreateModal } from "../components/AnnouncementCreateModal.jsx";

const TABS = [
  { id: "general", label: "General" },
  { id: "draft", label: "Draft" },
  { id: "scheduled", label: "Scheduled" },
  { id: "archived", label: "Archived" },
];

function formatMedium(r) {
  const e = Number(r.medium_email) === 1;
  const s = Number(r.medium_sms) === 1;
  if (e && s) return "Email, SMS";
  if (e) return "Email";
  if (s) return "SMS";
  return "—";
}

function formatDestination(r, unitNames) {
  const type = r.destination_type || "admins";
  let cfg = {};
  if (r.destination_config && typeof r.destination_config === "object") {
    cfg = r.destination_config;
  } else if (typeof r.destination_config === "string" && r.destination_config.trim()) {
    try {
      const parsed = JSON.parse(r.destination_config);
      if (parsed && typeof parsed === "object") cfg = parsed;
    } catch {
      cfg = {};
    }
  }

  if (type === "members") {
    const m = cfg;
    const parts = [
      branchCountryLabel(m.branch_country),
      m.branch_state ? branchStateLabel(m.branch_country, m.branch_state) : "",
      m.satellite_site || "",
      m.service_unit_id ? unitNames[Number(m.service_unit_id)] || `Unit #${m.service_unit_id}` : "",
      m.sub_unit || "",
    ].filter(Boolean);
    return `Members · ${parts.join(" · ") || "All"}`;
  }

  if (type === "leaders") {
    const l = cfg;
    const mode =
      l.mode === "sub_unit"
        ? "Sub-unit leaders"
        : l.mode === "service_unit"
          ? "Service unit leaders"
          : "All leaders";
    const unit = l.service_unit_id ? unitNames[Number(l.service_unit_id)] : "";
    const sub = l.sub_unit || "";
    return ["Leaders", mode, unit, sub].filter(Boolean).join(" · ");
  }

  if (type === "admins") {
    const roles = Array.isArray(cfg.roles) ? cfg.roles.join(", ") : "Admins";
    return `Admins · ${roles}`;
  }

  const uid = r.scope_unit_id != null ? Number(r.scope_unit_id) : 0;
  if (uid > 0) {
    const un = unitNames[uid] || `Unit #${uid}`;
    return r.scope_sub_unit ? `${un} · ${r.scope_sub_unit}` : `${un} (whole unit)`;
  }
  const country = r.branch_country ? branchCountryLabel(r.branch_country) : "";
  const st = r.scope_branch_state ? branchStateLabel(r.branch_country, r.scope_branch_state) : "";
  const sat = (r.scope_satellite_site || "").trim();
  if (!country && !st && !sat) return "In-app (legacy)";
  return [country, st, sat].filter(Boolean).join(" · ") || "—";
}

function fmtDateTime(str) {
  if (!str) return "—";
  return new Date(str).toLocaleString();
}

export function Announcements() {
  const toast = useToast();
  const { admin } = useAdminAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("general");
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [unitNames, setUnitNames] = useState({});
  const [unitList, setUnitList] = useState([]);
  const [loadError, setLoadError] = useState("");
  const canCreate = canPostAnnouncements(admin?.role);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await api.announcements();
      setRows(Array.isArray(res?.data) ? res.data : []);
    } catch (e) {
      const msg = e?.message || "Could not load announcements.";
      setLoadError(msg);
      toast?.(msg, "error");
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
        const list = res?.data || [];
        setUnitList(list);
        const m = {};
        list.forEach((u) => {
          m[u.id] = u.name;
        });
        setUnitNames(m);
      })
      .catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const st = r.workflow_status || "sent";
      if (tab === "general") return st === "sent";
      if (tab === "draft") return st === "draft";
      if (tab === "scheduled") return st === "scheduled";
      if (tab === "archived") return st === "archived";
      return true;
    });
  }, [rows, tab]);

  async function handleCreate(payload, validationError) {
    if (validationError) {
      toast(validationError, "error");
      return;
    }
    setSaving(true);
    try {
      await api.createAnnouncement(payload);
      toast(
        payload.workflow_action === "draft"
          ? "Draft saved."
          : payload.workflow_action === "schedule"
            ? "Announcement scheduled."
            : "Announcement sent.",
        "success",
      );
      setShowCreate(false);
      load();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function runAction(id, body, successMsg) {
    try {
      await api.updateAnnouncement(id, body);
      toast(successMsg, "success");
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

  function canManageRow(r) {
    if (isGlobalAdminRole(admin?.role)) return true;
    return Number(r.created_by_admin_id) === Number(admin?.id);
  }

  function renderActions(r) {
    if (!canManageRow(r)) return "—";
    const st = r.workflow_status || "sent";
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {st === "draft" && (
          <>
            <button type="button" className="sa-btn sa-btn-primary sa-btn-sm" onClick={() => runAction(r.id, { action: "send" }, "Sent.")}>
              Send
            </button>
            <button type="button" className="sa-btn sa-btn-outline sa-btn-sm" onClick={() => runAction(r.id, { action: "archive" }, "Archived.")}>
              Archive
            </button>
          </>
        )}
        {st === "scheduled" && (
          <>
            <button type="button" className="sa-btn sa-btn-primary sa-btn-sm" onClick={() => runAction(r.id, { action: "send" }, "Sent now.")}>
              Send now
            </button>
            <button type="button" className="sa-btn sa-btn-outline sa-btn-sm" onClick={() => runAction(r.id, { action: "archive" }, "Archived.")}>
              Archive
            </button>
          </>
        )}
        {st === "sent" && (
          <button type="button" className="sa-btn sa-btn-outline sa-btn-sm" onClick={() => runAction(r.id, { action: "archive" }, "Archived.")}>
            Archive
          </button>
        )}
        <button type="button" className="sa-btn sa-btn-danger sa-btn-sm" onClick={() => removeAnnouncement(r.id)}>
          Delete
        </button>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>Announcements</h2>
          <p className="sa-text-muted sa-text-sm">
            Broadcast to members, leaders, or admins by email and/or SMS. SMS delivery requires provider setup on the server.
          </p>
        </div>
        {canCreate && (
          <button type="button" className="sa-btn sa-btn-primary" onClick={() => setShowCreate(true)}>
            + Create announcement
          </button>
        )}
      </div>

      <div className="sa-card">
        <div className="sa-card-body sa-unit-tab-row">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`sa-unit-tab-btn ${tab === t.id ? "is-active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="sa-table-wrap">
          {loading ? (
            <div className="sa-loading">
              <div className="sa-spinner" />
              <span>Loading…</span>
            </div>
          ) : loadError ? (
            <div className="sa-empty">
              <div className="sa-empty-text">{loadError}</div>
              <button type="button" className="sa-btn sa-btn-outline sa-btn-sm" style={{ marginTop: 12 }} onClick={() => load()}>
                Retry
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="sa-empty">
              <div className="sa-empty-text">No announcements in this tab.</div>
            </div>
          ) : (
            <table className="sa-table">
              <thead>
                <tr>
                  <th>Message title</th>
                  <th>Destination</th>
                  <th>Message</th>
                  <th>Email / SMS</th>
                  {tab === "general" && <th>Sent</th>}
                  {tab === "scheduled" && <th>Scheduled for</th>}
                  {tab === "draft" && <th>Last updated</th>}
                  {tab === "archived" && <th>Archived</th>}
                  <th>By</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td className="sa-fw-600">{r.title}</td>
                    <td className="sa-text-sm sa-text-muted">{formatDestination(r, unitNames)}</td>
                    <td style={{ maxWidth: 280 }}>{r.body}</td>
                    <td>{formatMedium(r)}</td>
                    {tab === "general" && <td className="sa-text-muted sa-text-sm">{fmtDateTime(r.sent_at || r.created_at)}</td>}
                    {tab === "scheduled" && (
                      <td className="sa-text-muted sa-text-sm">{fmtDateTime(r.scheduled_at)}</td>
                    )}
                    {tab === "draft" && <td className="sa-text-muted sa-text-sm">{fmtDateTime(r.updated_at)}</td>}
                    {tab === "archived" && <td className="sa-text-muted sa-text-sm">{fmtDateTime(r.archived_at)}</td>}
                    <td className="sa-text-sm">{r.created_by_name || "—"}</td>
                    <td>{renderActions(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showCreate ? (
        <AnnouncementCreateModal
          open
          onClose={() => setShowCreate(false)}
          onSubmit={handleCreate}
          saving={saving}
          unitList={unitList}
        />
      ) : null}
    </>
  );
}
