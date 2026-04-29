import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "./api.js";

const AuthCtx = createContext(null);

export function AdminAuthProvider({ children }) {
  const [admin, setAdmin]     = useState(() => {
    try { return JSON.parse(localStorage.getItem("admin_user") || "null"); } catch { return null; }
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const login = useCallback(async (username, password) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.login({ username, password });
      localStorage.setItem("admin_token", res.token);
      localStorage.setItem("admin_user",  JSON.stringify(res.admin));
      setAdmin(res.admin);
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
    <AuthCtx.Provider value={{ admin, loading, error, login, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAdminAuth() {
  return useContext(AuthCtx);
}
