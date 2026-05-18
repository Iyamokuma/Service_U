import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { assertStateBelongsToCountry } from "./branch_regions.ts";
import {
  ensureDirectoryCountry,
  ensureDirectoryState,
  publishChurchToDirectory,
  resolveExistingDirectoryCountry,
  resolveExistingDirectoryState,
} from "./location_directory.ts";
import { applyRegistrationScopeQuery, canAccessRegistration } from "./registration_scope.ts";

type AdminRow = Record<string, unknown>;
type Ctx = { admin: AdminRow; ip: string };

function norm(s: unknown): string {
  return String(s ?? "").trim();
}
function normUp(s: unknown): string {
  return norm(s).toUpperCase();
}
function normStatus(s: unknown): string {
  const x = norm(s).toLowerCase();
  if (x === "pending") return "new";
  return x || "new";
}

function normalizeAdminUsername(raw: unknown): string {
  return norm(raw).toLowerCase();
}

function assertAdminUsernameFormat(username: string): void {
  if (!username) throw new Error("Username is required.");
  if (username.length < 3 || username.length > 64) {
    throw new Error("Username must be between 3 and 64 characters.");
  }
  if (!/^[a-z0-9._-]+$/.test(username)) {
    throw new Error("Username may only use letters, numbers, dots, hyphens, and underscores.");
  }
}

async function assertAdminUsernameAvailable(
  supabase: SupabaseClient,
  username: string,
  excludeId?: number,
): Promise<void> {
  assertAdminUsernameFormat(username);
  const { data, error } = await supabase.from("admins").select("id, username").ilike("username", username);
  if (error) throw new Error(error.message);
  const taken = (data || []).find((r) => Number(r.id) !== Number(excludeId ?? 0));
  if (taken) {
    throw new Error(
      `Username "${username}" is already in use. Login names are unique worldwide — try a country-specific id such as "gb.country.admin".`,
    );
  }
}

async function assertAdminEmailAvailable(
  supabase: SupabaseClient,
  email: string,
  excludeId?: number,
): Promise<void> {
  const e = norm(email).toLowerCase();
  if (!e) throw new Error("Email is required.");
  const { data, error } = await supabase.from("admins").select("id, email").ilike("email", e);
  if (error) throw new Error(error.message);
  const taken = (data || []).find((r) => Number(r.id) !== Number(excludeId ?? 0));
  if (taken) throw new Error("That email is already used by another admin account.");
}

const ROLES_REQUIRING_COUNTRY = new Set([
  "country_super_admin",
  "state_super_admin",
  "satellite_church_admin",
  "service_unit_leader",
  "sub_unit_leader",
]);

const ROLES_REQUIRING_STATE = new Set([
  "state_super_admin",
  "satellite_church_admin",
  "service_unit_leader",
  "sub_unit_leader",
]);

function assertAdminLocationFields(role: string, branchCountry: string, branchState: string): void {
  if (ROLES_REQUIRING_COUNTRY.has(role) && !branchCountry) {
    throw new Error("Country is required for this admin role.");
  }
  if (ROLES_REQUIRING_STATE.has(role) && !branchState) {
    throw new Error("State / region is required for this admin role.");
  }
  if (branchCountry && branchState) {
    assertStateBelongsToCountry(branchCountry, branchState);
  }
}

const PENDING_ADMIN_REQUEST_STATUSES = ["open", "in_review"];

function adminPayloadFromRequest(req: Record<string, unknown>): Record<string, unknown> {
  const payload = (req.payload && typeof req.payload === "object" ? req.payload : {}) as Record<string, unknown>;
  const admin = (payload.admin && typeof payload.admin === "object" ? payload.admin : {}) as Record<string, unknown>;
  return admin;
}

async function pendingCountryAdminRequestExists(
  supabase: SupabaseClient,
  branchCountry: string,
  excludeRequestId?: number,
): Promise<boolean> {
  const cc = normUp(branchCountry);
  if (!cc) return false;
  const { data, error } = await supabase.from("admin_requests").select("id,payload,status").eq(
    "request_type",
    "admin_account",
  ).in("status", PENDING_ADMIN_REQUEST_STATUSES);
  if (error) throw new Error(error.message);
  return (data || []).some((r) => {
    if (excludeRequestId != null && Number(r.id) === Number(excludeRequestId)) return false;
    const admin = adminPayloadFromRequest(r as Record<string, unknown>);
    return norm(admin.role) === "country_super_admin" && normUp(admin.branch_country) === cc;
  });
}

async function pendingStateAdminRequestExists(
  supabase: SupabaseClient,
  branchCountry: string,
  branchState: string,
  excludeRequestId?: number,
): Promise<boolean> {
  const cc = normUp(branchCountry);
  const st = normUp(branchState);
  if (!cc || !st) return false;
  const { data, error } = await supabase.from("admin_requests").select("id,payload,status").eq(
    "request_type",
    "admin_account",
  ).in("status", PENDING_ADMIN_REQUEST_STATUSES);
  if (error) throw new Error(error.message);
  return (data || []).some((r) => {
    if (excludeRequestId != null && Number(r.id) === Number(excludeRequestId)) return false;
    const admin = adminPayloadFromRequest(r as Record<string, unknown>);
    return norm(admin.role) === "state_super_admin" &&
      normUp(admin.branch_country) === cc &&
      normUp(admin.branch_state) === st;
  });
}

async function assertUniqueCountryAdmin(
  supabase: SupabaseClient,
  branchCountry: string,
  excludeId?: number,
  excludeRequestId?: number,
): Promise<void> {
  const cc = normUp(branchCountry);
  if (!cc) return;
  const { data, error } = await supabase.from("admins").select("id,full_name,is_active").eq("role", "country_super_admin")
    .eq("branch_country", cc);
  if (error) throw new Error(error.message);
  const taken = (data || []).find((r) => Number(r.id) !== Number(excludeId ?? 0));
  if (taken) {
    const active = Number((taken as { is_active?: number }).is_active) === 1;
    throw new Error(
      `This country already has a Country Admin (${(taken as { full_name?: string }).full_name || "existing account"})${
        active ? "" : " (inactive)"
      }. Choose another country or remove the existing account first.`,
    );
  }
  if (await pendingCountryAdminRequestExists(supabase, cc, excludeRequestId)) {
    throw new Error("A Country Admin request for this country is already awaiting Super Admin approval.");
  }
}

async function assertUniqueStateAdmin(
  supabase: SupabaseClient,
  branchCountry: string,
  branchState: string,
  excludeId?: number,
  excludeRequestId?: number,
): Promise<void> {
  const cc = normUp(branchCountry);
  const st = normUp(branchState);
  if (!cc || !st) return;
  const { data, error } = await supabase.from("admins").select("id,full_name,is_active").eq("role", "state_super_admin")
    .eq("branch_country", cc).eq("branch_state", st);
  if (error) throw new Error(error.message);
  const taken = (data || []).find((r) => Number(r.id) !== Number(excludeId ?? 0));
  if (taken) {
    const active = Number((taken as { is_active?: number }).is_active) === 1;
    throw new Error(
      `This state already has a State Branch Admin (${(taken as { full_name?: string }).full_name || "existing account"})${
        active ? "" : " (inactive)"
      }. Choose another state or remove the existing account first.`,
    );
  }
  if (await pendingStateAdminRequestExists(supabase, cc, st, excludeRequestId)) {
    throw new Error("A State Branch Admin request for this state is already awaiting Super Admin approval.");
  }
}

async function notifyGlobalAdminsOfRequest(
  supabase: SupabaseClient,
  requestId: number,
  title: string,
  body: string,
): Promise<void> {
  const { data: supers } = await supabase.from("admins").select("id").in("role", ["super_admin", "general_admin"]).eq(
    "is_active",
    1,
  );
  for (const row of supers || []) {
    await supabase.from("admin_notifications").insert({
      admin_id: (row as { id: number }).id,
      type: "admin_request",
      title,
      body,
      entity_type: "request",
      entity_id: String(requestId),
    });
  }
}

async function validateAdminAccountProposal(
  supabase: SupabaseClient,
  countryAdmin: AdminRow,
  rawPayload: unknown,
): Promise<{ admin: Record<string, unknown> }> {
  const payload = (rawPayload && typeof rawPayload === "object" ? rawPayload : {}) as Record<string, unknown>;
  const body = (payload.admin && typeof payload.admin === "object" ? payload.admin : {}) as Record<string, unknown>;
  const row = {
    full_name: norm(body.full_name),
    username: normalizeAdminUsername(body.username),
    email: norm(body.email).toLowerCase(),
    password: String(body.password || ""),
    role: norm(body.role),
    service_unit_id: body.service_unit_id ? Number(body.service_unit_id) : null,
    sub_unit_name: norm(body.sub_unit_name),
    branch_country: normUp(countryAdmin.branch_country),
    branch_state: normUp(body.branch_state),
    satellite_site: norm(body.satellite_site),
  };
  assertCountryManagedRole(row.role);
  assertAdminLocationFields(row.role, row.branch_country, row.branch_state);
  if (["state_super_admin", "satellite_church_admin"].includes(row.role) && !row.branch_state) {
    throw new Error("State / region is required for this role.");
  }
  if (row.role === "service_unit_leader" && !row.service_unit_id) {
    throw new Error("Service unit is required.");
  }
  if (row.role === "sub_unit_leader") {
    if (!row.service_unit_id) throw new Error("Service unit is required.");
    await assertSubUnitInServiceUnit(supabase, Number(row.service_unit_id), row.sub_unit_name);
  }
  if (row.role === "satellite_church_admin" && !row.satellite_site) {
    throw new Error("Satellite church is required for Satellite Pastor Admin.");
  }
  if (!row.full_name) throw new Error("Full name is required.");
  if (!row.password || row.password.length < 8) {
    throw new Error("Password is required (minimum 8 characters).");
  }
  await assertAdminUsernameAvailable(supabase, row.username);
  await assertAdminEmailAvailable(supabase, row.email);
  if (row.role === "state_super_admin") {
    await assertUniqueStateAdmin(supabase, row.branch_country, row.branch_state);
  }
  return { admin: row };
}

