import { useCallback, useEffect, useMemo, useState } from "react";
import { SmhLoader } from "../../components/SmhLoader.jsx";
import { useAdminAuth } from "../AdminContext.jsx";
import { useAdminNotifications } from "../useAdminNotifications.js";
import {
  formatInboxTime,
  formatRelativeTime,
  notificationActionLabel,
  notificationBadgeClass,
  notificationInitials,
  notificationSenderInitials,
  notificationSenderLabel,
  notificationTypeLabel,
  resolveNotificationTarget,
} from "../notificationInbox.js";

const FILTER_TABS = [
  { id: "unread", label: "Unread" },
  { id: "all", label: "All" },
  { id: "applications", label: "Applications" },
  { id: "requests", label: "Requests" },
  { id: "announcements", label: "Announcements" },
];

const APPLICATION_TYPES = new Set(["new_registration", "overdue_application", "overdue_critical"]);
const REQUEST_TYPES = new Set(["admin_request", "request_update"]);

function matchesFilter(n, filterTab) {
  const type = String(n?.type || "");
  if (filterTab === "unread") return !n.read_at;
  if (filterTab === "applications") return APPLICATION_TYPES.has(type);
  if (filterTab === "requests") return REQUEST_TYPES.has(type);
  if (filterTab === "announcements") return type === "announcement";
  return true;
}

function fmtDetailDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function Notifications({ setPage, navigateToQueue }) {
  const { admin } = useAdminAuth();
  const { items, unread, loading, markRead, markAllRead } = useAdminNotifications({ perPage: 150 });
  const [filterTab, setFilterTab] = useState("unread");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((n) => {
      if (!matchesFilter(n, filterTab)) return false;
      if (!q) return true;
      const hay = [n.title, n.body, n.type, notificationTypeLabel(n.type), notificationSenderLabel(n)]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [items, filterTab, search]);

  useEffect(() => {
    if (!filtered.length) {
      setSelectedId(null);
      return;
    }
    if (!filtered.some((n) => n.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  const selected = useMemo(
    () => filtered.find((n) => n.id === selectedId) || null,
    [filtered, selectedId],
  );

  const goToTarget = useCallback(
    async (n) => {
      if (!n) return;
      if (!n.read_at) await markRead(n.id);
      const target = resolveNotificationTarget(n, admin);
      if (!target) return;
      if (target.page === "queue" && navigateToQueue) {
        navigateToQueue(target.queueTab || "all");
        return;
      }
      if (target.page === "oversight") {
        setPage?.("oversight");
        return;
      }
      setPage?.(target.page);
    },
    [admin, markRead, navigateToQueue, setPage],
  );

  const selectNotification = useCallback(
    async (n) => {
      setSelectedId(n.id);
      if (!n.read_at) await markRead(n.id);
    },
    [markRead],
  );

  return (
    <div className="sa-notify-page">
      <header className="sa-users-page-head">
        <div className="sa-users-page-head-top">
          <h1 className="sa-admins-title">Notifications</h1>
          {unread > 0 ? (
            <button type="button" className="sa-btn sa-btn-outline sa-btn-sm" onClick={markAllRead}>
              Mark all read
            </button>
          ) : null}
        </div>
        <p className="sa-text-muted sa-text-sm" style={{ margin: 0, lineHeight: 1.5 }}>
          Messages and admin actions for your account — select an item to read the full message.
        </p>
      </header>

      <div className="sa-card sa-notify-split-card">
        <div className="sa-card-body sa-unit-tab-row" role="tablist" aria-label="Notification filters">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`sa-unit-tab-btn${filterTab === tab.id ? " is-active" : ""}`}
              onClick={() => setFilterTab(tab.id)}
            >
              {tab.label}
              {tab.id === "unread" && unread > 0 ? ` (${unread})` : ""}
            </button>
          ))}
        </div>

        <div className="sa-filters sa-notify-filters">
          <div className="sa-search" style={{ minWidth: 240, flex: 1 }}>
            <span className="sa-search-icon" aria-hidden>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              placeholder="Search notifications…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search notifications"
            />
          </div>
          <button
            type="button"
            className="sa-btn sa-btn-outline sa-btn-sm"
            onClick={() => {
              setSearch("");
              setFilterTab("all");
            }}
          >
            Reset
          </button>
          <span className="sa-text-muted sa-text-sm sa-notify-count">
            Showing {filtered.length} of {items.length}
          </span>
        </div>

        <div className="sa-notify-split">
          <div className="sa-notify-list-panel" aria-label="Notification list">
            {loading && items.length === 0 ? (
              <div className="sa-notify-panel-empty">
                <SmhLoader label="Loading notifications" variant="compact" size={36} />
              </div>
            ) : filtered.length === 0 ? (
              <div className="sa-notify-panel-empty">
                <div className="sa-empty-icon" aria-hidden>
                  💬
                </div>
                <p className="sa-fw-600">No notifications</p>
                <p className="sa-text-muted sa-text-sm">Nothing matches your filters yet.</p>
              </div>
            ) : (
              <div className="sa-notify-stack">
                {filtered.map((n) => {
                  const isActive = n.id === selectedId;
                  const unreadItem = !n.read_at;
                  return (
                    <button
                      key={n.id}
                      type="button"
                      className={`sa-notify-stack-item${isActive ? " is-active" : ""}${unreadItem ? " is-unread" : ""}`}
                      onClick={() => selectNotification(n)}
                    >
                      <div className="sa-notify-stack-avatar">{notificationSenderInitials(n)}</div>
                      <div className="sa-notify-stack-body">
                        <div className="sa-notify-stack-top">
                          <span className="sa-notify-stack-title">{notificationSenderLabel(n)}</span>
                          <span className={`sa-notify-type-badge is-${notificationBadgeClass(n.type)}`}>
                            {notificationTypeLabel(n.type).toUpperCase()}
                          </span>
                        </div>
                        <div className="sa-notify-stack-preview">{n.title}</div>
                        <div className="sa-notify-stack-preview sa-notify-stack-subpreview">{n.body}</div>
                        <div className="sa-notify-stack-meta">
                          <span>{formatRelativeTime(n.created_at)}</span>
                          {unreadItem ? <span className="sa-notify-stack-unread">Unread</span> : null}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="sa-notify-detail-panel" aria-label="Notification detail">
            {!selected ? (
              <div className="sa-notify-panel-empty">
                <p className="sa-text-muted">Select a notification to view details.</p>
              </div>
            ) : (
              <>
                <div className="sa-notify-detail-head">
                  <div className="sa-notify-detail-head-main">
                    <div className="sa-notify-stack-avatar sa-notify-detail-avatar">
                      {notificationSenderInitials(selected)}
                    </div>
                    <div>
                      <p className="sa-notify-detail-from">From {notificationSenderLabel(selected)}</p>
                      <h2 className="sa-notify-detail-title">{selected.title}</h2>
                      <div className="sa-notify-detail-sub">
                        <span className={`sa-notify-type-badge is-${notificationBadgeClass(selected.type)}`}>
                          {notificationTypeLabel(selected.type).toUpperCase()}
                        </span>
                        <span className="sa-text-muted sa-text-sm">{formatRelativeTime(selected.created_at)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="sa-notify-detail-grid">
                  <div className="sa-detail-field">
                    <div className="sa-detail-label">From</div>
                    <div className="sa-detail-value">{notificationSenderLabel(selected)}</div>
                  </div>
                  <div className="sa-detail-field">
                    <div className="sa-detail-label">Subject</div>
                    <div className="sa-detail-value">{selected.title}</div>
                  </div>
                  <div className="sa-detail-field">
                    <div className="sa-detail-label">Message</div>
                    <div className="sa-detail-value">{selected.body}</div>
                  </div>
                  <div className="sa-detail-field">
                    <div className="sa-detail-label">Type</div>
                    <div className="sa-detail-value">{notificationTypeLabel(selected.type)}</div>
                  </div>
                  <div className="sa-detail-field">
                    <div className="sa-detail-label">Received</div>
                    <div className="sa-detail-value">{fmtDetailDate(selected.created_at)}</div>
                  </div>
                  <div className="sa-detail-field">
                    <div className="sa-detail-label">Status</div>
                    <div className="sa-detail-value">{selected.read_at ? "Read" : "Unread"}</div>
                  </div>
                  {selected.entity_type ? (
                    <div className="sa-detail-field">
                      <div className="sa-detail-label">Related item</div>
                      <div className="sa-detail-value">
                        {selected.entity_type}
                        {selected.entity_id ? ` #${selected.entity_id}` : ""}
                      </div>
                    </div>
                  ) : null}
                </div>

                {resolveNotificationTarget(selected, admin) ? (
                  <div className="sa-notify-detail-actions">
                    <button
                      type="button"
                      className="sa-btn sa-btn-primary"
                      onClick={() => goToTarget(selected)}
                    >
                      {notificationActionLabel(selected.type)}
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
