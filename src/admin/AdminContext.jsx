import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "./api.js";
import {
  canSwitchAdminView,
  readAdminViewMode,
  writeAdminViewMode,
} from "./adminViewMode.js";

const AuthCtx = createContext(null);

export function AdminAuthProvider({ children }) {
  const [admin, setAdmin]     = useState(() => {
    try {
      const tok = localStorage.getItem("admin_token");
      const raw = localStorage.getItem("admin_user");
      const u = JSON.parse(raw || "null");
      if (u && !tok) {
        localStorage.removeItem("admin_user");
        return null;
      }
      return u;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [viewMode, setViewModeRaw] = useState("country");

  useEffect(() => {
    if (admin?.id) {
      setViewModeRaw(readAdminViewMode(admin.id));
    } else {
      setViewModeRaw("country");
    }
  }, [admin?.id]);

  const setViewMode = useCallback(
    (mode) => {
      const next = mode === "state" ? "state" : "country";
      if (admin?.id) writeAdminViewMode(admin.id, next);
      setViewModeRaw(next);
    },
    [admin?.id],
  );

  useEffect(() => {
    if (!canSwitchAdminView(admin) && viewMode !== "country") {
      setViewMode("country");
    }
  }, [admin?.branch_state, admin?.role, viewMode, setViewMode]);

  useEffect(() => {
    let cancelled = false;
    const raw = localStorage.getItem("admin_user");
    if (!raw) return undefined;
    let stored;
    try {
      stored = JSON.parse(raw);
    } catch {
      return undefined;
    }
    if (!stored?.id) return undefined;
    api.refreshSession(stored).then((next) => {
      if (cancelled) return;
      if (!next) {
        try {
          localStorage.removeItem("admin_user");
          localStorage.removeItem("admin_token");
        } catch {
          /* ignore */
        }
        setAdmin(null);
        return;
      }
      setAdmin(next);
      localStorage.setItem("admin_user", JSON.stringify(next));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshAdmin = useCallback(async () => {
    const raw = localStorage.getItem("admin_user");
    if (!raw) return;
    let stored;
    try {
      stored = JSON.parse(raw);
    } catch {
      return;
    }
    const next = await api.refreshSession(stored);
    if (!next) {
      try {
        localStorage.removeItem("admin_user");
        localStorage.removeItem("admin_token");
      } catch {
        /* ignore */
      }
      setAdmin(null);
      return;
    }
    setAdmin(next);
    localStorage.setItem("admin_user", JSON.stringify(next));
  }, []);

  const login = useCallback(async (username, password) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.login({ username, password });
      localStorage.setItem("admin_token", res.token);
      localStorage.setItem("admin_user", JSON.stringify(res.admin));
      setAdmin(res.admin);
      if (res.admin?.role === "country_super_admin") {
        const refreshed = await api.refreshSession(res.admin);
        if (refreshed) {
          setAdmin(refreshed);
          localStorage.setItem("admin_user", JSON.stringify(refreshed));
        }
      }
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try { await api.logout(); } catch { /* ignore */ }
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_user");
    setAdmin(null);
  }, []);

  return (
    <AuthCtx.Provider value={{ admin, loading, error, login, logout, refreshAdmin, viewMode, setViewMode }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAdminAuth() {
  return useContext(AuthCtx);
}
