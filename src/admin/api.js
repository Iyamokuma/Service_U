import { branchCountryLabel, branchStateLabel } from "./branchRegions.js";
import { functionsBaseUrl, supabaseAnonHeaders } from "../lib/supabaseEnv.js";
import { readAdminViewMode, canSwitchAdminView } from "./adminViewMode.js";

function adminToken() {
  try {
    return localStorage.getItem("admin_token") || "";
  } catch {
    return "";
  }
}

async function adminFetch(op, params = {}, { timeoutMs = 30000 } = {}) {
  const jwt = adminToken();
  if (!jwt) throw new Error("Unauthorized");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(`${functionsBaseUrl()}/admin-api`, {
      method: "POST",
      headers: {
        ...supabaseAnonHeaders(),
        "Content-Type": "application/json",
        "X-Admin-Jwt": jwt,
      },
      body: JSON.stringify({ op, params }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new Error("Request timed out. Check your connection and try again.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    throw new Error(body?.error || `Request failed (${res.status})`);
  }
  return body;
}

function withScopeParams(params = {}) {
  try {
    const raw = localStorage.getItem("admin_user");
    const admin = raw ? JSON.parse(raw) : null;
    if (canSwitchAdminView(admin) && readAdminViewMode(admin?.id) === "state") {
      return { ...params, scope_mode: "state" };
    }
  } catch {
    /* ignore */
  }
  return params;
}

async function adminInviteFetch(op, params = {}) {
  const res = await fetch(`${functionsBaseUrl()}/admin-invite`, {
    method: "POST",
    headers: {
      ...supabaseAnonHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ op, ...params }),
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) throw new Error(body?.error || `Request failed (${res.status})`);
  return body;
}

async function adminLoginFetch(emailOrUsername, password) {
  const loginId = String(emailOrUsername || "").trim();
  const res = await fetch(`${functionsBaseUrl()}/admin-login`, {
    method: "POST",
    headers: {
      ...supabaseAnonHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: loginId, username: loginId, password }),
  });

  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    throw new Error(body?.error || "Invalid credentials.");
  }
  return body;
}

function mapAdminsList(data) {
  return (data || []).map((a) => ({
    ...a,
    branch_country_label: branchCountryLabel(a.branch_country),
    branch_state_label: branchStateLabel(a.branch_country, a.branch_state),
  }));
}

export const api = {
  async populateDemoData() {
    if (!adminToken()) return { ok: true };
    try {
      return await adminFetch("populateDemoData", {});
    } catch {
      return { ok: true };
    }
  },

  async login(body) {
    const email = String(body?.email ?? body?.username ?? "").trim();
    const password = String(body?.password || "").trim();
    return adminLoginFetch(email, password);
  },

  async validateInvite(token) {
    return adminInviteFetch("validateInvite", { token: String(token || "").trim() });
  },

  async completeInvite(token, password) {
    return adminInviteFetch("completeInvite", {
      token: String(token || "").trim(),
      password: String(password || "").trim(),
    });
  },

  async resendAdminInvite(id) {
    return adminFetch("resendAdminInvite", { id });
  },

  async refreshSession(stored) {
    if (!stored?.id) return null;
    if (!adminToken()) return stored;
    try {
      const r = await adminFetch("refreshSession", {});
      return r?.admin ?? null;
    } catch (e) {
      const msg = String(e?.message || "").toLowerCase();
      if (msg.includes("unauthorized") || msg.includes("401")) {
        try {
          localStorage.removeItem("admin_token");
        } catch {
          /* ignore */
        }
        return null;
      }
      return stored;
    }
  },

  async logout() {
    try {
      if (adminToken()) await adminFetch("logout", {});
    } catch {
      /* ignore */
    }
    return { ok: true };
  },

  async stats(params = {}) {
    return adminFetch("stats", withScopeParams(params));
  },

  async queue(params = {}) {
    return adminFetch("queue", withScopeParams(params));
  },

  async updateStatus(id, body) {
    return adminFetch("updateStatus", { id, body });
  },

  async deleteReg(id) {
    return adminFetch("deleteReg", { id });
  },

  async units() {
    return adminFetch("units", {});
  },

  async createUnit(body) {
    return adminFetch("createUnit", { body });
  },

  async updateUnit(id, body) {
    return adminFetch("updateUnit", { id, body });
  },

  async unitDeleteInfo(id) {
    return adminFetch("unitDeleteInfo", { id });
  },

  async subDeleteInfo(id) {
    return adminFetch("subDeleteInfo", { id });
  },

  async deleteUnit(id) {
    return adminFetch("deleteUnit", { id });
  },

  async createSub(body) {
    return adminFetch("createSub", { body });
  },

  async updateSub(id, body) {
    return adminFetch("updateSub", { id, body });
  },

  async deleteSub(id) {
    return adminFetch("deleteSub", { id });
  },

  async admins() {
    const r = await adminFetch("admins", withScopeParams({}));
    return { data: mapAdminsList(r.data) };
  },

  async createAdmin(body) {
    const normalized = { ...body };
    if (normalized.password != null) {
      normalized.password = String(normalized.password).trim();
    }
    return adminFetch("createAdmin", withScopeParams({ body: normalized }));
  },

  async updateAdmin(id, body) {
    const normalized = { ...body };
    if (normalized.password != null && String(normalized.password).trim()) {
      normalized.password = String(normalized.password).trim();
    } else if ("password" in normalized) {
      delete normalized.password;
    }
    return adminFetch("updateAdmin", withScopeParams({ id, body: normalized }));
  },

  async updateRegistrationBranch(id, body) {
    return adminFetch("updateRegistrationBranch", { id, body });
  },

  async deleteAdmin(id, body = {}) {
    return adminFetch("deleteAdmin", withScopeParams({ id, body }));
  },

  async members(params = {}) {
    return adminFetch("members", withScopeParams(params));
  },

  async requests(params = {}) {
    return adminFetch("requests", withScopeParams(params));
  },

  async createRequest(body) {
    return adminFetch("createRequest", withScopeParams({ body }));
  },

  async updateRequest(id, body) {
    return adminFetch("updateRequest", withScopeParams({ id, body }));
  },

  async approveServiceUnitProposal(id) {
    return adminFetch("approveServiceUnitProposal", withScopeParams({ id }));
  },

  async settings() {
    return adminFetch("settings", {});
  },

  async updateSettings(body) {
    return adminFetch("updateSettings", { body });
  },

  async activity(params = {}) {
    return adminFetch("activity", params);
  },

  async subUnitQueuesByUnit(_viewer) {
    return adminFetch("subUnitQueuesByUnit", {});
  },

  async overdueAlerts(_viewer) {
    return adminFetch("overdueAlerts", withScopeParams({}));
  },

  async notifications() {
    return adminFetch("notifications", {});
  },

  async markNotificationRead(id) {
    return adminFetch("markNotificationRead", { id });
  },

  async markAllNotificationsRead() {
    return adminFetch("markAllNotificationsRead", {});
  },

  async announcements() {
    return adminFetch("announcements", {});
  },

  async createAnnouncement(body) {
    return adminFetch("createAnnouncement", withScopeParams({ body }));
  },

  async updateAnnouncement(id, body) {
    return adminFetch("updateAnnouncement", { id, body });
  },

  async deleteAnnouncement(id) {
    return adminFetch("deleteAnnouncement", { id });
  },

  async catalogList() {
    return adminFetch("catalogList", {});
  },

  async catalogAddCountry(fields) {
    return adminFetch("catalogAddCountry", fields);
  },

  async catalogAddState(fields) {
    return adminFetch("catalogAddState", fields);
  },

  async catalogAddChurch(fields) {
    return adminFetch("catalogAddChurch", fields);
  },

  async catalogSetChurchActive(id, is_active) {
    return adminFetch("catalogSetChurchActive", { id, is_active });
  },

  async catalogDeleteChurch(id) {
    return adminFetch("catalogDeleteChurch", { id });
  },

  async catalogCreateLocation(body) {
    return adminFetch("catalogCreateLocation", { body });
  },
};
