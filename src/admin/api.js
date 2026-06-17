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
  if (params.scope_mode === "state" || params.scope_mode === "country") {
    return params;
  }
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

async function adminLoginFetch(op, params = {}) {
  const res = await fetch(`${functionsBaseUrl()}/admin-login`, {
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

  if (!res.ok) {
    throw new Error(body?.error || "Request failed.");
  }
  return body;
}

export function mapAdminRow(a) {
  if (!a || typeof a !== "object") return a;
  return {
    ...a,
    id: a.id != null ? Number(a.id) : a.id,
    branch_country_label: branchCountryLabel(a.branch_country),
    branch_state_label: branchStateLabel(a.branch_country, a.branch_state),
  };
}

/** Align list rows with server shapeAdminListRow (pending invite flag). */
export function shapeAdminListRow(row) {
  if (!row || typeof row !== "object") return null;
  const mapped = mapAdminRow(row);
  if (mapped?.id == null || !Number.isFinite(Number(mapped.id))) return null;
  let pendingInvite = row.pending_invite;
  if (pendingInvite !== true && pendingInvite !== false) {
    pendingInvite =
      !!String(row.invite_token || "").trim() && Number(row.must_change_password ?? 0) === 1;
  }
  return { ...mapped, id: Number(mapped.id), pending_invite: pendingInvite };
}

function mapAdminsList(data) {
  if (!Array.isArray(data)) return [];
  return data.map((row) => shapeAdminListRow(row)).filter(Boolean);
}

/** Merge created/updated admin rows into a prior `api.admins()` payload without waiting for refetch. */
export function mergeAdminListPayload(prev, rowOrRows) {
  const rows = Array.isArray(rowOrRows) ? rowOrRows : rowOrRows ? [rowOrRows] : [];
  if (!rows.length) return prev ?? { data: [] };
  const existing = [...(prev?.data ?? [])];
  for (const raw of rows) {
    const mapped = shapeAdminListRow(raw);
    if (!mapped?.id) continue;
    const idx = existing.findIndex((a) => Number(a.id) === Number(mapped.id));
    if (idx >= 0) {
      existing[idx] = { ...existing[idx], ...mapped };
    } else {
      existing.push(mapped);
    }
  }
  existing.sort((a, b) => Number(a.id) - Number(b.id));
  return { data: existing };
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

  async startLogin(body) {
    const email = String(body?.email ?? body?.username ?? "").trim();
    const password = String(body?.password || "").trim();
    return adminLoginFetch("startLogin", { email, username: email, password });
  },

  async verifyLoginOtp(challengeId, otp) {
    return adminLoginFetch("verifyOtp", {
      challenge_id: String(challengeId || "").trim(),
      otp: String(otp || "").trim(),
    });
  },

  async resendLoginOtp(challengeId) {
    return adminLoginFetch("resendOtp", { challenge_id: String(challengeId || "").trim() });
  },

  async sendLoginEmailOtp(challengeId) {
    return adminLoginFetch("sendOtp", { challenge_id: String(challengeId || "").trim() });
  },

  async verifyDualLoginOtp(challengeId, emailOtp, totp) {
    return adminLoginFetch("verifyDualOtp", {
      challenge_id: String(challengeId || "").trim(),
      email_otp: String(emailOtp || "").trim(),
      totp: String(totp || "").trim(),
    });
  },

  async startTotpEnrollment() {
    return adminFetch("startTotpEnrollment", {});
  },

  async confirmTotpEnrollment(code) {
    return adminFetch("confirmTotpEnrollment", { code: String(code || "").trim() });
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

  async registration(id) {
    return adminFetch("registration", withScopeParams({ id }));
  },

  async requestOpenCount() {
    return adminFetch("requestOpenCount", withScopeParams({}));
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

  async geoCatalog(params = {}) {
    return adminFetch("geoCatalog", params);
  },

  async subUnitQueuesByUnit(_viewer) {
    return adminFetch("subUnitQueuesByUnit", {});
  },

  async overdueAlerts(_viewer) {
    return adminFetch("overdueAlerts", withScopeParams({}));
  },

  async notifications(params = {}) {
    return adminFetch("notifications", params);
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

  async churchCatalog() {
    return adminFetch("churchCatalog", {});
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