async function insertAdminFromBody(
  supabase: SupabaseClient,
  body: Record<string, unknown>,
  actor: AdminRow,
  ip: string,
): Promise<Record<string, unknown>> {
  const row = {
    full_name: norm(body.full_name),
    username: normalizeAdminUsername(body.username),
    email: norm(body.email).toLowerCase(),
    password: String(body.password || ""),
    role: norm(body.role),
    service_unit_id: body.service_unit_id ? Number(body.service_unit_id) : null,
    sub_unit_name: norm(body.sub_unit_name),
    branch_country: normUp(body.branch_country),
    branch_state: normUp(body.branch_state),
    satellite_site: norm(body.satellite_site),
    is_active: Number(body.is_active ?? 1),
  };
  if (!row.full_name) throw new Error("Full name is required.");
  if (!row.password) throw new Error("Password is required.");
  if (row.role === "country_super_admin" && !row.branch_country) {
    throw new Error("Country is required for Country Admin accounts.");
  }
  assertAdminLocationFields(row.role, row.branch_country, row.branch_state);
  if (row.role === "country_super_admin") {
    await assertUniqueCountryAdmin(supabase, row.branch_country);
  }
  if (row.role === "state_super_admin") {
    await assertUniqueStateAdmin(supabase, row.branch_country, row.branch_state);
  }
  if (row.role === "sub_unit_leader" && row.service_unit_id) {
    await assertSubUnitInServiceUnit(supabase, Number(row.service_unit_id), row.sub_unit_name);
  }
  await assertAdminUsernameAvailable(supabase, row.username);
  await assertAdminEmailAvailable(supabase, row.email);
  const { data, error } = await supabase.from("admins").insert(row).select("*").single();
  if (error) throwAdminPersistError(error);
  await logActivity(supabase, actor, "admin.create", "admin", String(data.id), `Created admin ${data.username}`, ip);
  return data as Record<string, unknown>;
}

async function applyAdminAccountRequest(
  supabase: SupabaseClient,
  req: Record<string, unknown>,
  approver: AdminRow,
  ip: string,
): Promise<void> {
  const admin = adminPayloadFromRequest(req);
  const created = await insertAdminFromBody(supabase, { ...admin, is_active: 1 }, approver, ip);
  await logActivity(
    supabase,
    approver,
    "request.approve_admin",
    "request",
    String(req.id),
    `Approved admin account ${created.username}`,
    ip,
  );
}

function throwAdminPersistError(error: { message?: string }): never {
  const msg = String(error?.message || "");
  if (msg.includes("idx_admins_username_lower")) {
    throw new Error(
      'That username is already taken. Usernames are unique across every country — use something like "gb.country.admin" for United Kingdom.',
    );
  }
  if (msg.includes("idx_admins_email_lower")) {
    throw new Error("That email is already used by another admin account.");
  }
  throw new Error(msg || "Failed to save admin.");
}

function isServiceUnitLeader(admin: AdminRow): boolean {
  return norm(admin.role) === "service_unit_leader";
}

function isCountrySuperAdmin(admin: AdminRow): boolean {
  return norm(admin.role) === "country_super_admin";
}

const COUNTRY_MANAGED_ADMIN_ROLES = [
  "satellite_church_admin",
  "state_super_admin",
  "service_unit_leader",
  "sub_unit_leader",
];

function assertCountryManagedRole(role: string): void {
  if (!COUNTRY_MANAGED_ADMIN_ROLES.includes(norm(role))) {
    throw new Error("Country admins may only manage branch, state, service unit, and sub-unit admin accounts.");
  }
}

function adminInCountry(row: Record<string, unknown>, countryCode: string): boolean {
  return normUp(row.branch_country) === normUp(countryCode);
}

async function assertCountryAdminTarget(
  supabase: SupabaseClient,
  countryAdmin: AdminRow,
  target: Record<string, unknown>,
): Promise<void> {
  const cc = normUp(countryAdmin.branch_country);
  if (!cc) throw new Error("Your country scope is not configured.");
  if (!adminInCountry(target, cc)) throw new Error("Not allowed outside your country.");
  assertCountryManagedRole(norm(target.role));
}

function assertLeaderStatusTransition(admin: AdminRow, current: string, next: string): void {
  const role = norm(admin.role);
  if (!["service_unit_leader", "sub_unit_leader"].includes(role)) return;
  const c = normStatus(current);
  const n = normStatus(next);
  if (c === n) return;
  const allowed: Record<string, string[]> = {
    new: ["in_progress", "accepted", "rejected"],
    in_progress: ["accepted", "rejected", "new"],
    accepted: ["accepted", "archived"],
    rejected: ["rejected", "archived"],
    archived: ["archived"],
  };
  const ok = (allowed[c] || []).includes(n);
  if (!ok) {
    throw new Error(`Cannot move application from ${c} to ${n}.`);
  }
}

async function assertSubUnitInServiceUnit(
  supabase: SupabaseClient,
  unitId: number,
  subUnitName: string,
): Promise<void> {
  const name = norm(subUnitName);
  if (!name) throw new Error("Sub-unit is required.");
  const { data, error } = await supabase.from("sub_units").select("id").eq("unit_id", unitId).eq("name", name).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Sub-unit must already exist under your service unit (structural changes are done by Super / General Admin).");
}

async function logActivity(
  supabase: SupabaseClient,
  admin: AdminRow,
  action: string,
  entityType: string,
  entityId: string,
  description: string,
  ip: string,
) {
  await supabase.from("activity_logs").insert({
    admin_id: Number(admin.id) || null,
    admin_name: String(admin.full_name || ""),
    action,
    entity_type: entityType,
    entity_id: entityId,
    description,
    ip_address: ip,
  });
}

export async function dispatchAdminOp(
  supabase: SupabaseClient,
  op: string,
  params: Record<string, unknown>,
  ctx: Ctx,
): Promise<unknown> {
  const admin = ctx.admin;
  const ip = ctx.ip;

  switch (op) {
    case "populateDemoData":
      return { ok: true };
    case "refreshSession": {
      let service_unit_name = "";
      if (admin.service_unit_id != null) {
        const { data: u } = await supabase.from("service_units").select("name").eq("id", admin.service_unit_id).maybeSingle();
        service_unit_name = String(u?.name || "");
      }
      return {
        admin: {
          id: admin.id,
          full_name: admin.full_name,
          username: admin.username,
          email: admin.email,
          role: admin.role,
          service_unit_id: admin.service_unit_id,
          sub_unit_name: admin.sub_unit_name || "",
          branch_country: admin.branch_country ?? "",
          branch_state: admin.branch_state ?? "",
          satellite_site: admin.satellite_site ?? "",
          service_unit_name,
        },
      };
    }
    case "logout":
      await logActivity(supabase, admin, "admin.logout", "admin", String(admin.id || ""), "Admin logged out", ip);
      return { ok: true };
    case "queue":
      return handleQueue(supabase, params, admin);
    case "stats":
      return handleStats(supabase, params, admin);
    case "updateStatus":
      return handleUpdateStatus(supabase, params, admin, ip);
    case "deleteReg":
      return handleDeleteReg(supabase, params, admin, ip);
    case "units":
      return handleUnits(supabase, admin);
    case "createUnit":
      return handleCreateUnit(supabase, params, admin, ip);
    case "updateUnit":
      return handleUpdateUnit(supabase, params, admin, ip);
    case "unitDeleteInfo":
      return handleUnitDeleteInfo(supabase, params, admin);
    case "subDeleteInfo":
      return handleSubDeleteInfo(supabase, params, admin);
    case "deleteUnit":
      return handleDeleteUnit(supabase, params, admin, ip);
    case "createSub":
      return handleCreateSub(supabase, params, admin, ip);
    case "updateSub":
      return handleUpdateSub(supabase, params, admin, ip);
    case "deleteSub":
      return handleDeleteSub(supabase, params, admin, ip);
    case "admins":
      return handleAdmins(supabase, admin);
    case "createAdmin":
      return handleCreateAdmin(supabase, params, admin, ip);
    case "updateAdmin":
      return handleUpdateAdmin(supabase, params, admin, ip);
    case "deleteAdmin":
      return handleDeleteAdmin(supabase, params, admin, ip);
    case "updateRegistrationBranch":
      return handleUpdateRegistrationBranch(supabase, params, admin, ip);
    case "members":
      return handleMembers(supabase, params, admin);
    case "requests":
      return handleRequests(supabase, params, admin);
    case "createRequest":
      return handleCreateRequest(supabase, params, admin, ip);
    case "updateRequest":
      return handleUpdateRequest(supabase, params, admin, ip);
    case "approveServiceUnitProposal":
      return handleApproveServiceUnitProposal(supabase, params, admin, ip);
    case "settings":
      return handleSettings(supabase);
    case "updateSettings":
      return handleUpdateSettings(supabase, params, admin, ip);
    case "activity":
      return handleActivity(supabase, params, admin);
    case "subUnitQueuesByUnit":
      return handleSubUnitQueuesByUnit(supabase, admin);
    case "overdueAlerts":
      return handleOverdueAlerts(supabase, admin);
    case "notifications":
      return handleNotifications(supabase, admin);
    case "markNotificationRead":
      return handleMarkNotificationRead(supabase, params, admin);
    case "markAllNotificationsRead":
      return handleMarkAllNotificationsRead(supabase, admin);
    case "announcements":
      return handleAnnouncements(supabase, admin);
    case "createAnnouncement":
      return handleCreateAnnouncement(supabase, params, admin, ip);
    case "updateAnnouncement":
      return handleUpdateAnnouncement(supabase, params, admin, ip);
    case "deleteAnnouncement":
      return handleDeleteAnnouncement(supabase, params, admin, ip);
    case "catalogList":
      return handleCatalogList(supabase, admin);
    case "catalogAddCountry":
      return handleCatalogAddCountry(supabase, params, admin, ip);
    case "catalogAddState":
      return handleCatalogAddState(supabase, params, admin, ip);
    case "catalogAddChurch":
      return handleCatalogAddChurch(supabase, params, admin, ip);
    case "catalogSetChurchActive":
      return handleCatalogSetChurchActive(supabase, params, admin, ip);
    case "catalogDeleteChurch":
      return handleCatalogDeleteChurch(supabase, params, admin, ip);
    case "catalogCreateLocation":
      return handleCatalogCreateLocation(supabase, params, admin, ip);
    default:
      throw new Error(`Unsupported op: ${op}`);
  }
}

