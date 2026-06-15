import { useEffect, useRef, useState } from "react";
import { SmhLoader } from "../../components/SmhLoader.jsx";
import { useAdminNotifications } from "../useAdminNotifications.js";
import { formatInboxTime } from "../notificationInbox.js";

export function NotificationBell({ onNavigateQueue, onNavigateAnnouncements, onOpenInbox, onNavigateRequests }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const { items, unread, loading, load, markRead, markAllRead } = useAdminNotifications({ perPage: 12 });

  useEffect(() => {
    if (!open) return;
    function onDoc(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, [open]);

  function handleItemClick(n) {
    if (!n.read_at) markRead(n.id);
    if (n.type === "overdue_application" && onNavigateQueue) {
      onNavigateQueue("overdue");
      setOpen(false);
      return;
    }
    if (n.type === "new_registration" && onNavigateQueue) {
      onNavigateQueue("new");
      setOpen(false);
      return;
    }
    if (n.type === "announcement" && onNavigateAnnouncements) {
      onNavigateAnnouncements();
      setOpen(false);
      return;
    }
    if ((n.type === "admin_request" || n.type === "request_update") && onNavigateRequests) {
      onNavigateRequests();
      setOpen(false);
      return;
    }
    if ((n.type === "admin_request" || n.type === "request_update") && onOpenInbox) {
      onOpenInbox();
      setOpen(false);
    }
  }

  return (
    <div className="sa-notify-wrap" ref={wrapRef}>
      <button
        type="button"
        className="sa-notify-trigger"
        aria-label="Notifications"
        title="Notifications"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
          if (!open) load();
        }}
      >
        <BellIcon />
        {unread > 0 ? <span className="sa-notify-badge">{unread > 99 ? "99+" : unread}</span> : null}
      </button>
      {open && (
        <div className="sa-notify-panel">
          <div className="sa-notify-head">
            <span className="sa-notify-title">Notifications</span>
            <div className="sa-notify-head-actions">
              {unread > 0 ? (
                <button type="button" className="sa-notify-markall" onClick={markAllRead}>
                  Mark all read
                </button>
              ) : null}
              {onOpenInbox ? (
                <button type="button" className="sa-notify-markall" onClick={() => { onOpenInbox(); setOpen(false); }}>
                  View all
                </button>
              ) : null}
            </div>
          </div>
          <div className="sa-notify-list">
            {loading && items.length === 0 ? (
              <div className="sa-notify-empty">
                <SmhLoader label="Loading notifications" variant="compact" size={32} />
              </div>
            ) : items.length === 0 ? (
              <div className="sa-notify-empty">No notifications yet.</div>
            ) : (
              items.map((n) => (
                <div
                  key={n.id}
                  className={`sa-notify-item${n.read_at ? "" : " is-unread"}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleItemClick(n)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleItemClick(n);
                    }
                  }}
                >
                  <div className="sa-notify-item-title">{n.title}</div>
                  <div className="sa-notify-item-body">{n.body}</div>
                  <div className="sa-notify-item-meta">{formatInboxTime(n.created_at)}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
