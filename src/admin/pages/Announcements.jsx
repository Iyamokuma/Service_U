import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { branchCountryLabel, branchStateLabel } from "../branchRegions.js";
import { useToast } from "../components/Toast.jsx";
import { useAdminAuth } from "../AdminContext.jsx";
import { useAdminGeoFilters } from "../AdminGeoFilterContext.jsx";
import { canPostAnnouncements, isGlobalAdminRole } from "../roles.js";
import { getAnnouncementScopePolicy } from "../announcementScopePolicy.js";
import { AnnouncementCreateModal } from "../components/AnnouncementCreateModal.jsx";
import { AnnouncementStatusTabs } from "../components/AnnouncementStatusTabs.jsx";
import { AdminRowActionsMenu, AdminRowActionsTrigger } from "../components/AdminRowActionsMenu.jsx";
import { SmhLoader } from "../../components/SmhLoader.jsx";

/** Admin destination roles aligned with AnnouncementCreateModal options. */
const ADMIN_DEST_ROLE_KEYS = [
  "general_admin",
  "country_super_admin",
  "state_super_admin",
  "satellite_church_admin",
  "service_unit_leader",
  "sub_unit_leader",
];

const ADMIN_DEST_LABELS = {
  general_admin: "General Admin",
  country_super_admin: "Country Admin",
  state_super_admin: "State Branch Admin",
  satellite_church_admin: "Satellite Pastor Admin",
  service_unit_leader: "Service Unit Leader",
  sub_unit_leader: "Sub-unit Leader",
};

function parseAnnouncementConfig(r) {
  if (r.destination_config && typeof r.destination_config === "object") return r.destination_config;
  if (typeof r.destination_config === "string" && r.destination_config.trim()) {
    try {
      const parsed = JSON.parse(r.destination_config);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      /* ignore */
    }
  }
  return {};
}

/** Normalized geo on a row for super-admin list filters. */
function announcementRowGeo(r) {
  const cfg = parseAnnouncementConfig(r);
  const country = String(r.branch_country || cfg.branch_country || "")
    .trim()
    .toUpperCase();
  const state = String(r.scope_branch_state || cfg.branch_state || "")
    .trim()
    .toUpperCase();
  const satellite = String(r.scope_satellite_site || cfg.satellite_site || "").trim();
  return { country, state, satellite };
}

function announcementMatchesGeoFilter(r, filters) {
  const { country, state, satellite } = filters;
  if (!country && !state && !satellite) return true;
  const geo = announcementRowGeo(r);
  if (country && geo.country !== String(country).trim().toUpperCase()) return false;
  if (state && geo.state !== String(state).trim().toUpperCase()) return false;
  if (satellite && geo.satellite !== String(satellite).trim()) return false;
  return true;
}

function formatMedium(r) {
  const e = Number(r.medium_email) === 1;
  const p = Number(r.medium_push) === 1;
  if (e && p) return "Email, Push";
  if (e) return "Email";
  if (p) return "Push";
  return "—";
}

