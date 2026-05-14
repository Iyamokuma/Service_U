import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api.js";

export function NotificationBell({ onNavigateQueue }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.notifications();
      setItems(r.data || []);
      setUnread(r.unread_count ?? 0);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, [open]);

  async function markRead(id) {
    try {
      await api.markNotificationRead(id);
      load();
    } catch {
      /* ignore */
    }
  }

  async function markAll() {
    try {
      await api.markAllNotificationsRead();
      load();
    } catch {
      /* ignore */
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
            {unread > 0 ? (
              <button type="button" className="sa-notify-markall" onClick={markAll}>
                Mark all read
              </button>
            ) : null}
          </div>
          <div className="sa-notify-list">
            {loading && items.length === 0 ? (
              <div className="sa-notify-empty">Loading…</div>
            ) : items.length === 0 ? (
              <div className="sa-notify-empty">No notifications yet.</div>
            ) : (
              items.map((n) => (
                <div
                  key={n.id}
                  className={`sa-notify-item${n.read_at ? "" : " is-unread"}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (!n.read_at) markRead(n.id);
                    if (n.type === "overdue_application" && onNavigateQueue) onNavigateQueue();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (!n.read_at) markRead(n.id);
                      if (n.type === "overdue_application" && onNavigateQueue) onNavigateQueue();
                    }
                  }}
                >
                  <div className="sa-notify-item-title">{n.title}</div>
                  <div className="sa-notify-item-body">{n.body}</div>
                  <div className="sa-notify-item-meta">{new Date(n.created_at).toLocaleString()}</div>
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