async function handleQueue(supabase: SupabaseClient, params: Record<string, unknown>, admin: AdminRow) {
  const page = Math.max(1, Number(params.page) || 1);
  const perPage = Math.min(100, Math.max(1, Number(params.per_page) || 25));
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  let q = supabase.from("registrations").select("*", { count: "exact" });
  q = applyRegistrationScopeQuery(q, admin);

  if (params.status) {
    const st = norm(params.status).toLowerCase();
    if (st === "active") q = q.in("status", ["new", "in_progress"]);
    else q = q.eq("status", normStatus(params.status));
  }
  if (params.unit_id) q = q.eq("unit_id", Number(params.unit_id));
  if (params.sub_unit) q = q.eq("sub_unit", norm(params.sub_unit));
  if (params.sex) q = q.eq("sex", norm(params.sex));
  if (params.from) q = q.gte("submitted_at", `${norm(params.from)}T00:00:00.000Z`);
  if (params.to) q = q.lte("submitted_at", `${norm(params.to)}T23:59:59.999Z`);
  if (params.search) {
    const r = norm(params.search).replace(/%/g, "").slice(0, 120);
    if (r) q = q.or(`first_name.ilike.%${r}%,surname.ilike.%${r}%,email.ilike.%${r}%,phone1.ilike.%${r}%`);
  }
  if (norm(params.filter_branch_state)) q = q.eq("branch_state", normUp(params.filter_branch_state));

  const sortKey = ["submitted_at", "surname", "unit_name", "status"].includes(norm(params.sort))
    ? norm(params.sort)
    : "submitted_at";
  const asc = normUp(params.dir) === "ASC";
  q = q.order(sortKey, { ascending: asc });

  const { data, error, count } = await q.range(from, to);
  if (error) throw new Error(error.message);
  let rows = data || [];
  if (params.overdue_only) {
    const { data: settings } = await supabase.from("app_settings").select("overdue_threshold_hours").eq("id", 1).maybeSingle();
    const th = Number(settings?.overdue_threshold_hours ?? 72);
    const now = Date.now();
    rows = rows.filter((r: Record<string, unknown>) => {
      const st = normStatus(r.status);
      if (!["new", "in_progress"].includes(st)) return false;
      const t = new Date(String(r.submitted_at || "")).getTime();
      return (now - t) / (1000 * 60 * 60) >= th;
    });
  }
  const total = typeof count === "number" ? count : rows.length;
  const pages = Math.max(1, Math.ceil(total / perPage));
  return { data: rows, pagination: { page, per_page: perPage, total, pages } };
}

async function handleStats(supabase: SupabaseClient, params: Record<string, unknown>, admin: AdminRow) {
  let q = supabase.from("registrations").select(
    "id,status,sex,unit_name,submitted_at,branch_country,branch_state,satellite_site,unit_id",
  );
  q = applyRegistrationScopeQuery(q, admin);
  if (params.filter_country) q = q.eq("branch_country", normUp(params.filter_country));
  if (params.filter_state) q = q.eq("branch_state", normUp(params.filter_state));
  if (params.filter_branch) q = q.eq("satellite_site", norm(params.filter_branch));
  if (params.filter_unit_id) q = q.eq("unit_id", Number(params.filter_unit_id));
  if (params.filter_sub_unit) q = q.eq("sub_unit", norm(params.filter_sub_unit));
  if (params.filter_status && norm(params.filter_status) !== "all") {
    if (norm(params.filter_status) === "active") q = q.in("status", ["new", "in_progress"]);
    else q = q.eq("status", normStatus(params.filter_status));
  }
  if (params.filter_sex) q = q.eq("sex", norm(params.filter_sex));
  if (params.filter_from) q = q.gte("submitted_at", `${norm(params.filter_from)}T00:00:00.000Z`);

  const { data: rowsRaw, error } = await q.limit(8000);
  if (error) throw new Error(error.message);
  const rows = (rowsRaw || []) as Record<string, unknown>[];

  const { data: settings } = await supabase.from("app_settings").select("*").eq("id", 1).maybeSingle();
  const overdueTh = Number(settings?.overdue_threshold_hours ?? 72);
  const now = Date.now();
  const msTh = overdueTh * 3600000;

  const totals: Record<string, number> = {
    registrations: rows.length,
    pending: rows.filter((r) => normStatus(r.status) === "new").length,
    new_unreviewed: rows.filter((r) => normStatus(r.status) === "new").length,
    in_progress_count: rows.filter((r) => normStatus(r.status) === "in_progress").length,
    waitlisted: rows.filter((r) => normStatus(r.status) === "in_progress").length,
    approved: rows.filter((r) => normStatus(r.status) === "accepted").length,
    rejected: rows.filter((r) => normStatus(r.status) === "rejected").length,
    overdue_count: rows.filter((r) => {
      const st = normStatus(r.status);
      if (!["new", "in_progress"].includes(st)) return false;
      return now - new Date(String(r.submitted_at || "")).getTime() >= msTh;
    }).length,
    overdue_threshold_hours: overdueTh,
    active_members: rows.filter((r) => normStatus(r.status) === "accepted").length,
    this_week: rows.filter((r) => {
      const t = new Date(String(r.submitted_at || "")).getTime();
      return now - t < 7 * 86400000;
    }).length,
    new_today: rows.filter((r) => String(r.submitted_at || "").slice(0, 10) === new Date().toISOString().slice(0, 10)).length,
    accepted_this_month: 0,
    accepted_prev_month: 0,
    rejected_this_month: 0,
    rejected_prev_month: 0,
    active_units: 0,
    parent_units: 0,
    sub_units_count: 0,
  };

  const d0 = new Date();
  const thisYm = `${d0.getFullYear()}-${String(d0.getMonth() + 1).padStart(2, "0")}`;
  const prev = new Date(d0.getFullYear(), d0.getMonth() - 1, 1);
  const prevYm = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
  totals.accepted_this_month = rows.filter((r) =>
    normStatus(r.status) === "accepted" && String(r.submitted_at || "").slice(0, 7) === thisYm.slice(0, 7)
  ).length;
  totals.accepted_prev_month = rows.filter((r) =>
    normStatus(r.status) === "accepted" && String(r.submitted_at || "").slice(0, 7) === prevYm
  ).length;
  totals.rejected_this_month = rows.filter((r) =>
    normStatus(r.status) === "rejected" && String(r.submitted_at || "").slice(0, 7) === thisYm.slice(0, 7)
  ).length;
  totals.rejected_prev_month = rows.filter((r) =>
    normStatus(r.status) === "rejected" && String(r.submitted_at || "").slice(0, 7) === prevYm
  ).length;

  const { data: units } = await supabase.from("service_units").select("id,is_active");
  const { data: subs } = await supabase.from("sub_units").select("id");
  totals.active_units = (units || []).filter((u: { is_active?: number }) => Number(u.is_active ?? 1) === 1).length;
  totals.parent_units = totals.active_units;
  totals.sub_units_count = (subs || []).length;

  const byUnitMap: Record<string, number> = {};
  rows.forEach((r) => {
    const k = String(r.unit_name || "Unknown");
    byUnitMap[k] = (byUnitMap[k] || 0) + 1;
  });
  const by_unit = Object.entries(byUnitMap).map(([unit_name, cnt]) => ({ unit_name, cnt }));

  const bySexMap: Record<string, number> = {};
  rows.forEach((r) => {
    const k = String(r.sex || "Unknown");
    bySexMap[k] = (bySexMap[k] || 0) + 1;
  });
  const by_sex = Object.entries(bySexMap).map(([sex, cnt]) => ({ sex, cnt }));

  const trendDays = Math.min(365, Math.max(7, Number(params.trend_days) || 28));
  const trend = [];
  for (let i = trendDays - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const day = d.toISOString().slice(0, 10);
    trend.push({ day, cnt: rows.filter((r) => String(r.submitted_at || "").slice(0, 10) === day).length });
  }

  const branches = new Set<string>();
  rows.forEach((r) => {
    const s = norm(r.satellite_site);
    if (s) branches.add(s);
  });

  const status_distribution: Record<string, number> = {};
  ["new", "in_progress", "accepted", "rejected", "archived"].forEach((k) => {
    status_distribution[k] = rows.filter((r) => normStatus(r.status) === k).length;
  });
  status_distribution["overdue"] = totals.overdue_count;

  const { data: recent_activity } = await supabase.from("activity_logs").select("*").order("created_at", {
    ascending: false,
  }).limit(10);

  return {
    totals: { ...totals, status_distribution, top_overdue_units: [] as { label: string; count: number }[] },
    by_unit,
    by_sex,
    trend,
    recent_activity: recent_activity || [],
    branch_options: [...branches].sort(),
  };
}

async function handleUpdateStatus(
  supabase: SupabaseClient,
  params: Record<string, unknown>,
  admin: AdminRow,
  ip: string,
) {
  const id = params.id;
  const body = (params.body || {}) as Record<string, unknown>;
  const { data: row, error: fe } = await supabase.from("registrations").select("*").eq("id", id).maybeSingle();
  if (fe || !row) throw new Error("Registration not found.");
  if (!canAccessRegistration(admin, row as Record<string, unknown>)) {
    throw new Error("Not allowed for this queue item.");
  }
  const currentStatus = normStatus(row.status);
  const nextStatus = normStatus(body.status ?? row.status);
  assertLeaderStatusTransition(admin, currentStatus, nextStatus);
  if (currentStatus === "in_progress" && nextStatus === "accepted") {
    if (!Boolean(body.verify_called_candidate) || !Boolean(body.verify_physical_meeting)) {
      throw new Error(
        "Before accepting, confirm you called the candidate and invited them for a physical meeting in church.",
      );
    }
  }
  const patch: Record<string, unknown> = {
    status: nextStatus,
    notes: body.notes ?? row.notes ?? "",
  };
  if (body.verify_called_candidate != null) {
    patch.leader_accept_called_candidate = Boolean(body.verify_called_candidate);
  }
  if (body.verify_physical_meeting != null) {
    patch.leader_accept_physical_meeting = Boolean(body.verify_physical_meeting);
  }
  if (body.verify_foundation_class != null) {
    patch.leader_accept_foundation_class = Boolean(body.verify_foundation_class);
  }
  if (body.verify_water_baptism != null) {
    patch.leader_accept_water_baptism = Boolean(body.verify_water_baptism);
  }
  if (normStatus(patch.status) === "accepted" && (body.verify_called_candidate != null || body.verify_physical_meeting != null)) {
    patch.leader_accept_verified_at = new Date().toISOString();
  }
  const { error } = await supabase.from("registrations").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  await logActivity(
    supabase,
    admin,
    "queue.update",
    "registration",
    String(id),
    `Status → ${patch.status}`,
    ip,
  );
  return { ok: true };
}