function formatDestination(r, unitNames, destLabels, adminRoleOptions) {
  const type = r.destination_type || "admins";
  const cfg = parseAnnouncementConfig(r);
  const prefixes = destLabels?.typePrefix || {
    members: "Members",
    leaders: "Leaders",
    admins: "Admins",
  };
  const leaderModeDisplay = destLabels?.leaderModeDisplay || {
    all: "All leaders",
    service_unit: "Service unit leaders",
    sub_unit: "Sub-unit leaders",
  };
  const roleLabelByValue = Object.fromEntries((adminRoleOptions || []).map((o) => [o.value, o.label]));

  if (type === "members") {
    const m = cfg;
    const parts = [
      branchCountryLabel(m.branch_country),
      m.branch_state ? branchStateLabel(m.branch_country, m.branch_state) : "",
      m.satellite_site || "",
      m.service_unit_id ? unitNames[Number(m.service_unit_id)] || `Unit #${m.service_unit_id}` : "",
      m.sub_unit || "",
    ].filter(Boolean);
    return `${prefixes.members} · ${parts.join(" · ") || "All"}`;
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
        ? leaderModeDisplay.sub_unit
        : l.mode === "service_unit"
          ? leaderModeDisplay.service_unit
          : leaderModeDisplay.all;
    const unit = l.service_unit_id ? unitNames[Number(l.service_unit_id)] : "";
    const sub = l.sub_unit || "";
    return [prefixes.leaders, ...geo, mode, unit, sub].filter(Boolean).join(" · ");
  }

  if (type === "admins") {
    const geo = [
      branchCountryLabel(cfg.branch_country),
      cfg.branch_state ? branchStateLabel(cfg.branch_country, cfg.branch_state) : "",
      cfg.satellite_site || "",
    ].filter(Boolean);
    const raw = Array.isArray(cfg.roles) ? cfg.roles.filter(Boolean).map(String) : [];
    let rolePart = destLabels?.allRolesLabel || "All admins";
    if (raw.length > 0) {
      const selected = new Set(raw.map((role) => role.trim()));
      const allSelected = ADMIN_DEST_ROLE_KEYS.every((key) => selected.has(key));
      if (!(allSelected && selected.size <= ADMIN_DEST_ROLE_KEYS.length)) {
        rolePart = raw
          .map((key) => roleLabelByValue[key] || ADMIN_DEST_LABELS[key] || key.replace(/_/g, " "))
          .join(", ");
      }
    }
    return [prefixes.admins, ...geo, rolePart].filter(Boolean).join(" · ");
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

function statusLabel(st) {
  if (st === "sent") return "Sent";
  if (st === "draft") return "Draft";
  if (st === "scheduled") return "Scheduled";
  if (st === "archived") return "Archived";
  return st || "—";
}

export function Announcements() {
  const toast = useToast();
  const { admin, viewMode } = useAdminAuth();
  const geo = useAdminGeoFilters();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusTab, setStatusTab] = useState("draft");
  const [actionMenu, setActionMenu] = useState({ id: null, anchor: null });
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [unitNames, setUnitNames] = useState({});
  const [unitList, setUnitList] = useState([]);
  const [loadError, setLoadError] = useState("");
  const canCreate = canPostAnnouncements(admin?.role);
  const annPolicy = useMemo(() => getAnnouncementScopePolicy(admin, viewMode), [admin, viewMode]);
  const destLabels = annPolicy.destinationLabels;

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
    setActionMenu({ id: null, anchor: null });
  }, [statusTab, geo.filters]);

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

  const scopeRows = useMemo(() => {
    if (!geo.enabled) return rows;
    return rows.filter((r) => announcementMatchesGeoFilter(r, geo.filters));
  }, [rows, geo.enabled, geo.filters]);

  const tabCounts = useMemo(() => {
    const counts = { draft: 0, scheduled: 0, sent: 0, archived: 0 };
    scopeRows.forEach((r) => {
      const st = workflowRowStatus(r);
      if (st in counts) counts[st] += 1;
    });
    return counts;
  }, [scopeRows]);

  const filtered = useMemo(
    () => scopeRows.filter((r) => workflowRowStatus(r) === statusTab),
    [scopeRows, statusTab],
  );

  const actionTarget = useMemo(
    () => filtered.find((r) => Number(r.id) === Number(actionMenu.id)) ?? rows.find((r) => Number(r.id) === Number(actionMenu.id)),
    [filtered, rows, actionMenu.id],
  );

  function closeActionMenu() {
    setActionMenu({ id: null, anchor: null });
  }

  function openActions(e, row) {
    e.stopPropagation();
    if (actionMenu.id === row.id) {
      closeActionMenu();
      return;
    }
    setActionMenu({ id: row.id, anchor: e.currentTarget });
  }

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

  const actionMenuItems = useMemo(() => {
    if (!actionTarget || !canManageRow(actionTarget)) return [];
    const st = workflowRowStatus(actionTarget);
    const items = [];

    if (st === "draft") {
      items.push({
        id: "send",
        label: "Send",
        onClick: () => {
          closeActionMenu();
          runAction(actionTarget.id, { action: "send" }, "Sent.");
        },
      });
    }
    if (st === "scheduled") {
      items.push({
        id: "send",
        label: "Send now",
        onClick: () => {
          closeActionMenu();
          runAction(actionTarget.id, { action: "send" }, "Sent now.");
        },
      });
    }
    if (st === "draft" || st === "scheduled" || st === "sent") {
      items.push({
        id: "archive",
        label: "Archive",
        onClick: () => {
          closeActionMenu();
          runAction(actionTarget.id, { action: "archive" }, "Archived.");
        },
      });
    }
    items.push({
      id: "delete",
      label: "Delete",
      danger: true,
      onClick: () => {
        closeActionMenu();
        removeAnnouncement(actionTarget.id);
      },
    });
    return items;
  }, [actionTarget, admin?.id]);

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Announcements</h2>
          <p className="sa-text-muted sa-text-sm" style={{ margin: "6px 0 0", maxWidth: 520, lineHeight: 1.55 }}>
            {destLabels.broadcastSubtitle}
          </p>
        </div>
        {canCreate ? (
          <button type="button" className="sa-btn sa-btn-primary" onClick={() => setShowCreate(true)}>
            + Create announcement
          </button>
        ) : null}
      </div>

      <div className="sa-card">
        <AnnouncementStatusTabs active={statusTab} onChange={setStatusTab} counts={tabCounts} />
        <div className="sa-table-wrap">
          {loading ? (
            <SmhLoader label="Loading announcements" />
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
                {geo.hasFilters
                  ? `No ${statusLabel(statusTab).toLowerCase()} announcements match the scope filters above.`
                  : `No ${statusLabel(statusTab).toLowerCase()} announcements yet.`}
              </div>
              {geo.hasFilters ? (
                <button type="button" className="sa-btn sa-btn-outline sa-btn-sm" style={{ marginTop: 12 }} onClick={geo.clear}>
                  Clear scope filters
                </button>
              ) : null}
            </div>
          ) : (
            <table className="sa-table sa-table-admins-simple">
              <thead>
                <tr>
                  <th>Message title</th>
                  <th>Destination</th>
                  <th>Message</th>
                  <th>Email / Push</th>
                  <th>Timeline</th>
                  <th>By</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const time = timelineCell(r);
                  return (
                    <tr key={r.id}>
                      <td className="sa-fw-600">{r.title}</td>
                      <td className="sa-text-sm sa-text-muted">
                        {formatDestination(r, unitNames, destLabels, annPolicy.adminRoleOptions)}
                      </td>
                      <td style={{ maxWidth: 280 }}>{r.body}</td>
                      <td>{formatMedium(r)}</td>
                      <td className="sa-text-sm">
                        <div className="sa-text-muted" style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>
                          {time.hint}
                        </div>
                        <div>{time.primary}</div>
                      </td>
                      <td className="sa-text-sm">{r.created_by_name || "—"}</td>
                      <td>
                        {canManageRow(r) ? (
                          <AdminRowActionsTrigger onOpen={(e) => openActions(e, r)} label="Action" />
                        ) : (
                          <span className="sa-text-muted sa-text-sm">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <AdminRowActionsMenu
        open={!!actionMenu.id}
        anchorEl={actionMenu.anchor}
        onClose={closeActionMenu}
        items={actionMenuItems}
      />

      {showCreate ? (
        <AnnouncementCreateModal
          open
          onClose={() => setShowCreate(false)}
          onSubmit={handleCreate}
          saving={saving}
          unitList={unitList}
          admin={admin}
          viewMode={viewMode}
        />
      ) : null}
    </>
  );
}
