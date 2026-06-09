import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "./api.js";
import {
  canSwitchAdminView,
  readAdminViewMode,
  writeAdminViewMode,
} from "./adminViewMode.js";
import { isRootSuperAdmin } from "./roles.js";

const ADMIN_PAGE_STORAGE_KEY = "sm_admin_page";

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

  const loginWithToken = useCallback(async (token, adminUser) => {
    localStorage.setItem("admin_token", token);
    localStorage.setItem("admin_user", JSON.stringify(adminUser));
    if (isRootSuperAdmin(adminUser?.role)) {
      try {
        sessionStorage.setItem(ADMIN_PAGE_STORAGE_KEY, "overview");
      } catch {
        /* ignore */
      }
    }
    setAdmin(adminUser);
    if (adminUser?.role === "country_super_admin") {
      const refreshed = await api.refreshSession(adminUser);
      if (refreshed) {
        setAdmin(refreshed);
        localStorage.setItem("admin_user", JSON.stringify(refreshed));
      }
    }
  }, []);

  const clearLoginError = useCallback(() => setError(null), []);
  const setLoginError = useCallback((msg) => setError(msg), []);

  const startLogin = useCallback(async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.startLogin({ email, password });
      if (res?.token && res?.admin) {
        await loginWithToken(res.token, res.admin);
        return { needsOtp: false, loggedIn: true };
      }
      const challengeId = String(res?.challenge_id || res?.challengeId || "").trim();
      if (res?.step === "otp_required" || challengeId) {
        if (!challengeId) {
          throw new Error("Could not start verification. Try again.");
        }
        return {
          needsOtp: true,
          challengeId,
          maskedEmail: res.email_masked || res.emailMasked || "",
          expiresIn: res.expires_in ?? res.expiresIn,
          resendAfter: res.resend_after ?? res.resendAfter ?? 60,
          emailSent: res.email_sent !== false,
          message: String(res.message || ""),
        };
      }
      throw new Error("Unexpected login response. Try again.");
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [loginWithToken]);

  const verifyLoginOtp = useCallback(async (challengeId, otp) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.verifyLoginOtp(challengeId, otp);
      await loginWithToken(res.token, res.admin);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [loginWithToken]);

  const resendLoginOtp = useCallback(async (challengeId) => {
    setLoading(true);
    setError(null);
    try {
      return await api.resendLoginOtp(challengeId);
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try { await api.logout(); } catch { /* ignore */ }
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_user");
    try {
      sessionStorage.removeItem(ADMIN_PAGE_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setAdmin(null);
  }, []);

  return (
    <AuthCtx.Provider
      value={{
        admin,
        loading,
        error,
        startLogin,
        verifyLoginOtp,
        resendLoginOtp,
        clearLoginError,
        setLoginError,
        loginWithToken,
        logout,
        refreshAdmin,
        viewMode,
        setViewMode,
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export function useAdminAuth() {
  return useContext(AuthCtx);
}