async function handleDeleteReg(supabase: SupabaseClient, params: Record<string, unknown>, admin: AdminRow, ip: string) {
  if (norm(admin.role) !== "super_admin" && norm(admin.role) !== "general_admin") {
    throw new Error("Only super or general admin can delete registrations.");
  }
  const id = params.id;
  const { error } = await supabase.from("registrations").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await logActivity(supabase, admin, "queue.delete", "registration", String(id), "Registration deleted", ip);
  return { ok: true };
}

async function handleUnits(supabase: SupabaseClient, admin: AdminRow) {
  let unitQuery = supabase.from("service_units").select("*").order("sort_order", { ascending: true });
  if (isServiceUnitLeader(admin)) {
    unitQuery = unitQuery.eq("id", Number(admin.service_unit_id));
  }
  const { data: units, error } = await unitQuery;
  if (error) throw new Error(error.message);
  let subQuery = supabase.from("sub_units").select("*").order("sort_order", { ascending: true });
  if (isServiceUnitLeader(admin)) {
    subQuery = subQuery.eq("unit_id", Number(admin.service_unit_id));
  }
  const { data: subs, error: se } = await subQuery;
  if (se) throw new Error(se.message);
  const data = (units || []).map((u: Record<string, unknown>) => ({
    ...u,
    sub_units: (subs || []).filter((s: Record<string, unknown>) => Number(s.unit_id) === Number(u.id)),
  }));
  return { data };
}

async function handleCreateUnit(supabase: SupabaseClient, params: Record<string, unknown>, admin: AdminRow, ip: string) {
  if (!["super_admin", "general_admin"].includes(norm(admin.role))) throw new Error("Not allowed.");
  const body = (params.body || {}) as Record<string, unknown>;
  const { data: maxRow } = await supabase.from("service_units").select("id").order("id", { ascending: false }).limit(1).maybeSingle();
  const nextId = Number(maxRow?.id || 0) + 1;
  const row = {
    id: nextId,
    name: norm(body.name),
    description: norm(body.description),
    coordinator: norm(body.coordinator),
    sort_order: Number(body.sort_order ?? 0),
    is_active: Number(body.is_active ?? 1),
  };
  const { data, error } = await supabase.from("service_units").insert(row).select("*").single();
  if (error) throw new Error(error.message);
  await logActivity(supabase, admin, "unit.create", "unit", String(data.id), `Created unit ${data.name}`, ip);
  return { data };
}

async function handleUpdateUnit(supabase: SupabaseClient, params: Record<string, unknown>, admin: AdminRow, ip: string) {
  if (!["super_admin", "general_admin"].includes(norm(admin.role))) throw new Error("Not allowed.");
  const body = (params.body || {}) as Record<string, unknown>;
  const { error } = await supabase.from("service_units").update({
    name: norm(body.name),
    description: norm(body.description),
    coordinator: norm(body.coordinator),
    sort_order: Number(body.sort_order ?? 0),
    is_active: Number(body.is_active ?? 1),
  }).eq("id", params.id);
  if (error) throw new Error(error.message);
  await logActivity(supabase, admin, "unit.update", "unit", String(params.id), "Updated unit", ip);
  return { data: { id: params.id, ...body } };
}

async function handleUnitDeleteInfo(supabase: SupabaseClient, params: Record<string, unknown>, admin: AdminRow) {
  if (!["super_admin", "general_admin"].includes(norm(admin.role))) throw new Error("Not allowed.");
  const unitId = Number(params.id);
  const { data: unit } = await supabase.from("service_units").select("id,name").eq("id", unitId).maybeSingle();
  if (!unit) throw new Error("Service unit not found.");
  const { count: memberCount } = await supabase.from("registrations").select("id", { count: "exact", head: true }).eq(
    "unit_id",
    unitId,
  ).eq("status", "accepted");
  const { count: subUnitCount } = await supabase.from("sub_units").select("id", { count: "exact", head: true }).eq(
    "unit_id",
    unitId,
  );
  return {
    name: String((unit as { name?: string }).name || ""),
    memberCount: memberCount ?? 0,
    subUnitCount: subUnitCount ?? 0,
  };
}

async function handleSubDeleteInfo(supabase: SupabaseClient, params: Record<string, unknown>, admin: AdminRow) {
  if (!["super_admin", "general_admin"].includes(norm(admin.role))) throw new Error("Not allowed.");
  const subId = Number(params.id);
  const { data: sub } = await supabase.from("sub_units").select("id,name,unit_id").eq("id", subId).maybeSingle();
  if (!sub) throw new Error("Sub-unit not found.");
  const subName = String((sub as { name?: string }).name || "");
  const unitId = Number((sub as { unit_id?: number }).unit_id);
  const { count: memberCount } = await supabase.from("registrations").select("id", { count: "exact", head: true }).eq(
    "unit_id",
    unitId,
  ).eq("sub_unit", subName).eq("status", "accepted");
  return { name: subName, memberCount: memberCount ?? 0 };
}

async function handleDeleteUnit(supabase: SupabaseClient, params: Record<string, unknown>, admin: AdminRow, ip: string) {
  if (!["super_admin", "general_admin"].includes(norm(admin.role))) throw new Error("Not allowed.");
  const { error } = await supabase.from("service_units").delete().eq("id", params.id);
  if (error) throw new Error(error.message);
  await logActivity(supabase, admin, "unit.delete", "unit", String(params.id), "Deleted unit", ip);
  return { ok: true };
}

async function handleCreateSub(supabase: SupabaseClient, params: Record<string, unknown>, admin: AdminRow, ip: string) {
  if (!["super_admin", "general_admin"].includes(norm(admin.role))) throw new Error("Not allowed.");
  const body = (params.body || {}) as Record<string, unknown>;
  const row = {
    unit_id: Number(body.unit_id),
    name: norm(body.name),
    sort_order: Number(body.sort_order ?? 0),
    is_active: Number(body.is_active ?? 1),
  };
  const { data, error } = await supabase.from("sub_units").insert(row).select("*").single();
  if (error) throw new Error(error.message);
  await logActivity(supabase, admin, "sub.create", "sub_unit", String(data.id), `Created sub ${data.name}`, ip);
  return { data };
}

async function handleUpdateSub(supabase: SupabaseClient, params: Record<string, unknown>, admin: AdminRow, ip: string) {
  if (!["super_admin", "general_admin"].includes(norm(admin.role))) throw new Error("Not allowed.");
  const body = (params.body || {}) as Record<string, unknown>;
  const { error } = await supabase.from("sub_units").update({
    name: norm(body.name),
    sort_order: Number(body.sort_order ?? 0),
    is_active: Number(body.is_active ?? 1),
  }).eq("id", params.id);
  if (error) throw new Error(error.message);
  await logActivity(supabase, admin, "sub.update", "sub_unit", String(params.id), "Updated sub-unit", ip);
  return { data: { id: params.id } };
}

async function handleDeleteSub(supabase: SupabaseClient, params: Record<string, unknown>, admin: AdminRow, ip: string) {
  if (!["super_admin", "general_admin"].includes(norm(admin.role))) throw new Error("Not allowed.");
  const { error } = await supabase.from("sub_units").delete().eq("id", params.id);
  if (error) throw new Error(error.message);
  await logActivity(supabase, admin, "sub.delete", "sub_unit", String(params.id), "Deleted sub-unit", ip);
  return { ok: true };
}

