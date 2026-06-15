import { useCallback, useEffect, useState } from "react";
import { api } from "./api.js";

export function useAdminNotifications({ perPage = 50, enabled = true, pollMs = 60000 } = {}) {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const r = await api.notifications({ per_page: perPage });
      setItems(r.data || []);
      setUnread(r.unread_count ?? 0);
    } catch {
      setItems([]);
      setUnread(0);
    } finally {
      setLoading(false);
    }
  }, [enabled, perPage]);

  useEffect(() => {
    if (!enabled) return undefined;
    load();
    if (!pollMs) return undefined;
    const t = setInterval(load, pollMs);
    return () => clearInterval(t);
  }, [enabled, load, pollMs]);

  const markRead = useCallback(
    async (id) => {
      if (!id) return;
      try {
        await api.markNotificationRead(id);
        await load();
      } catch {
        /* ignore */
      }
    },
    [load],
  );

  const markAllRead = useCallback(async () => {
    try {
      await api.markAllNotificationsRead();
      await load();
    } catch {
      /* ignore */
    }
  }, [load]);

  return { items, unread, loading, load, markRead, markAllRead };
}
