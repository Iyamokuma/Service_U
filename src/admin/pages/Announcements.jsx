import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { branchCountryLabel, branchStateLabel } from "../branchRegions.js";
import { useToast } from "../components/Toast.jsx";
import { useAdminAuth } from "../AdminContext.jsx";
import { canPostAnnouncements, isGlobalAdminRole } from "../roles.js";
import { AnnouncementCreateModal } from "../components/AnnouncementCreateModal.jsx";

/** Admin destination roles aligned with AnnouncementCreateModal options. */
const ADMIN_DEST_ROLE_KEYS = [
  "general_admin",
  "country_super_admin",
  "state_super_admin",
  "satellite_church_admin",
];

const ADMIN_DEST_LABELS = {
  general_admin: "General Admin",
  country_super_admin: "Country Admin",
  state_super_admin: "State Branch Admin",
  satellite_church_admin: "Satellite / Branch Admin",
};

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
    const geo = [
      branchCountryLabel(l.branch_country),
      l.branch_state ? branchStateLabel(l.branch_country, l.branch_state) : "",
      l.satellite_site || "",
    ].filter(Boolean);
    const mode =
      l.mode === "sub_unit"
        ? "Sub-unit leaders"
        : l.mode === "service_unit"
          ? "Service unit leaders"
          : "All leaders";
    const unit = l.service_unit_id ? unitNames[Number(l.service_unit_id)] : "";
    const sub = l.sub_unit || "";
    return ["Leaders", ...geo, mode, unit, sub].filter(Boolean).join(" · ");
  }

  if (type === "admins") {
    const geo = [
      branchCountryLabel(cfg.branch_country),
      cfg.branch_state ? branchStateLabel(cfg.branch_country, cfg.branch_state) : "",
      cfg.satellite_site || "",
    ].filter(Boolean);
    const raw = Array.isArray(cfg.roles) ? cfg.roles.filter(Boolean).map(String) : [];
    let rolePart = "All admins";
    if (raw.length > 0) {
      const selected = new Set(raw.map((role) => role.trim()));
      const allSelected = ADMIN_DEST_ROLE_KEYS.every((key) => selected.has(key));
      if (!(allSelected && selected.size <= ADMIN_DEST_ROLE_KEYS.length)) {
        rolePart = raw.map((key) => ADMIN_DEST_LABELS[key] || key.replace(/_/g, " ")).join(", ");
      }
    }
    return ["Admins", ...geo, rolePart].filter(Boolean).join(" · ");
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

function workflowRowStatus(r) {
  return String(r.workflow_status || "sent").trim().toLowerCase();
}

/** Single human-readable timeline cell per row */
function timelineCell(r) {
  const st = workflowRowStatus(r);
  if (st === "scheduled") return { primary: fmtDateTime(r.scheduled_at), hint: "Scheduled for" };
  if (st === "draft") return { primary: fmtDateTime(r.updated_at || r.created_at), hint: "Last updated" };
  if (st === "archived") return { primary: fmtDateTime(r.archived_at), hint: "Archived" };
  return { primary: fmtDateTime(r.sent_at || r.created_at), hint: "Sent" };
}

function statusBadgeClass(st) {
  if (st === "sent") return "active";
  if (st === "draft") return "in_review";
  if (st === "scheduled") return "open";
  if (st === "archived") return "archived";
  return "inactive";
}

function statusLabel(st) {
  if (st === "sent") return "Sent";
  if (st === "draft") return "Draft";
  if (st === "scheduled") return "Scheduled";
  if (st === "archived") return "Archived";
  return st || "—";
}

export function Announcements() {
  const toast = useToast();
  const { admin } = useAdminAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
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
    if (!statusFilter) return rows;
    return rows.filter((r) => workflowRowStatus(r) === statusFilter);
  }, [rows, statusFilter]);

  async function handleCreate(payload, validationError) {
    if (validationError) {
      toast(validationError, "error");
      return;
    }
    setSaving(true);
    try {
      await api.createAnnouncement(payload);
      const act = payload.workflow_action;
      toast(
        act === "draft"
          ? "Draft saved."
          : act === "schedule"
            ? "Announcement scheduled."
            : act === "send"
              ? "Announcement sent."
              : "Announcement saved.",
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
        <div className="sa-card-body sa-ann-toolbar">
          <div>
            <div className="sa-ann-toolbar-title">General</div>
            <p className="sa-text-muted sa-text-sm" style={{ margin: "6px 0 0", maxWidth: 520 }}>
              All announcements appear here — drafts, scheduled, sent, and archived together. Narrow the table with status below.
            </p>
          </div>
          <div className="sa-ann-toolbar-filters">
            <label htmlFor="ann-status-filter" className="sa-sr-only">
              Filter by status
            </label>
            <select
              id="ann-status-filter"
              className="sa-select sa-ann-status-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Status: All</option>
              <option value="sent">Sent</option>
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
              <option value="archived">Archived</option>
            </select>
          </div>
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
              <div className="sa-empty-text">
                {statusFilter ? `No announcements with status “${statusLabel(statusFilter)}”.` : "No announcements yet."}
              </div>
            </div>
          ) : (
            <table className="sa-table">
              <thead>
                <tr>
                  <th>Message title</th>
                  <th>Destination</th>
                  <th>Message</th>
                  <th>Email / SMS</th>
                  <th>Status</th>
                  <th>Timeline</th>
                  <th>By</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const st = workflowRowStatus(r);
                  const badgeCls = statusBadgeClass(st);
                  const time = timelineCell(r);
                  return (
                    <tr key={r.id}>
                      <td className="sa-fw-600">{r.title}</td>
                      <td className="sa-text-sm sa-text-muted">{formatDestination(r, unitNames)}</td>
                      <td style={{ maxWidth: 280 }}>{r.body}</td>
                      <td>{formatMedium(r)}</td>
                      <td>
                        <span className={`sa-badge ${badgeCls}`}>{statusLabel(st)}</span>
                      </td>
                      <td className="sa-text-sm">
                        <div className="sa-text-muted" style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>
                          {time.hint}
                        </div>
                        <div>{time.primary}</div>
                      </td>
                      <td className="sa-text-sm">{r.created_by_name || "—"}</td>
                      <td>{renderActions(r)}</td>
                    </tr>
                  );
                })}
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
          admin={admin}
        />
      ) : null}
    </>
  );
}