async function handleAdmins(supabase: SupabaseClient, admin: AdminRow) {
  const role = norm(admin.role);
  let q = supabase.from("admins").select("*").order("id", { ascending: true });
  if (role === "service_unit_leader") {
    q = q.eq("service_unit_id", admin.service_unit_id).eq("role", "sub_unit_leader");
  } else if (role === "country_super_admin") {
    q = q.eq("branch_country", normUp(admin.branch_country));
  } else if (role === "state_super_admin") {
    q = q.eq("branch_country", normUp(admin.branch_country)).eq("branch_state", normUp(admin.branch_state));
  } else if (!["super_admin", "general_admin"].includes(role)) {
    q = q.eq("id", -1);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return { data: data || [] };
}

async function handleCreateAdmin(supabase: SupabaseClient, params: Record<string, unknown>, admin: AdminRow, ip: string) {
  const body = (params.body || {}) as Record<string, unknown>;
  const actorRole = norm(admin.role);
  if (!["super_admin", "general_admin", "service_unit_leader", "country_super_admin"].includes(actorRole)) {
    throw new Error("Not allowed.");
  }
  if (actorRole === "country_super_admin") {
    throw new Error(
      "Country admins must submit new accounts as requests. Super Admin approval is required before the account becomes active.",
    );
  }
  const row = {
    full_name: norm(body.full_name),
    username: norm(body.username),
    email: norm(body.email),
    password: String(body.password || ""),
    role: norm(body.role),
    service_unit_id: body.service_unit_id ? Number(body.service_unit_id) : null,
    sub_unit_name: norm(body.sub_unit_name),
    branch_country: normUp(body.branch_country),
    branch_state: normUp(body.branch_state),
    satellite_site: norm(body.satellite_site),
    is_active: Number(body.is_active ?? 1),
  };
  if (actorRole === "service_unit_leader") {
    row.service_unit_id = Number(admin.service_unit_id);
    row.role = "sub_unit_leader";
    row.branch_country = normUp(admin.branch_country);
    row.branch_state = normUp(admin.branch_state);
    row.satellite_site = norm(admin.satellite_site);
    await assertSubUnitInServiceUnit(supabase, Number(admin.service_unit_id), row.sub_unit_name);
  }
  const data = await insertAdminFromBody(supabase, row, admin, ip);
  return { data };
}

async function handleUpdateAdmin(supabase: SupabaseClient, params: Record<string, unknown>, admin: AdminRow, ip: string) {
  const body = (params.body || {}) as Record<string, unknown>;
  const targetId = Number(params.id);
  const { data: target } = await supabase.from("admins").select("*").eq("id", targetId).maybeSingle();
  if (!target) throw new Error("Admin not found.");
  const actorRole = norm(admin.role);
  if (!["super_admin", "general_admin", "service_unit_leader", "country_super_admin"].includes(actorRole)) {
    throw new Error("Not allowed.");
  }
  if (actorRole === "service_unit_leader") {
    if (Number(target.service_unit_id) !== Number(admin.service_unit_id)) throw new Error("Not allowed.");
    if (norm(target.role) !== "sub_unit_leader") throw new Error("Not allowed.");
  }
  if (actorRole === "country_super_admin") {
    await assertCountryAdminTarget(supabase, admin, target as Record<string, unknown>);
  }
  const unitId = norm(admin.role) === "service_unit_leader"
    ? Number(admin.service_unit_id)
    : (body.service_unit_id !== undefined
      ? (body.service_unit_id ? Number(body.service_unit_id) : null)
      : Number(target.service_unit_id));
  const subName = norm(body.sub_unit_name ?? target.sub_unit_name);
  if (norm(admin.role) === "service_unit_leader" && unitId) {
    await assertSubUnitInServiceUnit(supabase, unitId, subName);
  }
  const nextRole = actorRole === "service_unit_leader"
    ? "sub_unit_leader"
    : actorRole === "country_super_admin"
      ? norm(body.role ?? target.role)
      : (body.role ?? target.role);
  if (actorRole === "country_super_admin") {
    assertCountryManagedRole(nextRole);
    if (nextRole === "sub_unit_leader" && unitId) {
      await assertSubUnitInServiceUnit(supabase, Number(unitId), subName);
    }
  }
  const patch: Record<string, unknown> = {
    full_name: body.full_name ?? target.full_name,
    email: body.email ?? target.email,
    role: nextRole,
    service_unit_id: actorRole === "service_unit_leader" ? Number(admin.service_unit_id) : unitId,
    sub_unit_name: subName,
    branch_country: actorRole === "service_unit_leader" || actorRole === "country_super_admin"
      ? normUp(admin.branch_country)
      : (body.branch_country !== undefined ? normUp(body.branch_country) : target.branch_country),
    branch_state:
      actorRole === "service_unit_leader"
        ? normUp(admin.branch_state)
        : body.branch_state !== undefined
          ? normUp(body.branch_state)
          : target.branch_state,
    satellite_site: norm(admin.role) === "service_unit_leader"
      ? norm(admin.satellite_site)
      : (body.satellite_site !== undefined ? norm(body.satellite_site) : target.satellite_site),
    is_active: body.is_active !== undefined ? Number(body.is_active) : target.is_active,
  };
  if (body.password) patch.password = String(body.password);
  const finalRole = norm(patch.role);
  const finalCountry = normUp(patch.branch_country);
  const finalState = normUp(patch.branch_state);
  assertAdminLocationFields(finalRole, finalCountry, finalState);
  if (finalRole === "country_super_admin") {
    await assertUniqueCountryAdmin(supabase, finalCountry, targetId);
  }
  if (finalRole === "state_super_admin") {
    await assertUniqueStateAdmin(supabase, finalCountry, finalState, targetId);
  }
  const { error } = await supabase.from("admins").update(patch).eq("id", targetId);
  if (error) throw new Error(error.message);
  await logActivity(supabase, admin, "admin.update", "admin", String(targetId), "Updated admin", ip);
  return { data: { id: targetId, ...patch } };
}

async function handleDeleteAdmin(supabase: SupabaseClient, params: Record<string, unknown>, admin: AdminRow, ip: string) {
  const role = norm(admin.role);
  if (!["super_admin", "general_admin", "service_unit_leader", "country_super_admin"].includes(role)) {
    throw new Error("Not allowed.");
  }
  if (Number(params.id) === Number(admin.id)) throw new Error("You cannot delete your own account.");
  const { data: target } = await supabase.from("admins").select("*").eq("id", params.id).maybeSingle();
  if (!target) throw new Error("Admin not found.");
  if (role === "service_unit_leader") {
    if (Number(target.service_unit_id) !== Number(admin.service_unit_id)) throw new Error("Not allowed.");
    if (norm(target.role) !== "sub_unit_leader") throw new Error("Service unit leaders may only delete sub-unit leader accounts.");
  }
  if (role === "country_super_admin") {
    await assertCountryAdminTarget(supabase, admin, target as Record<string, unknown>);
  }
  const { error } = await supabase.from("admins").delete().eq("id", params.id);
  if (error) throw new Error(error.message);
  await logActivity(supabase, admin, "admin.delete", "admin", String(params.id), "Deleted admin", ip);
  return { ok: true };
}

async function handleUpdateRegistrationBranch(
  supabase: SupabaseClient,
  params: Record<string, unknown>,
  admin: AdminRow,
  ip: string,
) {
  if (!["super_admin", "general_admin", "data_entry_admin", "country_super_admin", "state_super_admin"].includes(norm(admin.role))) {
    throw new Error("Not allowed.");
  }
  const body = (params.body || {}) as Record<string, unknown>;
  const cc = normUp(body.branch_country);
  const st = normUp(body.branch_state);
  assertStateBelongsToCountry(cc, st);
  const { data: row } = await supabase.from("registrations").select("*").eq("id", params.id).maybeSingle();
  if (!row) throw new Error("Registration not found.");
  if (!canAccessRegistration(admin, row as Record<string, unknown>)) throw new Error("Not allowed.");
  const { error } = await supabase.from("registrations").update({ branch_country: cc, branch_state: st }).eq(
    "id",
    params.id,
  );
  if (error) throw new Error(error.message);
  await logActivity(supabase, admin, "registration.branch", "registration", String(params.id), "Updated branch", ip);
  return { ok: true };
}

async function handleMembers(supabase: SupabaseClient, params: Record<string, unknown>, admin: AdminRow) {
  const page = Math.max(1, Number(params.page) || 1);
  const perPage = Math.max(1, Number(params.per_page) || 25);
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;
  let q = supabase.from("registrations").select("*", { count: "exact" }).eq("status", "accepted");
  q = applyRegistrationScopeQuery(q, admin);
  if (params.unit_id) q = q.eq("unit_id", Number(params.unit_id));
  if (params.sub_unit) q = q.eq("sub_unit", norm(params.sub_unit));
  if (norm(params.filter_branch_state)) q = q.eq("branch_state", normUp(params.filter_branch_state));
  if (params.search) {
    const r = norm(params.search).replace(/%/g, "").slice(0, 120);
    if (r) q = q.or(`first_name.ilike.%${r}%,surname.ilike.%${r}%,email.ilike.%${r}%,phone1.ilike.%${r}%`);
  }
  const { data, error, count } = await q.range(from, to);
  if (error) throw new Error(error.message);
  const total = typeof count === "number" ? count : (data || []).length;
  return { data: data || [], pagination: { page, per_page: perPage, total, pages: Math.max(1, Math.ceil(total / perPage)) } };
}

async function handleRequests(supabase: SupabaseClient, params: Record<string, unknown>, admin: AdminRow) {
  const page = Math.max(1, Number(params.page) || 1);
  const perPage = Math.max(1, Number(params.per_page) || 25);
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;
  let q = supabase.from("admin_requests").select("*", { count: "exact" }).order("created_at", { ascending: false });
  if (!["super_admin", "general_admin"].includes(norm(admin.role))) {
    q = q.eq("from_admin_id", admin.id);
  }
  if (params.status) q = q.eq("status", norm(params.status));
  const { data, error, count } = await q.range(from, to);
  if (error) throw new Error(error.message);
  const total = typeof count === "number" ? count : (data || []).length;
  return { data: data || [], pagination: { page, per_page: perPage, total, pages: Math.max(1, Math.ceil(total / perPage)) } };
}

async function handleCreateRequest(supabase: SupabaseClient, params: Record<string, unknown>, admin: AdminRow, ip: string) {
  const body = (params.body || {}) as Record<string, unknown>;
  const requestType = norm(body.request_type) || "general";
  const actorRole = norm(admin.role);

  if (requestType === "admin_account") {
    if (actorRole !== "country_super_admin") {
      throw new Error("Only Country Admins may submit new admin account requests.");
    }
    const validated = await validateAdminAccountProposal(supabase, admin, body.payload);
    const adminBody = validated.admin;
    const roleLabel = norm(adminBody.role).replace(/_/g, " ");
    const message = norm(body.message) ||
      `New ${roleLabel} account: ${adminBody.full_name} (${adminBody.username})`;
    const row = {
      from_admin_id: Number(admin.id),
      from_name: String(admin.full_name || ""),
      from_role: String(admin.role || ""),
      message,
      request_type: "admin_account",
      payload: validated,
      status: "in_review",
    };
    const { data, error } = await supabase.from("admin_requests").insert(row).select("*").single();
    if (error) throw new Error(error.message);
    await logActivity(
      supabase,
      admin,
      "request.create",
      "request",
      String(data.id),
      "Submitted admin account for approval",
      ip,
    );
    await notifyGlobalAdminsOfRequest(
      supabase,
      Number(data.id),
      "New admin account request",
      `${admin.full_name} requested a new ${roleLabel} account (${adminBody.full_name}).`,
    );
    return { data };
  }

  const row = {
    from_admin_id: Number(admin.id),
    from_name: String(admin.full_name || ""),
    from_role: String(admin.role || ""),
    message: norm(body.message),
    request_type: requestType,
    payload: (body.payload && typeof body.payload === "object" ? body.payload : {}) as Record<string, unknown>,
    status: "open",
  };
  if (!row.message) throw new Error("Message is required.");
  const { data, error } = await supabase.from("admin_requests").insert(row).select("*").single();
  if (error) throw new Error(error.message);
  await logActivity(supabase, admin, "request.create", "request", String(data.id), "Created request", ip);
  return { data };
}

async function handleUpdateRequest(supabase: SupabaseClient, params: Record<string, unknown>, admin: AdminRow, ip: string) {
  if (!["super_admin", "general_admin"].includes(norm(admin.role))) throw new Error("Not allowed.");
  const body = (params.body || {}) as Record<string, unknown>;
  const newStatus = norm(body.status);
  const { data: req } = await supabase.from("admin_requests").select("*").eq("id", params.id).maybeSingle();
  if (!req) throw new Error("Request not found.");
  const reqType = norm((req as { request_type?: string }).request_type);
  if (newStatus === "approved" && reqType === "location_catalog") {
    const payload = ((req as { payload?: unknown }).payload || {}) as Record<string, unknown>;
    await applyLocationCatalogProposal(supabase, payload, Number(req.id));
  }
  if (newStatus === "approved" && reqType === "admin_account") {
    if (norm((req as { status?: string }).status) !== "in_review") {
      throw new Error("Only requests in review can be approved.");
    }
    await applyAdminAccountRequest(supabase, req as Record<string, unknown>, admin, ip);
  }
  const { error } = await supabase.from("admin_requests").update({ status: newStatus }).eq("id", params.id);
  if (error) throw new Error(error.message);
  await logActivity(supabase, admin, "request.update", "request", String(params.id), "Updated request", ip);
  return { data: { id: params.id } };
}

/**
 * Publish an approved location_catalog payload: satellite_church_sites, directory_countries/states
 * (if missing), directory_branches + public.churches so the registration form lists branches immediately.
 */
async function applyLocationCatalogProposal(
  supabase: SupabaseClient,
  payload: Record<string, unknown>,
  requestId: number,
): Promise<void> {
  const iso = String(payload.countryIso2 || "").trim();
  const stateName = String(payload.stateName || "");
  const lga = String(payload.lgaName || "").trim();
  const countryDisplay = String(payload.countryName || "").trim();
  const sats = Array.isArray(payload.satelliteChurches) ? payload.satelliteChurches as string[] : [];

  const country = await ensureDirectoryCountry(supabase, (t) => nextIntPk(supabase, t), {
    iso2: iso,
    countryName: countryDisplay,
  });
  const bc = country.branch_country_code;
  const countryId = country.id;

  const state = await ensureDirectoryState(supabase, (t) => nextIntPk(supabase, t), countryId, bc, stateName);
  const st = state.branch_state_code;

  const addressBase = [lga, stateName, countryDisplay || bc].filter(Boolean).join(", ");

  for (const name of sats) {
    const site = String(name || "").trim();
    if (!site) continue;
    const address = addressBase ? `${site} — ${addressBase}` : site;
    await publishChurchToDirectory(supabase, (t) => nextIntPk(supabase, t), {
      branchCountry: bc,
      branchState: st,
      stateId: state.id,
      siteName: site,
      address,
      continent: String(payload.continent || ""),
      lga,
      sourceRequestId: requestId && requestId > 0 ? requestId : undefined,
    });
  }
}

async function handleApproveServiceUnitProposal(
  supabase: SupabaseClient,
  params: Record<string, unknown>,
  admin: AdminRow,
  ip: string,
) {
  if (!["super_admin", "general_admin"].includes(norm(admin.role))) throw new Error("Not allowed.");
  const { data: req } = await supabase.from("admin_requests").select("*").eq("id", params.id).maybeSingle();
  if (!req) throw new Error("Request not found.");
  const payload = (req.payload || {}) as Record<string, unknown>;
  const { data: maxRow } = await supabase.from("service_units").select("id").order("id", { ascending: false }).limit(1).maybeSingle();
  const nextId = Number(maxRow?.id || 0) + 1;
  const unitName = String(payload.unitName || "").trim();
  if (!unitName) throw new Error("Missing unit name in proposal.");
  await supabase.from("service_units").insert({
    id: nextId,
    name: unitName,
    description: String(payload.description || ""),
    coordinator: "",
    sort_order: 0,
    is_active: 1,
  });
  const subs = Array.isArray(payload.subUnitNames) ? payload.subUnitNames as string[] : [];
  let order = 0;
  for (const sn of subs) {
    const name = String(sn || "").trim();
    if (!name) continue;
    await supabase.from("sub_units").insert({ unit_id: nextId, name, sort_order: order++, is_active: 1 });
  }
  await supabase.from("admin_requests").update({ status: "resolved" }).eq("id", req.id);
  await logActivity(supabase, admin, "request.approve_unit", "request", String(req.id), "Approved service unit proposal", ip);
  return { ok: true };
}

async function handleSettings(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("app_settings").select("*").eq("id", 1).maybeSingle();
  if (error) throw new Error(error.message);
  return { data: data || { templates: {}, overdue_threshold_hours: 72, permissions: {} } };
}

async function handleUpdateSettings(supabase: SupabaseClient, params: Record<string, unknown>, admin: AdminRow, ip: string) {
  if (!["super_admin", "general_admin"].includes(norm(admin.role))) throw new Error("Not allowed.");
  const body = (params.body || {}) as Record<string, unknown>;
  const { data: cur } = await supabase.from("app_settings").select("*").eq("id", 1).maybeSingle();
  const next = {
    id: 1,
    templates: { ...(cur?.templates as object || {}), ...(body.templates as object || {}) },
    overdue_threshold_hours: Number(body.overdue_threshold_hours ?? cur?.overdue_threshold_hours ?? 72),
    permissions: { ...(cur?.permissions as object || {}), ...(body.permissions as object || {}) },
  };
  const { error } = await supabase.from("app_settings").upsert(next);
  if (error) throw new Error(error.message);
  await logActivity(supabase, admin, "settings.update", "settings", "1", "Updated settings", ip);
  return { data: next };
}

async function handleActivity(supabase: SupabaseClient, params: Record<string, unknown>, admin: AdminRow) {
  const page = Math.max(1, Number(params.page) || 1);
  const perPage = Math.max(1, Number(params.per_page) || 50);
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;
  const { data: logs, error, count } = await supabase.from("activity_logs").select("*", { count: "exact" }).order(
    "created_at",
    { ascending: false },
  ).range(from, to);
  if (error) throw new Error(error.message);
  let rows = logs || [];
  let total = typeof count === "number" ? count : rows.length;
  if (isCountrySuperAdmin(admin)) {
    const cc = normUp(admin.branch_country);
    const { data: countryAdmins } = await supabase.from("admins").select("id").eq("branch_country", cc);
    const adminIds = new Set((countryAdmins || []).map((a: { id: number }) => String(a.id)));
    const { data: countryRegs } = await supabase.from("registrations").select("id").eq("branch_country", cc);
    const regIds = new Set((countryRegs || []).map((r: { id: number }) => String(r.id)));
    const { data: logsAll, error: le } = await supabase.from("activity_logs").select("*").order("created_at", {
      ascending: false,
    }).limit(3000);
    if (le) throw new Error(le.message);
    const filtered = (logsAll || []).filter((r: Record<string, unknown>) => {
      if (r.admin_id != null && adminIds.has(String(r.admin_id))) return true;
      if (r.entity_type === "registration" && regIds.has(String(r.entity_id))) return true;
      if (r.entity_type === "admin" && adminIds.has(String(r.entity_id))) return true;
      return false;
    });
    total = filtered.length;
    rows = filtered.slice(from, to + 1);
  } else if (norm(admin.role) === "state_super_admin") {
    const cc = normUp(admin.branch_country);
    const st = normUp(admin.branch_state);
    const { data: stateAdmins } = await supabase.from("admins").select("id").eq("branch_country", cc).eq(
      "branch_state",
      st,
    );
    const adminIds = new Set((stateAdmins || []).map((a: { id: number }) => String(a.id)));
    const { data: stateRegs } = await supabase.from("registrations").select("id").eq("branch_country", cc).eq(
      "branch_state",
      st,
    );
    const regIds = new Set((stateRegs || []).map((r: { id: number }) => String(r.id)));
    const { data: logsAll, error: le } = await supabase.from("activity_logs").select("*").order("created_at", {
      ascending: false,
    }).limit(3000);
    if (le) throw new Error(le.message);
    const filtered = (logsAll || []).filter((r: Record<string, unknown>) => {
      if (r.admin_id != null && adminIds.has(String(r.admin_id))) return true;
      if (r.entity_type === "registration" && regIds.has(String(r.entity_id))) return true;
      if (r.entity_type === "admin" && adminIds.has(String(r.entity_id))) return true;
      return false;
    });
    total = filtered.length;
    rows = filtered.slice(from, to + 1);
  } else if (["service_unit_leader", "sub_unit_leader"].includes(norm(admin.role))) {
    const { data: regs } = await supabase.from("registrations").select("id,sub_unit").eq("unit_id", admin.service_unit_id);
    const allowed = new Set(
      (regs || [])
        .filter((r: Record<string, unknown>) =>
          norm(admin.role) !== "sub_unit_leader" ||
          norm(r.sub_unit).toLowerCase() === norm(admin.sub_unit_name).toLowerCase()
        )
        .map((r: Record<string, unknown>) => String(r.id)),
    );
    rows = rows.filter((r: Record<string, unknown>) => {
      if (r.entity_type !== "registration") return true;
      return allowed.has(String(r.entity_id));
    });
  }
  let adminsQuery = supabase.from("admins").select("id,full_name");
  if (isCountrySuperAdmin(admin)) {
    adminsQuery = adminsQuery.eq("branch_country", normUp(admin.branch_country));
  } else if (norm(admin.role) === "state_super_admin") {
    adminsQuery = adminsQuery.eq("branch_country", normUp(admin.branch_country)).eq(
      "branch_state",
      normUp(admin.branch_state),
    );
  }
  const { data: admins } = await adminsQuery;
  return {
    data: rows,
    pagination: { page, per_page: perPage, total, pages: Math.max(1, Math.ceil(total / perPage)) },
    admins: (admins || []).map((a: { id: number; full_name: string }) => ({ admin_id: a.id, admin_name: a.full_name })),
  };
}

async function handleSubUnitQueuesByUnit(supabase: SupabaseClient, admin: AdminRow) {
  const uid = Number(admin.service_unit_id);
  const { data: rows } = await supabase.from("registrations").select("*").eq("unit_id", uid);
  const grouped: Record<string, unknown[]> = {};
  for (const r of rows || []) {
    const rec = r as Record<string, unknown>;
    const key = String(rec.sub_unit || "No sub-unit");
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(rec);
  }
  return {
    data: Object.entries(grouped).map(([sub_unit, items]) => ({
      sub_unit,
      items: items.sort((a, b) =>
        String((b as Record<string, unknown>).submitted_at || "").localeCompare(
          String((a as Record<string, unknown>).submitted_at || ""),
        )
      ),
    })),
  };
}

async function handleOverdueAlerts(supabase: SupabaseClient, admin: AdminRow) {
  const { data: settings } = await supabase.from("app_settings").select("overdue_threshold_hours").eq("id", 1).maybeSingle();
  const th = Number(settings?.overdue_threshold_hours ?? 72);
  const now = Date.now();
  let q = supabase.from("registrations").select("*").in("status", ["new", "in_progress"]);
  q = applyRegistrationScopeQuery(q, admin);
  if (norm(admin.role) === "sub_unit_leader") q = q.eq("sub_unit", norm(admin.sub_unit_name));
  const { data: rows, error } = await q.limit(500);
  if (error) throw new Error(error.message);
  const out = (rows || []).filter((r: Record<string, unknown>) =>
    now - new Date(String(r.submitted_at || "")).getTime() >= th * 3600000
  );
  return { data: out };
}

async function handleNotifications(supabase: SupabaseClient, admin: AdminRow) {
  const { data, error } = await supabase.from("admin_notifications").select("*").eq("admin_id", admin.id).order(
    "created_at",
    { ascending: false },
  ).limit(100);
  if (error) throw new Error(error.message);
  return { data: data || [] };
}

async function handleMarkNotificationRead(supabase: SupabaseClient, params: Record<string, unknown>, admin: AdminRow) {
  const { error } = await supabase.from("admin_notifications").update({ read_at: new Date().toISOString() }).eq(
    "id",
    params.id,
  ).eq("admin_id", admin.id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

async function handleMarkAllNotificationsRead(supabase: SupabaseClient, admin: AdminRow) {
  const { error } = await supabase.from("admin_notifications").update({ read_at: new Date().toISOString() }).eq(
    "admin_id",
    admin.id,
  ).is("read_at", null);
  if (error) throw new Error(error.message);
  return { ok: true };
}

function announcementVisibleToAdmin(r: Record<string, unknown>, admin: AdminRow): boolean {
  if (Number(r.created_by_admin_id) === Number(admin.id)) return true;
  const role = norm(admin.role);
  if (["super_admin", "general_admin"].includes(role)) return true;
  const status = norm(r.workflow_status) || "sent";
  if (status !== "sent") return false;
  const uid = Number(r.scope_unit_id || 0);
  if (uid && Number(admin.service_unit_id) === uid) {
    const su = norm(r.scope_sub_unit);
    if (!su) return true;
    if (role === "sub_unit_leader") return su === norm(admin.sub_unit_name);
    return ["service_unit_leader", "data_entry_admin"].includes(role);
  }
  if (!norm(r.branch_country)) return false;
  if (norm(r.branch_country) !== normUp(admin.branch_country)) return false;
  const st = norm(r.scope_branch_state);
  if (st && st !== normUp(admin.branch_state)) return false;
  const sat = norm(r.scope_satellite_site);
  if (sat && sat !== norm(admin.satellite_site)) return false;
  return true;
}

async function handleAnnouncements(supabase: SupabaseClient, admin: AdminRow) {
  const { data, error } = await supabase.from("announcements").select("*").order("created_at", { ascending: false }).limit(
    500,
  );
  if (error) throw new Error(error.message);
  const rows = (data || []).filter((r) => announcementVisibleToAdmin(r as Record<string, unknown>, admin));
  return { data: rows };
}

function parseAnnouncementDestination(body: Record<string, unknown>) {
  const destinationType = norm(body.destination_type) || "admins";
  if (!["members", "leaders", "admins"].includes(destinationType)) {
    throw new Error("Invalid destination type.");
  }
  const cfg = (body.destination_config && typeof body.destination_config === "object")
    ? body.destination_config as Record<string, unknown>
    : {};
  return { destinationType, destinationConfig: cfg };
}

function announcementScopeFromPayload(
  admin: AdminRow,
  destinationType: string,
  destinationConfig: Record<string, unknown>,
  body: Record<string, unknown>,
): Record<string, unknown> {
  const role = norm(admin.role);
  const scope: Record<string, unknown> = {
    branch_country: "",
    scope_unit_id: null,
    scope_sub_unit: "",
    scope_branch_state: "",
    scope_satellite_site: "",
  };

  if (destinationType === "members") {
    const m = destinationConfig as Record<string, unknown>;
    scope.branch_country = normUp(m.branch_country ?? body.branch_country);
    scope.scope_branch_state = normUp(m.branch_state ?? "");
    scope.scope_satellite_site = norm(m.satellite_site ?? "");
    scope.scope_unit_id = m.service_unit_id ? Number(m.service_unit_id) : null;
    scope.scope_sub_unit = norm(m.sub_unit ?? "");
    return scope;
  }

  if (destinationType === "leaders") {
    const l = destinationConfig as Record<string, unknown>;
    const mode = norm(l.mode) || "all";
    scope.branch_country = normUp(l.branch_country ?? admin.branch_country);
    scope.scope_branch_state = normUp(l.branch_state ?? admin.branch_state);
    if (mode === "service_unit" || mode === "sub_unit") {
      scope.scope_unit_id = l.service_unit_id ? Number(l.service_unit_id) : Number(admin.service_unit_id) || null;
    }
    if (mode === "sub_unit") {
      scope.scope_sub_unit = norm(l.sub_unit ?? admin.sub_unit_name);
    }
    return scope;
  }

  if (destinationType === "admins") {
    const roles = Array.isArray((destinationConfig as { roles?: unknown }).roles)
      ? ((destinationConfig as { roles: unknown[] }).roles).map((r) => norm(r)).filter(Boolean)
      : [];
    (destinationConfig as { roles?: string[] }).roles = roles;
    scope.branch_country = normUp((destinationConfig as { branch_country?: string }).branch_country ?? "");
    scope.scope_branch_state = normUp((destinationConfig as { branch_state?: string }).branch_state ?? "");
    return scope;
  }

  return scope;
}

async function handleCreateAnnouncement(supabase: SupabaseClient, params: Record<string, unknown>, admin: AdminRow, ip: string) {
  const body = (params.body || {}) as Record<string, unknown>;
  const title = norm(body.title);
  const text = norm(body.body);
  if (!title || !text) throw new Error("Title and message are required.");

  const mediumEmail = body.medium_email === true || body.medium_email === 1 || body.medium_email === "1" ? 1 : 0;
  const mediumSms = body.medium_sms === true || body.medium_sms === 1 || body.medium_sms === "1" ? 1 : 0;
  if (!mediumEmail && !mediumSms) throw new Error("Select at least one medium: Email or SMS.");

  const action = norm(body.workflow_action) || "send";
  const { destinationType, destinationConfig } = parseAnnouncementDestination(body);
  const scopeFields = announcementScopeFromPayload(admin, destinationType, destinationConfig, body);

  const now = new Date().toISOString();
  let workflowStatus = "sent";
  let scheduledAt: string | null = null;
  let sentAt: string | null = now;

  if (action === "draft") {
    workflowStatus = "draft";
    sentAt = null;
  } else if (action === "schedule") {
    const raw = norm(body.scheduled_at);
    if (!raw) throw new Error("Scheduled date and time are required.");
    const when = new Date(raw);
    if (Number.isNaN(when.getTime())) throw new Error("Invalid schedule time.");
    if (when.getTime() <= Date.now()) throw new Error("Schedule time must be in the future.");
    workflowStatus = "scheduled";
    scheduledAt = when.toISOString();
    sentAt = null;
  }

  const row: Record<string, unknown> = {
    title,
    body: text,
    ...scopeFields,
    destination_type: destinationType,
    destination_config: destinationConfig,
    medium_email: mediumEmail,
    medium_sms: mediumSms,
    workflow_status: workflowStatus,
    scheduled_at: scheduledAt,
    sent_at: sentAt,
    archived_at: null,
    created_by_admin_id: Number(admin.id),
    created_by_name: String(admin.full_name || ""),
  };

  const { data, error } = await supabase.from("announcements").insert(row).select("*").single();
  if (error) throw new Error(error.message);
  await logActivity(supabase, admin, "announcement.create", "announcement", String(data.id), title, ip);
  return { data };
}

async function handleUpdateAnnouncement(supabase: SupabaseClient, params: Record<string, unknown>, admin: AdminRow, ip: string) {
  const id = Number(params.id);
  const body = (params.body || {}) as Record<string, unknown>;
  const { data: row } = await supabase.from("announcements").select("*").eq("id", id).maybeSingle();
  if (!row) throw new Error("Announcement not found.");
  if (!["super_admin", "general_admin"].includes(norm(admin.role)) && Number(row.created_by_admin_id) !== Number(admin.id)) {
    throw new Error("Not allowed.");
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const action = norm(body.action);

  if (action === "archive") {
    patch.workflow_status = "archived";
    patch.archived_at = new Date().toISOString();
  } else if (action === "send") {
    patch.workflow_status = "sent";
    patch.sent_at = new Date().toISOString();
    patch.scheduled_at = null;
  } else if (action === "schedule") {
    const raw = norm(body.scheduled_at);
    if (!raw) throw new Error("Scheduled date and time are required.");
    const when = new Date(raw);
    if (Number.isNaN(when.getTime())) throw new Error("Invalid schedule time.");
    patch.workflow_status = "scheduled";
    patch.scheduled_at = when.toISOString();
    patch.sent_at = null;
  } else if (action === "draft") {
    patch.workflow_status = "draft";
    patch.sent_at = null;
    patch.scheduled_at = null;
  }

  if (body.title !== undefined) patch.title = norm(body.title);
  if (body.body !== undefined) patch.body = norm(body.body);
  if (body.medium_email !== undefined) patch.medium_email = body.medium_email ? 1 : 0;
  if (body.medium_sms !== undefined) patch.medium_sms = body.medium_sms ? 1 : 0;

  const { error } = await supabase.from("announcements").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  await logActivity(supabase, admin, "announcement.update", "announcement", String(id), action || "update", ip);
  return { data: { id, ...patch } };
}

async function handleDeleteAnnouncement(supabase: SupabaseClient, params: Record<string, unknown>, admin: AdminRow, ip: string) {
  const { data: row } = await supabase.from("announcements").select("*").eq("id", params.id).maybeSingle();
  if (!row) throw new Error("Not found.");
  if (!["super_admin", "general_admin"].includes(norm(admin.role)) && Number(row.created_by_admin_id) !== Number(admin.id)) {
    throw new Error("Not allowed.");
  }
  const { error } = await supabase.from("announcements").delete().eq("id", params.id);
  if (error) throw new Error(error.message);
  await logActivity(supabase, admin, "announcement.delete", "announcement", String(params.id), "Deleted", ip);
  return { ok: true };
}

function requireCatalogEditor(admin: AdminRow) {
  const r = norm(admin.role);
  if (!["super_admin", "general_admin", "data_entry_admin"].includes(r)) {
    throw new Error("Only Super Admin, General Admin, or Data Entry Admin can edit the branch catalog.");
  }
}

async function nextIntPk(supabase: SupabaseClient, table: string): Promise<number> {
  const { data, error } = await supabase.from(table).select("id").order("id", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  return Number((data as { id?: number })?.id ?? 0) + 1;
}

function buildCatalogStats(regs: Array<Record<string, unknown>>) {
  const membersByCountry: Record<string, number> = {};
  const membersByState: Record<string, number> = {};
  const membersBySatellite: Record<string, number> = {};
  for (const r of regs) {
    if (norm(r.status) !== "accepted") continue;
    const cc = normUp(r.branch_country);
    const st = normUp(r.branch_state);
    const sat = norm(r.satellite_site);
    if (cc) membersByCountry[cc] = (membersByCountry[cc] || 0) + 1;
    if (cc && st) {
      const key = `${cc}:${st}`;
      membersByState[key] = (membersByState[key] || 0) + 1;
    }
    if (cc && st && sat) {
      const key = `${cc}:${st}:${sat}`;
      membersBySatellite[key] = (membersBySatellite[key] || 0) + 1;
    }
  }
  return { membersByCountry, membersByState, membersBySatellite };
}

async function handleCatalogList(supabase: SupabaseClient, admin: AdminRow) {
  requireCatalogEditor(admin);
  const { data: countries, error: e1 } = await supabase.from("directory_countries").select("*").order("name");
  if (e1) throw new Error(e1.message);
  const { data: states, error: e2 } = await supabase.from("directory_states").select("*").order("country_id").order("name");
  if (e2) throw new Error(e2.message);
  const { data: churches, error: e3 } = await supabase.from("churches").select(
    "id,name,address,branch_country,branch_state,directory_branch_id,is_active",
  ).order("branch_country").order("branch_state").order("name").limit(5000);
  if (e3) throw new Error(e3.message);
  let satellites: Record<string, unknown>[] = [];
  const satRes = await supabase.from("satellite_church_sites").select(
    "id,continent,branch_country,branch_state,lga,site_name,is_active,created_at",
  ).order("branch_country").order("branch_state").order("site_name").limit(5000);
  if (!satRes.error) satellites = (satRes.data || []) as Record<string, unknown>[];

  let adminRows: Record<string, unknown>[] = [];
  const adminRes = await supabase.from("admins").select(
    "id,full_name,email,role,branch_country,branch_state,satellite_site,is_active",
  ).in("role", [
    "country_super_admin",
    "state_super_admin",
    "satellite_church_admin",
    "service_unit_leader",
    "sub_unit_leader",
  ]).eq("is_active", 1);
  if (!adminRes.error) adminRows = (adminRes.data || []) as Record<string, unknown>[];

  let regs: Record<string, unknown>[] = [];
  const regRes = await supabase.from("registrations").select(
    "branch_country,branch_state,satellite_site,status",
  ).limit(15000);
  if (!regRes.error) regs = (regRes.data || []) as Record<string, unknown>[];

  return {
    countries: countries || [],
    states: states || [],
    churches: churches || [],
    satellites,
    admins: adminRows,
    stats: buildCatalogStats(regs),
  };
}

async function handleCatalogCreateLocation(
  supabase: SupabaseClient,
  params: Record<string, unknown>,
  admin: AdminRow,
  ip: string,
) {
  requireCatalogEditor(admin);
  const body = (params.body || params) as Record<string, unknown>;
  const continent = String(body.continent || "");
  const iso = String(body.countryIso2 || "").trim();
  const stateName = String(body.stateName || "");
  const lga = String(body.lgaName || "").trim();
  const countryDisplay = String(body.countryName || "").trim();
  const sats = Array.isArray(body.satelliteChurches)
    ? body.satelliteChurches as string[]
    : body.satelliteName
    ? [String(body.satelliteName)]
    : [];
  if (!iso || !stateName || !lga) throw new Error("Continent, country, state, and LGA are required.");
  const cleaned = sats.map((s) => String(s || "").trim()).filter(Boolean);
  if (!cleaned.length) throw new Error("Enter at least one satellite church name.");
  await applyLocationCatalogProposal(supabase, {
    continent,
    countryIso2: iso,
    countryName: countryDisplay,
    stateName,
    lgaName: lga,
    satelliteChurches: cleaned,
  }, 0);
  await logActivity(supabase, admin, "catalog.location", "directory", "0", `Created ${cleaned.length} location(s)`, ip);
  return { ok: true, count: cleaned.length };
}

async function handleCatalogAddCountry(supabase: SupabaseClient, params: Record<string, unknown>, admin: AdminRow, ip: string) {
  requireCatalogEditor(admin);
  const code = normUp(params.branch_country_code);
  const name = norm(params.name);
  if (!/^[A-Z]{2,8}$/.test(code)) throw new Error("Country code must be 2–8 letters A–Z.");
  if (!name) throw new Error("Country name is required.");
  const existing = await resolveExistingDirectoryCountry(supabase, { branchCountryCode: code, countryName: name });
  if (existing) {
    throw new Error(
      `Country already exists (${existing.branch_country_code}). Add states or churches under that country instead.`,
    );
  }
  const id = await nextIntPk(supabase, "directory_countries");
  const { error } = await supabase.from("directory_countries").insert({ id, name, branch_country_code: code });
  if (error) throw new Error(error.message);
  await logActivity(supabase, admin, "catalog.country", "directory_country", String(id), `Added country ${code}`, ip);
  return { data: { id, name, branch_country_code: code } };
}

async function handleCatalogAddState(supabase: SupabaseClient, params: Record<string, unknown>, admin: AdminRow, ip: string) {
  requireCatalogEditor(admin);
  const countryId = Number(params.country_id);
  const stateCode = normUp(params.branch_state_code);
  const stateName = norm(params.state_name) || stateCode;
  if (!Number.isFinite(countryId) || countryId < 1) throw new Error("Valid country is required.");
  if (!/^[A-Z0-9]{1,12}$/.test(stateCode)) throw new Error("State / region code must be 1–12 characters (A–Z, 0–9).");
  const { data: cc } = await supabase.from("directory_countries").select("id,branch_country_code").eq("id", countryId).maybeSingle();
  if (!cc) throw new Error("Country not found.");
  const { data: dup } = await supabase.from("directory_states").select("id").eq("country_id", countryId).eq(
    "branch_state_code",
    stateCode,
  ).maybeSingle();
  if (dup) throw new Error("That state code already exists for this country.");
  const bcStr = String((cc as { branch_country_code?: string }).branch_country_code || "");
  const fuzzy = await resolveExistingDirectoryState(supabase, countryId, normUp(bcStr), stateName);
  if (fuzzy && normUp(fuzzy.branch_state_code) !== normUp(stateCode)) {
    throw new Error(
      `A state already exists for this area (code ${fuzzy.branch_state_code}). Use that code instead of "${stateCode}" to avoid duplicates.`,
    );
  }
  const id = await nextIntPk(supabase, "directory_states");
  const { error } = await supabase.from("directory_states").insert({
    id,
    country_id: countryId,
    name: stateName,
    branch_state_code: stateCode,
  });
  if (error) throw new Error(error.message);
  await logActivity(supabase, admin, "catalog.state", "directory_state", String(id), `Added state ${stateCode}`, ip);
  return { data: { id, country_id: countryId, name: stateName, branch_state_code: stateCode } };
}

async function handleCatalogAddChurch(supabase: SupabaseClient, params: Record<string, unknown>, admin: AdminRow, ip: string) {
  requireCatalogEditor(admin);
  const countryCode = normUp(params.branch_country);
  const requestedStateCode = normUp(params.branch_state);
  const churchName = norm(params.name);
  const address = norm(params.address);
  const stateLabel = norm(params.state_display_name) || requestedStateCode;
  if (!countryCode || !requestedStateCode || !churchName) throw new Error("Country, state, and church name are required.");

  const country = await resolveExistingDirectoryCountry(supabase, { branchCountryCode: countryCode });
  if (!country) throw new Error("Unknown country code. Add the country first.");
  const state = await ensureDirectoryState(
    supabase,
    (t) => nextIntPk(supabase, t),
    country.id,
    country.branch_country_code,
    stateLabel || requestedStateCode,
  );

  await publishChurchToDirectory(supabase, (t) => nextIntPk(supabase, t), {
    branchCountry: country.branch_country_code,
    branchState: state.branch_state_code,
    stateId: state.id,
    siteName: churchName,
    address,
  });

  const { data: ch } = await supabase.from("churches").select("id").eq("branch_country", country.branch_country_code).eq(
    "branch_state",
    state.branch_state_code,
  ).eq("name", churchName).maybeSingle();
  await logActivity(supabase, admin, "catalog.church", "church", String(ch?.id ?? ""), `Added church ${churchName}`, ip);
  return { data: ch || { id: null } };
}

async function handleCatalogSetChurchActive(supabase: SupabaseClient, params: Record<string, unknown>, admin: AdminRow, ip: string) {
  requireCatalogEditor(admin);
  const id = params.id;
  const isActive = Number(params.is_active) === 1 ? 1 : 0;
  const { error } = await supabase.from("churches").update({ is_active: isActive }).eq("id", id);
  if (error) throw new Error(error.message);
  await logActivity(supabase, admin, "catalog.church_active", "church", String(id), `is_active=${isActive}`, ip);
  return { ok: true };
}

async function handleCatalogDeleteChurch(supabase: SupabaseClient, params: Record<string, unknown>, admin: AdminRow, ip: string) {
  requireCatalogEditor(admin);
  const id = params.id;
  const { data: row } = await supabase.from("churches").select("directory_branch_id").eq("id", id).maybeSingle();
  if (!row) throw new Error("Church not found.");
  const { error: e1 } = await supabase.from("churches").delete().eq("id", id);
  if (e1) throw new Error(e1.message);
  const bid = Number((row as { directory_branch_id?: number }).directory_branch_id);
  if (Number.isFinite(bid) && bid > 0) {
    await supabase.from("directory_branches").delete().eq("id", bid);
  }
  await logActivity(supabase, admin, "catalog.church_delete", "church", String(id), "Deleted church", ip);
  return { ok: true };
}
