import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { branchStatesForCountry, defaultHeadquartersStateForCountry } from "./branch_regions.ts";
import { assertStateBelongsToCountryCatalog } from "./catalog_geo.ts";
import {
  ensureDirectoryCountry,
  ensureDirectoryState,
  publishChurchToDirectory,
  resolveExistingDirectoryCountry,
  resolveExistingDirectoryState,
} from "./location_directory.ts";
import { applyRegistrationScopeQuery, canAccessRegistration } from "./registration_scope.ts";
import {
  clampCriticalDays,
  clampOverdueDays,
  clearOverdueEscalation,
  enrichRowOverdue,
  isOpenPipelineStatus,
  loadOverdueConfig,
  processOverdueEscalationsThrottled,
} from "./overdue.ts";
import { processRegistrationLeaderDigests } from "./registration_leader_notify.ts";
import { sendRegistrationStatusEmail } from "./registration_status_email.ts";
import { formatOrgSubject, sendEmail, wrapEmailHtml } from "./email_delivery.ts";
import { sendHtmlEmail } from "./resend_mail.ts";
import {
  geoFetchContinents,
  geoFetchCountriesForContinent,
  geoFetchLgasOrCities,
  geoFetchStatesForCountryName,
} from "./geo_catalog.ts";
import { ADMIN_LIST_COLUMNS, REGISTRATION_QUEUE_COLUMNS } from "./registration_columns.ts";
import {
  generateInviteToken,
  getAdminAppUrl,
  inviteExpiresAt,
  isPlatformAdminRole,
  randomInternalPassword,
  resolveAvailableUsername,
  getResendFromAddress,
  sendAdminInviteEmail,
  shapeAdminForClient,
  usesInviteOnCreate,
} from "./admin_invite.ts";
import {
  buildTotpUri,
  encryptTotpSecret,
  decryptTotpSecret,
  generateTotpSecretBase32,
  isRootSuperAdminRole,
  verifyTotpCode,
} from "./admin_totp.ts";
import {
  adminNotificationSender,
  insertAdminNotification,
  systemNotificationSender,
} from "./admin_notifications_helper.ts";

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

/** Must match admin-login verification (trim on both store and compare). */
function normalizeAdminPassword(raw: unknown): string {
  return String(raw ?? "").trim();
}

function stripAdminSecrets(row: Record<string, unknown>): Record<string, unknown> {
  const { password: _p, invite_token: _t, ...safe } = row;
  return safe;
}

function shapeAdminListRow(row: Record<string, unknown>): Record<string, unknown> {
  const pendingInvite = !!norm(row.invite_token) && Number(row.must_change_password ?? 0) === 1;
  return { ...stripAdminSecrets(row), pending_invite: pendingInvite };
}

function assertAdminPasswordFormat(password: string): void {
  if (!password) throw new Error("Password is required.");
  if (password.length < 8) {
    throw new Error("Password is required (minimum 8 characters).");
  }
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
  const { data, error } = await supabase.from("admins").select("id, email, is_active, must_change_password, invite_token, invite_expires_at").ilike("email", e);
  if (error) throw new Error(error.message);
  const taken = (data || []).find((r) => Number(r.id) !== Number(excludeId ?? 0));
  if (!taken) return;
  if (Number((taken as { is_active?: number }).is_active) !== 1) {
    throw new Error(
      "That email belongs to a deactivated admin. Delete that account from the admin dashboard, then send a new invite.",
    );
  }
  const pendingInvite = Number((taken as { must_change_password?: number }).must_change_password) === 1 &&
    !!norm((taken as { invite_token?: string }).invite_token);
  if (pendingInvite) {
    throw new Error(
      "That email already has a pending invitation. Resend the invite or delete the account before creating another.",
    );
  }
  throw new Error("That email is already used by another admin account.");
}

/** Permanently remove an admin row and related login/notification data. */
async function purgeAdminRecord(
  supabase: SupabaseClient,
  adminId: number,
  actor?: AdminRow | null,
  ip = "",
  logNote = "Deleted admin",
): Promise<void> {
  const id = Number(adminId);
  if (!Number.isFinite(id) || id < 1) throw new Error("Invalid admin id.");

  const { data: target, error: loadErr } = await supabase
    .from("admins")
    .select("id,full_name,email,role")
    .eq("id", id)
    .maybeSingle();
  if (loadErr) throw new Error(loadErr.message);
  if (!target) return;

  if (norm(target.role) === "super_admin") {
    throw new Error("Super Admin accounts cannot be deleted.");
  }

  await supabase.from("admin_login_otp_challenges").delete().eq("admin_id", id);
  await supabase.from("admin_notifications").delete().eq("admin_id", id);
  await supabase.from("registration_notify_queue").delete().eq("admin_id", id);
  await supabase.from("overdue_notify_dedup").delete().eq("admin_id", id);

  const { error: delErr } = await supabase.from("admins").delete().eq("id", id);
  if (delErr) throw new Error(`Could not delete admin from database: ${delErr.message}`);

  const { data: stillThere, error: verifyErr } = await supabase.from("admins").select("id").eq("id", id).maybeSingle();
  if (verifyErr) throw new Error(verifyErr.message);
  if (stillThere) {
    throw new Error("Admin could not be removed from the database. Try again or contact support.");
  }

  if (actor) {
    await logActivity(supabase, actor, "admin.delete", "admin", String(id), logNote, ip);
  }
}

/** Remove inactive or expired-invite rows so the same email can be invited again. */
async function reclaimAdminEmailForNewInvite(supabase: SupabaseClient, email: string): Promise<void> {
  const e = norm(email).toLowerCase();
  if (!e) return;
  const { data: rows, error } = await supabase
    .from("admins")
    .select("id,is_active,must_change_password,invite_token,invite_expires_at")
    .ilike("email", e);
  if (error) throw new Error(error.message);

  for (const row of rows || []) {
    const inactive = Number(row.is_active) !== 1;
    const pendingInvite = Number(row.must_change_password) === 1 && !!norm(row.invite_token);
    const inviteExpired = pendingInvite && row.invite_expires_at &&
      new Date(String(row.invite_expires_at)).getTime() < Date.now();
    if (inactive || inviteExpired) {
      await purgeAdminRecord(
        supabase,
        Number(row.id),
        null,
        "",
        inactive ? `Reclaimed deactivated admin email ${e}` : `Reclaimed expired invite for ${e}`,
      );
    }
  }
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

async function assertAdminLocationFields(
  supabase: SupabaseClient,
  role: string,
  branchCountry: string,
  branchState: string,
): Promise<void> {
  if (ROLES_REQUIRING_COUNTRY.has(role) && !branchCountry) {
    throw new Error("Country is required for this admin role.");
  }
  if (ROLES_REQUIRING_STATE.has(role) && !branchState) {
    throw new Error("State / region is required for this admin role.");
  }
  if (branchCountry && branchState) {
    await assertStateBelongsToCountryCatalog(supabase, branchCountry, branchState);
  }
}

/** Clear scope fields on the admin row that do not apply to the new role (does not delete branch data). */
function normalizeAdminScopeForRole(role: string, patch: Record<string, unknown>): void {
  const r = norm(role);
  if (!ROLES_REQUIRING_COUNTRY.has(r)) {
    patch.branch_country = null;
  }
  if (!ROLES_REQUIRING_STATE.has(r) && r !== "country_super_admin") {
    patch.branch_state = null;
  }
  if (
    r !== "satellite_church_admin" &&
    r !== "country_super_admin" &&
    r !== "state_super_admin" &&
    !["service_unit_leader", "sub_unit_leader"].includes(r)
  ) {
    patch.satellite_site = null;
  }
  if (!["service_unit_leader", "sub_unit_leader"].includes(r)) {
    patch.service_unit_id = null;
    patch.sub_unit_name = null;
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
    .eq("branch_country", cc).eq("is_active", 1);
  if (error) throw new Error(error.message);
  const taken = (data || []).find((r) => Number(r.id) !== Number(excludeId ?? 0));
  if (taken) {
    throw new Error(
      `This country already has an active Country Admin (${(taken as { full_name?: string }).full_name || "existing account"}). Choose another country or deactivate the existing account first.`,
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
    .eq("branch_country", cc).eq("branch_state", st).eq("is_active", 1);
  if (error) throw new Error(error.message);
  const taken = (data || []).find((r) => Number(r.id) !== Number(excludeId ?? 0));
  if (taken) {
    throw new Error(
      `This state already has an active State Branch Admin (${(taken as { full_name?: string }).full_name || "existing account"}). Choose another state or deactivate the existing account first.`,
    );
  }
  const { data: countryHome, error: countryErr } = await supabase.from("admins").select("id,full_name,is_active")
    .eq("role", "country_super_admin")
    .eq("branch_country", cc)
    .eq("branch_state", st)
    .eq("is_active", 1);
  if (countryErr) throw new Error(countryErr.message);
  const countryTaken = (countryHome || []).find((r) => Number(r.id) !== Number(excludeId ?? 0));
  if (countryTaken) {
    throw new Error(
      `This state is already covered by a Country Admin headquarters (${(countryTaken as { full_name?: string }).full_name || "existing account"}). Choose another state or change their headquarters first.`,
    );
  }
  if (await pendingStateAdminRequestExists(supabase, cc, st, excludeRequestId)) {
    throw new Error("A State Branch Admin request for this state is already awaiting Super Admin approval.");
  }
}

async function assertUniqueSatelliteAdmin(
  supabase: SupabaseClient,
  branchCountry: string,
  branchState: string,
  satelliteSite: string,
  excludeId?: number,
): Promise<void> {
  const cc = normUp(branchCountry);
  const st = normUp(branchState);
  const sat = norm(satelliteSite);
  if (!cc || !st || !sat) return;
  const { data, error } = await supabase.from("admins").select("id,full_name,is_active")
    .eq("role", "satellite_church_admin")
    .eq("branch_country", cc)
    .eq("branch_state", st)
    .eq("satellite_site", sat)
    .eq("is_active", 1);
  if (error) throw new Error(error.message);
  const taken = (data || []).find((r) => Number(r.id) !== Number(excludeId ?? 0));
  if (taken) {
    throw new Error(
      `This satellite already has an active Satellite Pastor Admin (${(taken as { full_name?: string }).full_name || "existing account"}). Choose another satellite or deactivate the existing account first.`,
    );
  }
}

function isStateLevelActor(admin: AdminRow, scopeMode: unknown): boolean {
  const role = norm(admin.role);
  if (role === "state_super_admin") return true;
  if (role === "country_super_admin" && norm(scopeMode) === "state" && countryAdminActsAsStateAdmin(admin)) {
    return true;
  }
  return false;
}

async function notifyGlobalAdminsOfRequest(
  supabase: SupabaseClient,
  requestId: number,
  title: string,
  body: string,
  sender?: { full_name?: unknown; role?: unknown; id?: unknown },
): Promise<void> {
  const { data: supers } = await supabase.from("admins").select("id,email").in("role", ["super_admin", "general_admin"]).eq(
    "is_active",
    1,
  );
  const senderMeta = sender
    ? adminNotificationSender(sender)
    : systemNotificationSender("Admin requests");
  for (const row of supers || []) {
    await insertAdminNotification(supabase, {
      admin_id: (row as { id: number }).id,
      type: "admin_request",
      title,
      body,
      entity_type: "request",
      entity_id: String(requestId),
      sender: senderMeta,
    });
    const email = norm((row as { email?: unknown }).email).toLowerCase();
    await trySendAdminEmail(
      email,
      title,
      `<p>${body}</p><p><strong>Request ID:</strong> ${requestId}</p>`,
    );
  }
}

async function trySendAdminEmail(
  to: string,
  subject: string,
  html: string,
  tags: string[] = ["admin"],
): Promise<void> {
  const email = norm(to).toLowerCase();
  if (!email) return;
  await sendHtmlEmail(email, subject, html, { tags, previewText: subject });
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
    password: normalizeAdminPassword(body.password),
    role: norm(body.role),
    service_unit_id: body.service_unit_id ? Number(body.service_unit_id) : null,
    sub_unit_name: norm(body.sub_unit_name),
    branch_country: normUp(countryAdmin.branch_country),
    branch_state: normUp(body.branch_state),
    satellite_site: norm(body.satellite_site),
  };
  assertCountryManagedRole(row.role);
  await assertAdminLocationFields(supabase, row.role, row.branch_country, row.branch_state);
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
  assertAdminPasswordFormat(row.password);
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
  const inviteCreate = usesInviteOnCreate(actor.role);
  const email = norm(body.email).toLowerCase();
  if (!email) throw new Error("Email is required.");

  let username = normalizeAdminUsername(body.username);
  if (inviteCreate) {
    username = await resolveAvailableUsername(supabase, email);
  }

  const password = inviteCreate
    ? randomInternalPassword()
    : normalizeAdminPassword(body.password);

  const row: Record<string, unknown> = {
    full_name: norm(body.full_name),
    username,
    email,
    password,
    role: norm(body.role),
    service_unit_id: body.service_unit_id ? Number(body.service_unit_id) : null,
    sub_unit_name: norm(body.sub_unit_name),
    branch_country: normUp(body.branch_country),
    branch_state: normUp(body.branch_state),
    satellite_site: norm(body.satellite_site),
    is_active: Number(body.is_active ?? 1),
    must_change_password: inviteCreate ? 1 : 0,
    invite_token: null,
    invite_expires_at: null,
  };

  if (!row.full_name) throw new Error("Full name is required.");
  if (!inviteCreate) {
    assertAdminPasswordFormat(String(row.password));
    assertAdminUsernameFormat(String(row.username));
  }
  if (row.role === "country_super_admin" && !row.branch_country) {
    throw new Error("Country is required for Country Admin accounts.");
  }
  if (row.role === "country_super_admin" && !row.branch_state) {
    row.branch_state = normUp(defaultHeadquartersStateForCountry(row.branch_country));
  }
  if (row.role === "country_super_admin" && !row.branch_state) {
    throw new Error("Headquarters state is required for Country Admin accounts.");
  }
  await assertAdminLocationFields(supabase, row.role, row.branch_country, row.branch_state);
  if (["service_unit_leader", "sub_unit_leader"].includes(String(row.role)) && !row.satellite_site) {
    throw new Error("Satellite church is required for workforce leaders.");
  }
  if (row.role === "satellite_church_admin" && !row.satellite_site) {
    throw new Error("Satellite church is required for Satellite Pastor Admin.");
  }
  if (row.role === "super_admin") {
    await assertUniqueSuperAdmin(supabase);
  }
  if (row.role === "general_admin") {
    await assertUniqueGeneralAdmin(supabase);
  }
  if (row.role === "country_super_admin") {
    await assertUniqueCountryAdmin(supabase, row.branch_country);
    await assertUniqueStateAdmin(supabase, row.branch_country, row.branch_state);
  }
  if (row.role === "state_super_admin") {
    await assertUniqueStateAdmin(supabase, row.branch_country, row.branch_state);
  }
  if (row.role === "sub_unit_leader" && row.service_unit_id) {
    await assertSubUnitInServiceUnit(supabase, Number(row.service_unit_id), row.sub_unit_name);
  }
  if (!inviteCreate) {
    await assertAdminUsernameAvailable(supabase, String(row.username));
  }
  await reclaimAdminEmailForNewInvite(supabase, email);
  await assertAdminEmailAvailable(supabase, email);

  if (inviteCreate) {
    const token = await generateInviteToken();
    row.invite_token = token;
    row.invite_expires_at = inviteExpiresAt(72);
  }

  const { data, error } = await supabase.from("admins").insert(row).select("*").single();
  if (error) throwAdminPersistError(error);

  let invite_email_sent = false;
  if (inviteCreate && data) {
    const appUrl = getAdminAppUrl();
    if (!appUrl) {
      throw new Error(
        "ADMIN_APP_URL is not configured on the server. Set it in Supabase Edge Function secrets (e.g. https://your-site.vercel.app/admin).",
      );
    }
    const inviteUrl = `${appUrl}/accept-invite?token=${encodeURIComponent(String(row.invite_token))}`;
    const inviteResult = await sendAdminInviteEmail(email, String(row.full_name), inviteUrl, String(row.role));
    invite_email_sent = inviteResult.ok;
    if (!invite_email_sent) {
      throw new Error(
        inviteResult.error ||
          "Account was created but the invite email could not be sent. Check Resend configuration, then use Resend invite.",
      );
    }
  }

  await logActivity(
    supabase,
    actor,
    "admin.create",
    "admin",
    String(data.id),
    inviteCreate ? `Created admin ${data.username} (invite email)` : `Created admin ${data.username}`,
    ip,
  );
  return {
    ...stripAdminSecrets(data as Record<string, unknown>),
    invite_email_sent,
    pending_invite: inviteCreate,
  };
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

function isStateSuperAdmin(admin: AdminRow): boolean {
  return norm(admin.role) === "state_super_admin";
}

function countryAdminHomeState(admin: AdminRow): string {
  if (!isCountrySuperAdmin(admin)) return "";
  return normUp(admin.branch_state);
}

function countryAdminActsAsStateAdmin(admin: AdminRow): boolean {
  return !!countryAdminHomeState(admin);
}

/** HQ state from the tied headquarters church row (when satellite_site is set). */
async function hqStateFromChurch(
  supabase: SupabaseClient,
  branchCountry: string,
  satelliteSite: string,
): Promise<string> {
  const cc = normUp(branchCountry);
  const name = norm(satelliteSite);
  if (!cc || !name) return "";
  const { data: ch } = await supabase
    .from("churches")
    .select("branch_state,is_active")
    .eq("branch_country", cc)
    .eq("name", name)
    .maybeSingle();
  if (!ch || Number((ch as { is_active?: number }).is_active ?? 1) !== 1) return "";
  return normUp((ch as { branch_state?: string }).branch_state);
}

async function persistCountryAdminHomeState(
  supabase: SupabaseClient,
  admin: AdminRow,
  homeState: string,
): Promise<AdminRow> {
  const cc = normUp(admin.branch_country);
  const st = normUp(homeState);
  if (!cc || !st) return admin;
  if (normUp(admin.branch_state) === st) return admin;
  await assertUniqueStateAdmin(supabase, cc, st, Number(admin.id));
  const { error } = await supabase.from("admins").update({ branch_state: st }).eq("id", admin.id);
  if (error) throw new Error(error.message);
  return { ...admin, branch_state: st };
}

/** Country Admin accounts always have a headquarters state (dual Country + State role). */
export async function ensureCountryAdminHeadquarters(
  supabase: SupabaseClient,
  admin: AdminRow,
): Promise<AdminRow> {
  if (norm(admin.role) !== "country_super_admin") return admin;
  const cc = normUp(admin.branch_country);
  if (!cc) return admin;

  const sat = norm(admin.satellite_site);
  if (sat) {
    const fromChurch = await hqStateFromChurch(supabase, cc, sat);
    if (fromChurch) {
      try {
        return await persistCountryAdminHomeState(supabase, admin, fromChurch);
      } catch {
        /* church state may conflict with another state admin — keep existing */
      }
    }
  }

  if (normUp(admin.branch_state)) return admin;

  const states = branchStatesForCountry(cc);
  for (const s of states) {
    try {
      return await persistCountryAdminHomeState(supabase, admin, s.code);
    } catch {
      /* try next state */
    }
  }

  const fallback = normUp(defaultHeadquartersStateForCountry(cc));
  if (!fallback) return admin;
  try {
    return await persistCountryAdminHomeState(supabase, admin, fallback);
  } catch {
    return admin;
  }
}

const COUNTRY_MANAGED_ADMIN_ROLES = [
  "state_super_admin",
  "satellite_church_admin",
  "service_unit_leader",
  "sub_unit_leader",
];

const STATE_MANAGED_ADMIN_ROLES = [
  "satellite_church_admin",
  "service_unit_leader",
  "sub_unit_leader",
];

const SATELLITE_MANAGED_ADMIN_ROLES = ["service_unit_leader", "sub_unit_leader"];

function assertCountryManagedRole(role: string): void {
  if (!COUNTRY_MANAGED_ADMIN_ROLES.includes(norm(role))) {
    throw new Error(
      "Country admins may only manage State Branch, Satellite Pastor, and workforce leader accounts in their country.",
    );
  }
}

function assertStateManagedRole(role: string): void {
  if (!STATE_MANAGED_ADMIN_ROLES.includes(norm(role))) {
    throw new Error("State Branch admins may only manage satellite pastor and workforce leader accounts.");
  }
}

function assertSatelliteManagedRole(role: string): void {
  if (!SATELLITE_MANAGED_ADMIN_ROLES.includes(norm(role))) {
    throw new Error("Satellite pastors may only manage service unit and sub-unit leader accounts.");
  }
}

async function assertSatelliteAdminTarget(
  admin: AdminRow,
  target: Record<string, unknown>,
): Promise<void> {
  const cc = normUp(admin.branch_country);
  const st = normUp(admin.branch_state);
  const sat = norm(admin.satellite_site);
  if (!cc || !st || !sat) throw new Error("Your church scope is not configured.");
  if (normUp(target.branch_country) !== cc || normUp(target.branch_state) !== st) {
    throw new Error("Not allowed outside your branch.");
  }
  if (norm(target.satellite_site) !== sat) {
    throw new Error("Not allowed outside your satellite church.");
  }
  assertSatelliteManagedRole(norm(target.role));
}

async function assertUniqueSuperAdmin(
  supabase: SupabaseClient,
  excludeId?: number,
): Promise<void> {
  const { data, error } = await supabase.from("admins").select("id,full_name").eq("role", "super_admin").eq("is_active", 1);
  if (error) throw new Error(error.message);
  const taken = (data || []).find((r) => Number(r.id) !== Number(excludeId ?? 0));
  if (taken) {
    throw new Error("Only one active Super Admin account is allowed in the system.");
  }
}

async function assertUniqueGeneralAdmin(
  supabase: SupabaseClient,
  excludeId?: number,
): Promise<void> {
  const { data, error } = await supabase.from("admins").select("id,full_name").eq("role", "general_admin").eq("is_active", 1);
  if (error) throw new Error(error.message);
  const taken = (data || []).find((r) => Number(r.id) !== Number(excludeId ?? 0));
  if (taken) {
    throw new Error("Only one active General Admin account is allowed in the system.");
  }
}

async function assertStateAdminTarget(
  admin: AdminRow,
  target: Record<string, unknown>,
): Promise<void> {
  const cc = normUp(admin.branch_country);
  const st = normUp(admin.branch_state);
  if (!cc || !st) throw new Error("Your state scope is not configured.");
  if (normUp(target.branch_country) !== cc || normUp(target.branch_state) !== st) {
    throw new Error("Not allowed outside your state.");
  }
  assertStateManagedRole(norm(target.role));
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

async function handleStartTotpEnrollment(supabase: SupabaseClient, admin: AdminRow, ip: string) {
  if (isRootSuperAdminRole(admin.role)) {
    throw new Error("Super Admin accounts do not use authenticator MFA.");
  }
  if (admin.totp_enabled === true || Number(admin.totp_enabled) === 1) {
    throw new Error("Authenticator is already enabled.");
  }
  const secret = generateTotpSecretBase32();
  const enc = await encryptTotpSecret(secret);
  const { error } = await supabase.from("admins").update({
    totp_secret_encrypted: enc,
    totp_enabled: false,
  }).eq("id", admin.id);
  if (error) throw new Error(error.message);
  await logActivity(
    supabase,
    admin,
    "admin.totp_enroll_started",
    "admin",
    String(admin.id),
    "Authenticator enrollment started",
    ip,
  );
  const email = String(admin.email || admin.username || "admin");
  return {
    otpauth_uri: buildTotpUri(secret, email),
    secret_base32: secret,
  };
}

async function handleConfirmTotpEnrollment(
  supabase: SupabaseClient,
  params: Record<string, unknown>,
  admin: AdminRow,
  ip: string,
) {
  if (isRootSuperAdminRole(admin.role)) {
    throw new Error("Super Admin accounts do not use authenticator MFA.");
  }
  const code = String(params.code || "").trim();
  if (!code) throw new Error("Enter the code from your authenticator app.");

  const { data: row, error } = await supabase
    .from("admins")
    .select("totp_secret_encrypted,totp_enabled,email")
    .eq("id", admin.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new Error("Account not found.");
  if (row.totp_enabled === true || Number(row.totp_enabled) === 1) {
    throw new Error("Authenticator is already enabled.");
  }
  const enc = String(row.totp_secret_encrypted || "").trim();
  if (!enc) throw new Error("Start enrollment before confirming.");

  const secret = await decryptTotpSecret(enc);
  if (!verifyTotpCode(secret, code)) {
    throw new Error("Incorrect code. Try again.");
  }

  const now = new Date().toISOString();
  const { error: updErr } = await supabase.from("admins").update({
    totp_enabled: true,
    totp_enrolled_at: now,
  }).eq("id", admin.id);
  if (updErr) throw new Error(updErr.message);

  await logActivity(
    supabase,
    admin,
    "admin.totp_enrolled",
    "admin",
    String(admin.id),
    "Authenticator MFA enabled",
    ip,
  );

  let service_unit_name = "";
  if (admin.service_unit_id != null) {
    const { data: u } = await supabase.from("service_units").select("name").eq("id", admin.service_unit_id)
      .maybeSingle();
    service_unit_name = String(u?.name || "");
  }
  const { data: fresh } = await supabase.from("admins").select("*").eq("id", admin.id).maybeSingle();
  return {
    ok: true,
    admin: shapeAdminForClient((fresh || admin) as Record<string, unknown>, service_unit_name),
  };
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
      const resolved = await ensureCountryAdminHeadquarters(supabase, admin);
      let service_unit_name = "";
      if (resolved.service_unit_id != null) {
        const { data: u } = await supabase.from("service_units").select("name").eq("id", resolved.service_unit_id).maybeSingle();
        service_unit_name = String(u?.name || "");
      }
      return {
        admin: shapeAdminForClient(resolved as Record<string, unknown>, service_unit_name),
      };
    }
    case "logout":
      await logActivity(supabase, admin, "admin.logout", "admin", String(admin.id || ""), "Admin logged out", ip);
      return { ok: true };
    case "queue":
      return handleQueue(supabase, params, admin);
    case "registration":
      return handleRegistration(supabase, params, admin);
    case "requestOpenCount":
      return handleRequestOpenCount(supabase, params, admin);
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
      return handleAdmins(supabase, params, admin);
    case "createAdmin":
      return handleCreateAdmin(supabase, params, admin, ip);
    case "resendAdminInvite":
      return handleResendAdminInvite(supabase, params, admin, ip);
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
      return handleOverdueAlerts(supabase, params, admin);
    case "notifications":
      return handleNotifications(supabase, params, admin);
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
    case "churchCatalog":
      return handleChurchCatalog(supabase, admin);
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
    case "geoCatalog":
      return handleGeoCatalog(params, admin);
    case "startTotpEnrollment":
      return handleStartTotpEnrollment(supabase, admin, ip);
    case "confirmTotpEnrollment":
      return handleConfirmTotpEnrollment(supabase, params, admin, ip);
    default:
      throw new Error(`Unsupported op: ${op}`);
  }
}

async function handleGeoCatalog(params: Record<string, unknown>, admin: AdminRow) {
  const role = norm(admin.role);
  if (!["super_admin", "general_admin", "data_entry_admin"].includes(role)) {
    throw new Error("Not allowed to load geography catalog.");
  }
  const step = norm(params.step);
  if (step === "continents") {
    return { data: await geoFetchContinents() };
  }
  if (step === "countries") {
    const continent = norm(params.continent);
    if (!continent) throw new Error("Continent is required.");
    return { data: await geoFetchCountriesForContinent(continent) };
  }
  if (step === "states") {
    const countryName = norm(params.countryName);
    if (!countryName) throw new Error("Country is required.");
    return { data: await geoFetchStatesForCountryName(countryName) };
  }
  if (step === "lgas") {
    const countryName = norm(params.countryName);
    const stateName = norm(params.stateName);
    if (!countryName || !stateName) throw new Error("Country and state are required.");
    return { data: await geoFetchLgasOrCities(countryName, stateName) };
  }
  throw new Error("Unknown geography step.");
}

async function handleQueue(supabase: SupabaseClient, params: Record<string, unknown>, admin: AdminRow) {
  const page = Math.max(1, Number(params.page) || 1);
  const perPage = Math.min(100, Math.max(1, Number(params.per_page) || 25));
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  let q = supabase.from("registrations").select(REGISTRATION_QUEUE_COLUMNS, { count: "exact" });
  q = applyRegistrationScopeQuery(q, admin, params.scope_mode);

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
  if (params.filter_country) q = q.eq("branch_country", normUp(params.filter_country));
  if (params.filter_state) q = q.eq("branch_state", normUp(params.filter_state));
  if (params.filter_branch) q = q.eq("satellite_site", norm(params.filter_branch));

  const sortKey = ["submitted_at", "surname", "unit_name", "status"].includes(norm(params.sort))
    ? norm(params.sort)
    : "submitted_at";
  const asc = normUp(params.dir) === "ASC";
  q = q.order(sortKey, { ascending: asc });

  const role = norm(admin.role);
  const leaderRoles = ["service_unit_leader", "sub_unit_leader", "satellite_church_admin"];
  if (leaderRoles.includes(role)) {
    try {
      await processOverdueEscalationsThrottled(supabase);
      await processRegistrationLeaderDigests(supabase);
    } catch {
      /* do not block queue */
    }
  }

  if (params.overdue_only || params.critical_only) {
    let oq = supabase.from("registrations").select(REGISTRATION_QUEUE_COLUMNS).in("status", ["new", "in_progress"]);
    oq = applyRegistrationScopeQuery(oq, admin, params.scope_mode);
    if (params.unit_id) oq = oq.eq("unit_id", Number(params.unit_id));
    if (params.sub_unit) oq = oq.eq("sub_unit", norm(params.sub_unit));
    if (params.sex) oq = oq.eq("sex", norm(params.sex));
    if (params.from) oq = oq.gte("submitted_at", `${norm(params.from)}T00:00:00.000Z`);
    if (params.to) oq = oq.lte("submitted_at", `${norm(params.to)}T23:59:59.999Z`);
    if (params.search) {
      const r = norm(params.search).replace(/%/g, "").slice(0, 120);
      if (r) oq = oq.or(`first_name.ilike.%${r}%,surname.ilike.%${r}%,email.ilike.%${r}%,phone1.ilike.%${r}%`);
    }
    if (norm(params.filter_branch_state)) oq = oq.eq("branch_state", normUp(params.filter_branch_state));
    if (params.filter_country) oq = oq.eq("branch_country", normUp(params.filter_country));
    if (params.filter_state) oq = oq.eq("branch_state", normUp(params.filter_state));
    if (params.filter_branch) oq = oq.eq("satellite_site", norm(params.filter_branch));
    const { data: rawOverdue, error: oErr } = await oq.limit(8000);
    if (oErr) throw new Error(oErr.message);
    const { globalDays, unitThresholds, criticalDays } = await loadOverdueConfig(supabase);
    const now = Date.now();
    let rows = (rawOverdue || [])
      .map((r: Record<string, unknown>) => enrichRowOverdue(r, globalDays, unitThresholds, criticalDays, now));
    if (params.critical_only) {
      rows = rows.filter((r) => r.is_critical);
    } else {
      rows = rows.filter((r) => r.is_overdue);
    }
    rows.sort((a, b) => Number(b.days_overdue) - Number(a.days_overdue));
    const total = rows.length;
    const slice = rows.slice(from, Math.min(rows.length, from + perPage));
    const pages = Math.max(1, Math.ceil(total / perPage));
    return { data: slice, pagination: { page, per_page: perPage, total, pages } };
  }

  const { data, error, count } = await q.range(from, to);
  if (error) throw new Error(error.message);
  let rows = (data || []) as Record<string, unknown>[];
  const { globalDays, unitThresholds, criticalDays } = await loadOverdueConfig(supabase);
  const now = Date.now();
  rows = rows.map((r) => enrichRowOverdue(r, globalDays, unitThresholds, criticalDays, now));
  const total = typeof count === "number" ? count : rows.length;
  const pages = Math.max(1, Math.ceil(total / perPage));
  return { data: rows, pagination: { page, per_page: perPage, total, pages } };
}

async function handleStats(supabase: SupabaseClient, params: Record<string, unknown>, admin: AdminRow) {
  let q = supabase.from("registrations").select(
    "id,status,sex,unit_name,submitted_at,branch_country,branch_state,satellite_site,unit_id",
  );
  q = applyRegistrationScopeQuery(q, admin, params.scope_mode);
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

  const { globalDays, unitThresholds, criticalDays } = await loadOverdueConfig(supabase);
  const now = Date.now();
  const enriched = rows.map((r) => enrichRowOverdue(r, globalDays, unitThresholds, criticalDays, now));
  const overdueOpen = enriched.filter((r) => r.is_overdue);
  const criticalOpen = overdueOpen.filter((r) => r.is_critical);

  const bySubOverdue: Record<string, number> = {};
  overdueOpen.forEach((r) => {
    const label = String(r.sub_unit || "No sub-unit").trim() || "No sub-unit";
    bySubOverdue[label] = (bySubOverdue[label] || 0) + 1;
  });
  const top_overdue_units = Object.entries(bySubOverdue)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const totals: Record<string, number> = {
    registrations: rows.length,
    pending: rows.filter((r) => normStatus(r.status) === "new").length,
    new_unreviewed: rows.filter((r) => normStatus(r.status) === "new").length,
    in_progress_count: rows.filter((r) => normStatus(r.status) === "in_progress").length,
    waitlisted: rows.filter((r) => normStatus(r.status) === "in_progress").length,
    approved: rows.filter((r) => normStatus(r.status) === "accepted").length,
    rejected: rows.filter((r) => normStatus(r.status) === "rejected").length,
    overdue_count: overdueOpen.length,
    critical_count: criticalOpen.length,
    overdue_critical: criticalOpen.length > 0 ? 1 : 0,
    overdue_threshold_days: globalDays,
    overdue_threshold_hours: globalDays * 24,
    critical_threshold_days: criticalDays,
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
    totals: { ...totals, status_distribution, top_overdue_units },
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
  if (!canAccessRegistration(admin, row as Record<string, unknown>, params.scope_mode)) {
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
  if (!isOpenPipelineStatus(nextStatus)) {
    await clearOverdueEscalation(supabase, String(id));
  }
  await logActivity(
    supabase,
    admin,
    "queue.update",
    "registration",
    String(id),
    `Status → ${patch.status}`,
    ip,
  );
  if (currentStatus !== nextStatus) {
    try {
      await sendRegistrationStatusEmail(supabase, row as Record<string, unknown>, nextStatus);
    } catch {
      /* best-effort */
    }
  }
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
  const unitPatch: Record<string, unknown> = {
    name: norm(body.name),
    description: norm(body.description),
    coordinator: norm(body.coordinator),
    sort_order: Number(body.sort_order ?? 0),
    is_active: Number(body.is_active ?? 1),
  };
  if (body.overdue_threshold_days !== undefined) {
    const raw = body.overdue_threshold_days;
    if (raw === null || raw === "" || raw === "null") {
      unitPatch.overdue_threshold_days = null;
    } else {
      unitPatch.overdue_threshold_days = clampOverdueDays(raw, 3);
    }
  }
  const { error } = await supabase.from("service_units").update(unitPatch).eq("id", params.id);
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

async function handleRegistration(supabase: SupabaseClient, params: Record<string, unknown>, admin: AdminRow) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) throw new Error("Registration id is required.");
  const { data: row, error } = await supabase.from("registrations").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new Error("Registration not found.");
  if (!canAccessRegistration(admin, row as Record<string, unknown>, params.scope_mode)) {
    throw new Error("Not allowed for this registration.");
  }
  return { data: row };
}

async function handleAdmins(supabase: SupabaseClient, params: Record<string, unknown>, admin: AdminRow) {
  const role = norm(admin.role);
  const scopeMode = norm(params.scope_mode);
  let q = supabase.from("admins").select(ADMIN_LIST_COLUMNS).order("id", { ascending: true });
  if (role === "service_unit_leader") {
    q = q.eq("service_unit_id", admin.service_unit_id).eq("role", "sub_unit_leader");
  } else if (role === "country_super_admin") {
    q = q.eq("branch_country", normUp(admin.branch_country));
    if (scopeMode === "state" && normUp(admin.branch_state)) {
      q = q.eq("branch_state", normUp(admin.branch_state));
    }
  } else if (role === "state_super_admin") {
    q = q.eq("branch_country", normUp(admin.branch_country)).eq("branch_state", normUp(admin.branch_state));
  } else if (role === "satellite_church_admin") {
    q = q.eq("branch_country", normUp(admin.branch_country))
      .eq("branch_state", normUp(admin.branch_state))
      .eq("satellite_site", norm(admin.satellite_site))
      .in("role", ["service_unit_leader", "sub_unit_leader"]);
  } else if (!["super_admin", "general_admin"].includes(role)) {
    q = q.eq("id", -1);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return { data: (data || []).map((row) => shapeAdminListRow(row as Record<string, unknown>)) };
}

async function handleCreateAdmin(supabase: SupabaseClient, params: Record<string, unknown>, admin: AdminRow, ip: string) {
  const body = (params.body || {}) as Record<string, unknown>;
  const actorRole = norm(admin.role);
  const row = {
    full_name: norm(body.full_name),
    username: normalizeAdminUsername(body.username),
    email: norm(body.email),
    password: normalizeAdminPassword(body.password),
    role: norm(body.role),
    service_unit_id: body.service_unit_id ? Number(body.service_unit_id) : null,
    sub_unit_name: norm(body.sub_unit_name),
    branch_country: normUp(body.branch_country),
    branch_state: normUp(body.branch_state),
    satellite_site: norm(body.satellite_site),
    is_active: Number(body.is_active ?? 1),
  };
  if (isStateLevelActor(admin, params.scope_mode)) {
    row.branch_country = normUp(admin.branch_country);
    row.branch_state = normUp(admin.branch_state);
    const stateCreatable = ["satellite_church_admin", "service_unit_leader", "sub_unit_leader"];
    if (!stateCreatable.includes(row.role)) {
      throw new Error(
        "State Branch admins may only create Satellite Pastor, Service Unit Leader, or Sub-Unit Leader accounts.",
      );
    }
    await assertAdminLocationFields(supabase, row.role, row.branch_country, row.branch_state);
    if (row.role === "satellite_church_admin") {
      if (!row.satellite_site) throw new Error("Satellite church is required for Satellite Pastor Admin.");
      await assertUniqueSatelliteAdmin(supabase, row.branch_country, row.branch_state, row.satellite_site);
    } else {
      if (!row.satellite_site) throw new Error("Satellite church is required for workforce leaders.");
      if (!row.service_unit_id) throw new Error("Service unit is required.");
      if (row.role === "sub_unit_leader") {
        if (!row.sub_unit_name) throw new Error("Sub-unit is required for Sub-Unit Leader.");
        await assertSubUnitInServiceUnit(supabase, Number(row.service_unit_id), row.sub_unit_name);
      }
    }
    if (!usesInviteOnCreate(actorRole)) {
      await assertAdminUsernameAvailable(supabase, row.username);
    }
    await assertAdminEmailAvailable(supabase, row.email);
    const data = await insertAdminFromBody(supabase, row, admin, ip);
    return { data: stripAdminSecrets(data) };
  }
  if (actorRole === "country_super_admin") {
    const cc = normUp(admin.branch_country);
    if (!cc) throw new Error("Your country scope is not configured.");
    row.branch_country = cc;
    const stateView = norm(params.scope_mode) === "state" && countryAdminActsAsStateAdmin(admin);
    const hqState = normUp(admin.branch_state);
    const countryCreatable = ["state_super_admin", "satellite_church_admin", "service_unit_leader", "sub_unit_leader"];
    if (!countryCreatable.includes(row.role)) {
      throw new Error(
        "Country admins may only create State Branch, Satellite Pastor, Service Unit Leader, or Sub-Unit Leader accounts within their country.",
      );
    }
    if (row.role === "state_super_admin") {
      if (!row.branch_state) throw new Error("State / region is required for State Branch Admin.");
      await assertStateBelongsToCountryCatalog(supabase, cc, normUp(row.branch_state));
      await assertAdminLocationFields(supabase, row.role, row.branch_country, row.branch_state);
      await assertUniqueStateAdmin(supabase, row.branch_country, row.branch_state);
    } else if (row.role === "satellite_church_admin") {
      if (stateView && hqState) row.branch_state = hqState;
      if (!row.branch_state) throw new Error("State / region is required for Satellite Pastor Admin.");
      await assertStateBelongsToCountryCatalog(supabase, cc, normUp(row.branch_state));
      if (stateView && hqState && normUp(row.branch_state) !== hqState) {
        throw new Error("In state view, satellite pastors must be in your headquarters state.");
      }
      if (!row.satellite_site) throw new Error("Satellite church is required for Satellite Pastor Admin.");
      await assertAdminLocationFields(supabase, row.role, row.branch_country, row.branch_state);
      await assertUniqueSatelliteAdmin(supabase, row.branch_country, row.branch_state, row.satellite_site);
    } else {
      if (stateView && hqState) row.branch_state = hqState;
      if (!row.branch_state) throw new Error("State / region is required for workforce leader accounts.");
      await assertStateBelongsToCountryCatalog(supabase, cc, normUp(row.branch_state));
      if (stateView && hqState && normUp(row.branch_state) !== hqState) {
        throw new Error("In state view, workforce leaders must be in your headquarters state.");
      }
      if (!row.satellite_site) throw new Error("Satellite church is required for workforce leaders.");
      if (!row.service_unit_id) throw new Error("Service unit is required.");
      if (row.role === "sub_unit_leader") {
        if (!row.sub_unit_name) throw new Error("Sub-unit is required for Sub-Unit Leader.");
        await assertSubUnitInServiceUnit(supabase, Number(row.service_unit_id), row.sub_unit_name);
      }
      await assertAdminLocationFields(supabase, row.role, row.branch_country, row.branch_state);
    }
    if (!usesInviteOnCreate(actorRole)) {
      await assertAdminUsernameAvailable(supabase, row.username);
    }
    await assertAdminEmailAvailable(supabase, row.email);
    const data = await insertAdminFromBody(supabase, row, admin, ip);
    return { data: stripAdminSecrets(data) };
  }
  if (actorRole === "satellite_church_admin") {
    row.branch_country = normUp(admin.branch_country);
    row.branch_state = normUp(admin.branch_state);
    row.satellite_site = norm(admin.satellite_site);
    if (!SATELLITE_MANAGED_ADMIN_ROLES.includes(row.role)) {
      throw new Error("Satellite pastors may only create Service Unit Leader or Sub-Unit Leader accounts.");
    }
    await assertAdminLocationFields(supabase, row.role, row.branch_country, row.branch_state);
    if (!row.service_unit_id) throw new Error("Service unit is required.");
    if (row.role === "sub_unit_leader") {
      if (!row.sub_unit_name) throw new Error("Sub-unit is required for Sub-Unit Leader.");
      await assertSubUnitInServiceUnit(supabase, Number(row.service_unit_id), row.sub_unit_name);
    }
    if (!usesInviteOnCreate(actorRole)) {
      await assertAdminUsernameAvailable(supabase, row.username);
    }
    await assertAdminEmailAvailable(supabase, row.email);
    const data = await insertAdminFromBody(supabase, row, admin, ip);
    return { data: stripAdminSecrets(data) };
  }
  if (!["super_admin", "general_admin", "service_unit_leader"].includes(actorRole)) {
    throw new Error(
      "Downline admins must submit new accounts as requests for upline approval.",
    );
  }
  if (actorRole === "service_unit_leader") {
    row.service_unit_id = Number(admin.service_unit_id);
    row.role = "sub_unit_leader";
    row.branch_country = normUp(admin.branch_country);
    row.branch_state = normUp(admin.branch_state);
    row.satellite_site = norm(admin.satellite_site);
    await assertSubUnitInServiceUnit(supabase, Number(admin.service_unit_id), row.sub_unit_name);
  }
  const data = await insertAdminFromBody(supabase, row, admin, ip);
  return { data: stripAdminSecrets(data) };
}

async function handleUpdateAdmin(supabase: SupabaseClient, params: Record<string, unknown>, admin: AdminRow, ip: string) {
  const body = (params.body || {}) as Record<string, unknown>;
  const targetId = Number(params.id);
  const { data: target } = await supabase.from("admins").select("*").eq("id", targetId).maybeSingle();
  if (!target) throw new Error("Admin not found.");
  const actorRole = norm(admin.role);
  if (!["super_admin", "general_admin", "service_unit_leader", "country_super_admin", "state_super_admin", "satellite_church_admin"].includes(actorRole)) {
    throw new Error("Not allowed.");
  }
  if (actorRole === "service_unit_leader") {
    if (Number(target.service_unit_id) !== Number(admin.service_unit_id)) throw new Error("Not allowed.");
    if (norm(target.role) !== "sub_unit_leader") throw new Error("Not allowed.");
  }
  if (actorRole === "satellite_church_admin") {
    await assertSatelliteAdminTarget(admin, target as Record<string, unknown>);
  }
  const isSelfUpdate = Number(targetId) === Number(admin.id);
  if (actorRole === "country_super_admin" && isSelfUpdate) {
    const homeState = body.branch_state !== undefined ? normUp(body.branch_state) : normUp(target.branch_state);
    if (body.role !== undefined && norm(body.role) !== "country_super_admin") {
      throw new Error("Country admins may only update their own headquarters state on this account.");
    }
    if (homeState) {
      await assertStateBelongsToCountryCatalog(supabase, normUp(admin.branch_country), homeState);
      await assertUniqueStateAdmin(supabase, normUp(admin.branch_country), homeState, targetId);
    }
    const selfPatch: Record<string, unknown> = {
      full_name: body.full_name ?? target.full_name,
      email: body.email ?? target.email,
      role: "country_super_admin",
      branch_country: normUp(admin.branch_country),
      branch_state: body.branch_state !== undefined ? (homeState || null) : target.branch_state,
      is_active: target.is_active,
    };
    if (body.password) {
      selfPatch.password = normalizeAdminPassword(body.password);
      assertAdminPasswordFormat(String(selfPatch.password));
    }
    const { error: selfErr } = await supabase.from("admins").update(selfPatch).eq("id", targetId);
    if (selfErr) throw new Error(selfErr.message);
    await logActivity(supabase, admin, "admin.update", "admin", String(targetId), "Updated country admin profile", ip);
    return { data: { id: targetId, ...selfPatch } };
  }
  const countryStateScope =
    actorRole === "country_super_admin" &&
    norm(params.scope_mode) === "state" &&
    countryAdminActsAsStateAdmin(admin);
  if (countryStateScope) {
    await assertStateAdminTarget(admin, target as Record<string, unknown>);
  } else if (actorRole === "country_super_admin") {
    await assertCountryAdminTarget(supabase, admin, target as Record<string, unknown>);
  }
  if (actorRole === "state_super_admin") {
    await assertStateAdminTarget(admin, target as Record<string, unknown>);
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
    : actorRole === "satellite_church_admin"
      ? norm(body.role ?? target.role)
      : countryStateScope || actorRole === "state_super_admin"
        ? norm(body.role ?? target.role)
        : actorRole === "country_super_admin"
        ? norm(body.role ?? target.role)
        : (body.role ?? target.role);
  if (countryStateScope) {
    assertStateManagedRole(nextRole);
  } else if (actorRole === "country_super_admin") {
    assertCountryManagedRole(nextRole);
    if (nextRole === "sub_unit_leader" && unitId) {
      await assertSubUnitInServiceUnit(supabase, Number(unitId), subName);
    }
  }
  if (actorRole === "state_super_admin") {
    assertStateManagedRole(nextRole);
    if (nextRole === "sub_unit_leader" && unitId) {
      await assertSubUnitInServiceUnit(supabase, Number(unitId), subName);
    }
  }
  if (actorRole === "satellite_church_admin") {
    assertSatelliteManagedRole(nextRole);
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
    branch_country: actorRole === "service_unit_leader" || actorRole === "country_super_admin" || actorRole === "state_super_admin" || actorRole === "satellite_church_admin" || countryStateScope
      ? normUp(admin.branch_country)
      : (body.branch_country !== undefined ? normUp(body.branch_country) : target.branch_country),
    branch_state:
      actorRole === "service_unit_leader" || actorRole === "state_super_admin" || actorRole === "satellite_church_admin" || countryStateScope
        ? normUp(admin.branch_state)
        : body.branch_state !== undefined
          ? normUp(body.branch_state)
          : target.branch_state,
    satellite_site: norm(admin.role) === "service_unit_leader" || actorRole === "satellite_church_admin"
      ? norm(admin.satellite_site)
      : actorRole === "state_super_admin" || countryStateScope
        ? (body.satellite_site !== undefined ? norm(body.satellite_site) : norm(target.satellite_site))
      : (body.satellite_site !== undefined ? norm(body.satellite_site) : target.satellite_site),
    is_active: body.is_active !== undefined ? Number(body.is_active) : target.is_active,
  };
  if (body.password) {
    patch.password = normalizeAdminPassword(body.password);
    assertAdminPasswordFormat(String(patch.password));
    patch.must_change_password = 0;
    patch.invite_token = null;
    patch.invite_expires_at = null;
  }
  const finalRole = norm(patch.role);
  const finalCountry = normUp(patch.branch_country);
  const finalState = normUp(patch.branch_state);
  await assertAdminLocationFields(supabase, finalRole, finalCountry, finalState);
  if (finalRole === "super_admin") {
    await assertUniqueSuperAdmin(supabase, targetId);
  }
  if (finalRole === "general_admin") {
    await assertUniqueGeneralAdmin(supabase, targetId);
  }
  if (finalRole === "country_super_admin") {
    await assertUniqueCountryAdmin(supabase, finalCountry, targetId);
  }
  if (finalRole === "state_super_admin") {
    await assertUniqueStateAdmin(supabase, finalCountry, finalState, targetId);
  }
  if (finalRole === "satellite_church_admin") {
    await assertUniqueSatelliteAdmin(
      supabase,
      finalCountry,
      finalState,
      norm(patch.satellite_site),
      targetId,
    );
  }
  const roleChanged = norm(target.role) !== finalRole;
  if (["super_admin", "general_admin"].includes(actorRole) && roleChanged) {
    normalizeAdminScopeForRole(finalRole, patch);
  }
  const { error } = await supabase.from("admins").update(patch).eq("id", targetId);
  if (error) throw new Error(error.message);
  const logMsg = roleChanged ? `Reassigned admin to ${finalRole}` : "Updated admin";
  await logActivity(supabase, admin, "admin.update", "admin", String(targetId), logMsg, ip);
  return { data: { id: targetId, ...patch } };
}

async function handleResendAdminInvite(
  supabase: SupabaseClient,
  params: Record<string, unknown>,
  admin: AdminRow,
  ip: string,
) {
  if (!isPlatformAdminRole(admin.role)) {
    throw new Error("Only Super Admin or General Admin can resend invitations.");
  }
  const targetId = Number(params.id);
  const { data: target } = await supabase.from("admins").select("*").eq("id", targetId).maybeSingle();
  if (!target) throw new Error("Admin not found.");
  if (isPlatformAdminRole(target.role)) {
    throw new Error("Platform admin accounts do not use email invitations.");
  }
  const email = norm(target.email).toLowerCase();
  if (!email) throw new Error("This account has no email address.");

  const token = await generateInviteToken();
  const { error: updErr } = await supabase
    .from("admins")
    .update({
      invite_token: token,
      invite_expires_at: inviteExpiresAt(72),
      must_change_password: 1,
    })
    .eq("id", targetId);
  if (updErr) throw new Error(updErr.message);

  const appUrl = getAdminAppUrl();
  if (!appUrl) {
    throw new Error("ADMIN_APP_URL is not configured on the server.");
  }
  const inviteUrl = `${appUrl}/accept-invite?token=${encodeURIComponent(token)}`;
  const inviteResult = await sendAdminInviteEmail(
    email,
    String(target.full_name),
    inviteUrl,
    String(target.role),
  );
  if (!inviteResult.ok) {
    throw new Error(
      inviteResult.error ||
        "Invitation was reset but email could not be sent. Check RESEND_API_KEY and RESEND_FROM_EMAIL in Supabase secrets.",
    );
  }

  await logActivity(supabase, admin, "admin.invite_resend", "admin", String(targetId), "Resent admin invite email", ip);
  return { ok: true, invite_email_sent: true };
}

async function handleDeleteAdmin(supabase: SupabaseClient, params: Record<string, unknown>, admin: AdminRow, ip: string) {
  const role = norm(admin.role);
  if (!["super_admin", "general_admin", "service_unit_leader", "country_super_admin", "state_super_admin", "satellite_church_admin"].includes(role)) {
    throw new Error("Not allowed.");
  }
  if (Number(params.id) === Number(admin.id)) throw new Error("You cannot delete your own account.");
  const { data: target } = await supabase.from("admins").select("*").eq("id", params.id).maybeSingle();
  if (!target) throw new Error("Admin not found.");
  if (role === "service_unit_leader") {
    if (Number(target.service_unit_id) !== Number(admin.service_unit_id)) throw new Error("Not allowed.");
    if (norm(target.role) !== "sub_unit_leader") throw new Error("Service unit leaders may only delete sub-unit leader accounts.");
  }
  const countryStateScope =
    role === "country_super_admin" &&
    norm(params.scope_mode) === "state" &&
    countryAdminActsAsStateAdmin(admin);
  if (countryStateScope) {
    await assertStateAdminTarget(admin, target as Record<string, unknown>);
  } else if (role === "country_super_admin") {
    await assertCountryAdminTarget(supabase, admin, target as Record<string, unknown>);
  }
  if (role === "state_super_admin") {
    await assertStateAdminTarget(admin, target as Record<string, unknown>);
  }
  if (role === "satellite_church_admin") {
    await assertSatelliteAdminTarget(admin, target as Record<string, unknown>);
  }
  if (norm(target.role) === "super_admin") {
    throw new Error("Super Admin accounts cannot be deleted.");
  }
  await purgeAdminRecord(
    supabase,
    Number(params.id),
    admin,
    ip,
    `Deleted admin ${target.full_name || target.email || params.id}`,
  );
  return { ok: true, deleted: true };
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
  await assertStateBelongsToCountryCatalog(supabase, cc, st);
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
  let q = supabase.from("registrations").select(REGISTRATION_QUEUE_COLUMNS, { count: "exact" }).eq("status", "accepted");
  q = applyRegistrationScopeQuery(q, admin, params.scope_mode);
  if (params.unit_id) q = q.eq("unit_id", Number(params.unit_id));
  if (params.sub_unit) q = q.eq("sub_unit", norm(params.sub_unit));
  if (norm(params.filter_branch_state)) q = q.eq("branch_state", normUp(params.filter_branch_state));
  if (params.filter_country) q = q.eq("branch_country", normUp(params.filter_country));
  if (params.filter_state) q = q.eq("branch_state", normUp(params.filter_state));
  if (params.filter_branch) q = q.eq("satellite_site", norm(params.filter_branch));
  if (params.search) {
    const r = norm(params.search).replace(/%/g, "").slice(0, 120);
    if (r) q = q.or(`first_name.ilike.%${r}%,surname.ilike.%${r}%,email.ilike.%${r}%,phone1.ilike.%${r}%`);
  }
  q = q.order("surname", { ascending: true }).order("first_name", { ascending: true });
  const { data, error, count } = await q.range(from, to);
  if (error) throw new Error(error.message);
  const total = typeof count === "number" ? count : (data || []).length;
  return { data: data || [], pagination: { page, per_page: perPage, total, pages: Math.max(1, Math.ceil(total / perPage)) } };
}

async function handleRequestOpenCount(supabase: SupabaseClient, params: Record<string, unknown>, admin: AdminRow) {
  const role = norm(admin.role);
  const isApprover =
    ["super_admin", "general_admin"].includes(role) ||
    (role === "country_super_admin" && !(
      norm(params.scope_mode) === "state" && countryAdminActsAsStateAdmin(admin)
    ));
  if (!isApprover) return { open: 0 };

  let q = supabase.from("admin_requests").select("id", { count: "exact", head: true }).in(
    "status",
    ["open", "in_review"],
  );
  if (role === "country_super_admin") {
    const { data: stateAdmins } = await supabase.from("admins").select("id")
      .eq("branch_country", normUp(admin.branch_country))
      .in("role", ["state_super_admin", "satellite_church_admin"]);
    const ids = [Number(admin.id), ...(stateAdmins || []).map((a) => Number(a.id))];
    q = q.in("from_admin_id", ids);
  }
  const { count, error } = await q;
  if (error) throw new Error(error.message);
  return { open: typeof count === "number" ? count : 0 };
}

async function handleRequests(supabase: SupabaseClient, params: Record<string, unknown>, admin: AdminRow) {
  const page = Math.max(1, Number(params.page) || 1);
  const perPage = Math.max(1, Number(params.per_page) || 25);
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;
  let q = supabase.from("admin_requests").select("*", { count: "exact" }).order("created_at", { ascending: false });
  const role = norm(admin.role);
  if (role === "country_super_admin") {
    if (norm(params.scope_mode) === "state" && countryAdminActsAsStateAdmin(admin)) {
      q = q.eq("from_admin_id", admin.id);
    } else {
    const { data: stateAdmins } = await supabase.from("admins").select("id")
      .eq("branch_country", normUp(admin.branch_country))
      .in("role", ["state_super_admin", "satellite_church_admin"]);
    const ids = [Number(admin.id), ...(stateAdmins || []).map((a) => Number(a.id))];
    q = q.in("from_admin_id", ids);
    }
  } else if (!["super_admin", "general_admin"].includes(role)) {
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
    const REQUESTABLE_ROLES = ["country_super_admin", "state_super_admin", "satellite_church_admin"];
    if (!REQUESTABLE_ROLES.includes(actorRole)) {
      throw new Error("Your role does not support submitting admin account requests. Use the create flow or contact your upline.");
    }
    if (actorRole === "state_super_admin") {
      const payload = (body.payload && typeof body.payload === "object" ? body.payload : {}) as Record<string, unknown>;
      const proposedAdmin = (payload.admin && typeof payload.admin === "object" ? payload.admin : {}) as Record<string, unknown>;
      assertStateManagedRole(norm(proposedAdmin.role));
    }
    if (actorRole === "country_super_admin") {
      if (norm(params.scope_mode) !== "state") {
        throw new Error("Switch to State Branch Admin view to request satellite pastor accounts.");
      }
      if (!countryAdminActsAsStateAdmin(admin)) {
        throw new Error("Set your headquarters state on the Users tab before requesting satellite pastor accounts.");
      }
      const payload = (body.payload && typeof body.payload === "object" ? body.payload : {}) as Record<string, unknown>;
      const proposedAdmin = (payload.admin && typeof payload.admin === "object" ? payload.admin : {}) as Record<string, unknown>;
      const proposedRole = norm(proposedAdmin.role);
      if (proposedRole !== "satellite_church_admin") {
        throw new Error("Country admins may only request Satellite Pastor Admin accounts for their headquarters state.");
      }
      if (normUp(proposedAdmin.branch_state) !== countryAdminHomeState(admin)) {
        throw new Error("Satellite pastor requests must be for your headquarters state.");
      }
    }
    if (actorRole === "satellite_church_admin") {
      const payload = (body.payload && typeof body.payload === "object" ? body.payload : {}) as Record<string, unknown>;
      const proposedAdmin = (payload.admin && typeof payload.admin === "object" ? payload.admin : {}) as Record<string, unknown>;
      const proposedRole = norm(proposedAdmin.role);
      if (!["service_unit_leader", "sub_unit_leader"].includes(proposedRole)) {
        throw new Error("Satellite Pastor Admins may only request workforce accounts (service unit or sub-unit leaders).");
      }
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
      admin,
    );
    return { data };
  }

  if (requestType === "location_catalog") {
    if (actorRole !== "data_entry_admin") {
      throw new Error("Only Data Entry Admins can propose new church locations.");
    }
    const payload = (body.payload && typeof body.payload === "object" ? body.payload : {}) as Record<string, unknown>;
    const continent = norm(payload.continent);
    const countryIso2 = normUp(payload.countryIso2);
    const countryName = norm(payload.countryName);
    const stateName = norm(payload.stateName);
    const lgaName = norm(payload.lgaName);
    const satelliteChurches = Array.isArray(payload.satelliteChurches)
      ? (payload.satelliteChurches as unknown[]).map((s) => String(s || "").trim()).filter(Boolean)
      : [];
    if (!continent || !countryIso2 || !countryName || !stateName || !lgaName) {
      throw new Error("Continent, country, state, and LGA are required.");
    }
    if (!satelliteChurches.length) {
      throw new Error("At least one satellite church name is required.");
    }
    const message = norm(body.message) ||
      `Location: ${lgaName}, ${stateName}, ${countryName} (${countryIso2}) — ${satelliteChurches.length} satellite church${
        satelliteChurches.length === 1 ? "" : "es"
      }`;
    const row = {
      from_admin_id: Number(admin.id),
      from_name: String(admin.full_name || ""),
      from_role: String(admin.role || ""),
      message,
      request_type: "location_catalog",
      payload: {
        continent,
        countryIso2,
        countryName,
        stateName,
        lgaName,
        satelliteChurches,
      },
      status: "open",
    };
    const { data, error } = await supabase.from("admin_requests").insert(row).select("*").single();
    if (error) throw new Error(error.message);
    await logActivity(
      supabase,
      admin,
      "request.create",
      "request",
      String(data.id),
      "Submitted location catalog proposal",
      ip,
    );
    await notifyGlobalAdminsOfRequest(
      supabase,
      Number(data.id),
      "New location proposal",
      `${admin.full_name} proposed churches in ${lgaName}, ${stateName}, ${countryName}.`,
      admin,
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
  await notifyGlobalAdminsOfRequest(
    supabase,
    Number(data.id),
    "New request submitted",
    `${admin.full_name} submitted a ${requestType.replace(/_/g, " ")} request.`,
    admin,
  );
  return { data };
}

async function handleUpdateRequest(supabase: SupabaseClient, params: Record<string, unknown>, admin: AdminRow, ip: string) {
  const approverRole = norm(admin.role);
  const ALLOWED_APPROVERS = ["super_admin", "general_admin", "country_super_admin"];
  if (!ALLOWED_APPROVERS.includes(approverRole)) throw new Error("Not allowed.");
  const body = (params.body || {}) as Record<string, unknown>;
  const newStatus = norm(body.status);
  if (!["approved", "rejected", "resolved", "in_review", "open"].includes(newStatus)) {
    throw new Error("Invalid request status.");
  }
  const { data: req } = await supabase.from("admin_requests").select("*").eq("id", params.id).maybeSingle();
  if (!req) throw new Error("Request not found.");
  if (approverRole === "country_super_admin") {
    const fromAdminId = Number((req as { from_admin_id?: unknown }).from_admin_id);
    const { data: fromAdmin } = await supabase.from("admins").select("role,branch_country").eq("id", fromAdminId).maybeSingle();
    if (!fromAdmin) throw new Error("Requesting admin not found.");
    const fromRole = norm((fromAdmin as { role?: string }).role);
    const fromCountry = normUp((fromAdmin as { branch_country?: string }).branch_country);
    const myCountry = normUp(admin.branch_country);
    if (fromCountry !== myCountry) throw new Error("Cannot approve requests outside your country.");
    if (!["state_super_admin", "satellite_church_admin"].includes(fromRole)) {
      throw new Error("Country admins can only approve requests from State Branch Admins and Satellite Pastor Admins within their country.");
    }
  }
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
  const fromAdminId = Number((req as { from_admin_id?: unknown }).from_admin_id || 0);
  if (fromAdminId > 0) {
    const title = "Request status updated";
    const bodyText = `Your ${reqType.replace(/_/g, " ")} request is now "${newStatus}".`;
    await insertAdminNotification(supabase, {
      admin_id: fromAdminId,
      type: "request_update",
      title,
      body: bodyText,
      entity_type: "request",
      entity_id: String(params.id),
      sender: adminNotificationSender(admin),
    });
    const { data: fromAdmin } = await supabase.from("admins").select("email").eq("id", fromAdminId).maybeSingle();
    const requesterEmail = norm((fromAdmin as { email?: unknown })?.email).toLowerCase();
    await trySendAdminEmail(
      requesterEmail,
      title,
      `<p>${bodyText}</p><p><strong>Request ID:</strong> ${String(params.id)}</p>`,
    );
  }
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
  if (!["super_admin", "general_admin", "country_super_admin"].includes(norm(admin.role))) throw new Error("Not allowed.");
  const { data: req } = await supabase.from("admin_requests").select("*").eq("id", params.id).maybeSingle();
  if (!req) throw new Error("Request not found.");
  if (norm(admin.role) === "country_super_admin") {
    const fromAdminId = Number((req as { from_admin_id?: unknown }).from_admin_id);
    const { data: fromAdmin } = await supabase.from("admins").select("role,branch_country").eq("id", fromAdminId).maybeSingle();
    if (normUp((fromAdmin as { branch_country?: string })?.branch_country) !== normUp(admin.branch_country)) {
      throw new Error("Cannot approve requests outside your country.");
    }
    const fromRole = norm((fromAdmin as { role?: string })?.role);
    if (!["state_super_admin", "satellite_church_admin"].includes(fromRole)) {
      throw new Error("Country admins can only approve requests from State Branch Admins and Satellite Pastor Admins within their country.");
    }
  }
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
  const requesterId = Number((req as { from_admin_id?: unknown }).from_admin_id || 0);
  if (requesterId > 0) {
    const title = "Request approved";
    const bodyText = `Your service unit proposal "${unitName}" was approved and has been created.`;
    await insertAdminNotification(supabase, {
      admin_id: requesterId,
      type: "request_update",
      title,
      body: bodyText,
      entity_type: "request",
      entity_id: String(req.id),
      sender: adminNotificationSender(admin),
    });
    const { data: requester } = await supabase.from("admins").select("email").eq("id", requesterId).maybeSingle();
    const requesterEmail = norm((requester as { email?: unknown })?.email).toLowerCase();
    await trySendAdminEmail(
      requesterEmail,
      title,
      `<p>${bodyText}</p><p><strong>Request ID:</strong> ${String(req.id)}</p>`,
    );
  }
  await logActivity(supabase, admin, "request.approve_unit", "request", String(req.id), "Approved service unit proposal", ip);
  return { ok: true };
}

async function handleSettings(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("app_settings").select("*").eq("id", 1).maybeSingle();
  if (error) throw new Error(error.message);
  const row = data || { templates: {}, overdue_threshold_hours: 72, overdue_threshold_days: 3, critical_threshold_days: 30, permissions: {} };
  const days = clampOverdueDays(
    row.overdue_threshold_days ?? Math.ceil(Number(row.overdue_threshold_hours ?? 72) / 24),
    3,
  );
  const criticalDays = clampCriticalDays(row.critical_threshold_days, 30);
  return {
    data: {
      ...row,
      overdue_threshold_days: days,
      overdue_threshold_hours: days * 24,
      critical_threshold_days: criticalDays,
    },
  };
}

async function handleUpdateSettings(supabase: SupabaseClient, params: Record<string, unknown>, admin: AdminRow, ip: string) {
  if (!["super_admin", "general_admin"].includes(norm(admin.role))) throw new Error("Not allowed.");
  const body = (params.body || {}) as Record<string, unknown>;
  const { data: cur } = await supabase.from("app_settings").select("*").eq("id", 1).maybeSingle();
  const days = clampOverdueDays(
    body.overdue_threshold_days ?? body.overdue_threshold_hours != null
      ? Math.ceil(Number(body.overdue_threshold_hours) / 24)
      : cur?.overdue_threshold_days ?? 3,
    3,
  );
  const criticalDays = clampCriticalDays(
    body.critical_threshold_days ?? cur?.critical_threshold_days ?? 30,
    30,
  );
  const next = {
    id: 1,
    templates: { ...(cur?.templates as object || {}), ...(body.templates as object || {}) },
    overdue_threshold_days: days,
    overdue_threshold_hours: days * 24,
    critical_threshold_days: criticalDays,
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

async function handleOverdueAlerts(supabase: SupabaseClient, params: Record<string, unknown>, admin: AdminRow) {
  return handleQueue(supabase, { overdue_only: true, page: 1, per_page: 500, scope_mode: params.scope_mode }, admin);
}

async function handleNotifications(supabase: SupabaseClient, params: Record<string, unknown>, admin: AdminRow) {
  const adminId = admin.id;
  const perPage = Math.min(200, Math.max(1, Number(params.per_page) || 50));
  const [{ data, error }, { count: unreadCount, error: unreadErr }] = await Promise.all([
    supabase
      .from("admin_notifications")
      .select("id,type,title,body,entity_type,entity_id,metadata,read_at,created_at")
      .eq("admin_id", adminId)
      .order("created_at", { ascending: false })
      .limit(perPage),
    supabase
      .from("admin_notifications")
      .select("id", { count: "exact", head: true })
      .eq("admin_id", adminId)
      .is("read_at", null),
  ]);
  if (error) throw new Error(error.message);
  if (unreadErr) throw new Error(unreadErr.message);
  return { data: data || [], unread_count: typeof unreadCount === "number" ? unreadCount : 0 };
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
  if (error) {
    const msg = String(error.message || "");
    const code = String((error as { code?: string }).code || "");
    if (code === "42P01" || /relation .* does not exist/i.test(msg)) {
      return { data: [] };
    }
    throw new Error(msg);
  }
  const rows = (data || []).filter((r) => announcementVisibleToAdmin(r as Record<string, unknown>, admin));
  return { data: rows };
}

function parseAnnouncementDestination(body: Record<string, unknown>) {
  const destinationType = norm(body.destination_type) || "admins";
  if (!["members", "leaders", "admins", "send_all"].includes(destinationType)) {
    throw new Error("Invalid destination type.");
  }
  const cfg = (body.destination_config && typeof body.destination_config === "object")
    ? body.destination_config as Record<string, unknown>
    : {};
  return { destinationType, destinationConfig: cfg };
}

const SEND_ALL_AUDIENCE_KEYS = new Set([
  "members",
  "service_unit_leaders",
  "sub_unit_leaders",
  "satellite_pastors",
  "state_branch_pastors",
]);

function allowedSendAllAudiencesForRole(role: string, scopeMode?: unknown): Set<string> {
  const r = norm(role);
  if (r === "satellite_church_admin") {
    return new Set(["members", "service_unit_leaders", "sub_unit_leaders"]);
  }
  if (r === "state_super_admin") {
    return new Set(["members", "service_unit_leaders", "sub_unit_leaders", "satellite_pastors"]);
  }
  if (r === "country_super_admin") {
    if (norm(scopeMode) === "state") {
      return new Set(["members", "service_unit_leaders", "sub_unit_leaders", "satellite_pastors"]);
    }
    return new Set(SEND_ALL_AUDIENCE_KEYS);
  }
  if (["super_admin", "general_admin", "data_entry_admin"].includes(r)) {
    return new Set(SEND_ALL_AUDIENCE_KEYS);
  }
  return new Set();
}

function validateSendAllDestination(
  admin: AdminRow,
  cfg: Record<string, unknown>,
  scopeMode?: unknown,
): void {
  const raw = Array.isArray((cfg as { audiences?: unknown }).audiences)
    ? ((cfg as { audiences: unknown[] }).audiences).map((a) => norm(a)).filter(Boolean)
    : [];
  if (!raw.length) throw new Error("Select at least one audience under Send all.");
  const allowed = allowedSendAllAudiencesForRole(norm(admin.role), scopeMode);
  const filtered = raw.filter((a) => allowed.has(a));
  if (!filtered.length) throw new Error("No valid audiences selected for your role.");
  (cfg as { audiences: string[] }).audiences = filtered;
}

const ANNOUNCEMENT_ADMIN_ROLES_BY_SENDER: Record<string, string[]> = {
  country_super_admin: ["state_super_admin", "satellite_church_admin"],
  state_super_admin: ["satellite_church_admin"],
  satellite_church_admin: ["satellite_church_admin", "service_unit_leader", "sub_unit_leader"],
  service_unit_leader: ["service_unit_leader", "sub_unit_leader"],
  sub_unit_leader: ["sub_unit_leader"],
};

function clampAnnouncementAdminRoles(admin: AdminRow, cfg: Record<string, unknown>): void {
  const allowed = ANNOUNCEMENT_ADMIN_ROLES_BY_SENDER[norm(admin.role)];
  if (!allowed?.length) return;
  const raw = (cfg as { roles?: unknown }).roles;
  if (!Array.isArray(raw)) return;
  const filtered = raw.map((r) => norm(r)).filter((r) => allowed.includes(r));
  (cfg as { roles: string[] }).roles = filtered.length ? filtered : [...allowed];
}

/**
 * Server-side enforcement: force geo/unit fields in destination_config
 * to the admin's own scope when the admin is below global level.
 */
function clampAnnouncementScope(
  admin: AdminRow,
  cfg: Record<string, unknown>,
  scopeMode?: unknown,
): void {
  const role = norm(admin.role);
  if (["super_admin", "general_admin", "data_entry_admin"].includes(role)) return;

  if (role === "country_super_admin") {
    const cc = normUp(admin.branch_country);
    if (!cc) throw new Error("Your country scope is not configured.");
    const requested = normUp(cfg.branch_country);
    if (requested && requested !== cc) {
      throw new Error("Country admins may only send announcements within their assigned country.");
    }
    cfg.branch_country = cc;
    if (norm(scopeMode) === "state" && normUp(admin.branch_state)) {
      const st = normUp(admin.branch_state);
      const reqSt = normUp(cfg.branch_state);
      if (reqSt && reqSt !== st) {
        throw new Error("In state view, announcements are limited to your headquarters state.");
      }
      cfg.branch_state = st;
    } else if (cfg.branch_state) {
      cfg.branch_state = normUp(cfg.branch_state);
    }
    clampAnnouncementAdminRoles(admin, cfg);
    return;
  }

  if (role === "state_super_admin") {
    const cc = normUp(admin.branch_country);
    const st = normUp(admin.branch_state);
    if (!cc || !st) throw new Error("Your state scope is not configured.");
    if (normUp(cfg.branch_country) && normUp(cfg.branch_country) !== cc) {
      throw new Error("State branch admins may only send announcements within their assigned country.");
    }
    if (normUp(cfg.branch_state) && normUp(cfg.branch_state) !== st) {
      throw new Error("State branch admins may only send announcements within their assigned state.");
    }
    cfg.branch_country = cc;
    cfg.branch_state = st;
    clampAnnouncementAdminRoles(admin, cfg);
    return;
  }

  if (admin.branch_country) cfg.branch_country = normUp(admin.branch_country);
  if (admin.branch_state) cfg.branch_state = normUp(admin.branch_state);

  if (role === "satellite_church_admin") {
    if (!admin.satellite_site) throw new Error("Your satellite scope is not configured.");
    const site = norm(admin.satellite_site);
    const req = norm(cfg.satellite_site);
    if (req && req !== site) {
      throw new Error("Satellite admins may only send announcements within their assigned satellite.");
    }
    cfg.satellite_site = site;
    const mode = norm((cfg as { mode?: string }).mode);
    if (mode && !["service_unit", "sub_unit"].includes(mode)) {
      throw new Error("Service unit head announcements must target service unit leaders or sub-unit leaders.");
    }
    if (mode === "all" || !mode) {
      (cfg as { mode?: string }).mode = "service_unit";
    }
    return;
  }

  if (role === "service_unit_leader") {
    const cc = normUp(admin.branch_country);
    const st = normUp(admin.branch_state);
    if (cc) cfg.branch_country = cc;
    if (st) cfg.branch_state = st;
    if (admin.satellite_site) cfg.satellite_site = norm(admin.satellite_site);
    if (admin.service_unit_id) cfg.service_unit_id = Number(admin.service_unit_id);
    const mode = norm((cfg as { mode?: string }).mode);
    if (mode === "service_unit" || mode === "") {
      (cfg as { mode?: string }).mode = "all";
    } else if (mode && mode !== "sub_unit") {
      (cfg as { mode?: string }).mode = "all";
    }
    return;
  }

  if (role === "sub_unit_leader") {
    const cc = normUp(admin.branch_country);
    const st = normUp(admin.branch_state);
    if (cc) cfg.branch_country = cc;
    if (st) cfg.branch_state = st;
    if (admin.satellite_site) cfg.satellite_site = norm(admin.satellite_site);
    if (admin.service_unit_id) cfg.service_unit_id = Number(admin.service_unit_id);
    if (admin.sub_unit_name) cfg.sub_unit = norm(admin.sub_unit_name);
    return;
  }
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
    scope.scope_satellite_site = norm(l.satellite_site ?? "");
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
    scope.scope_satellite_site = norm((destinationConfig as { satellite_site?: string }).satellite_site ?? "");
    return scope;
  }

  if (destinationType === "send_all") {
    const s = destinationConfig as Record<string, unknown>;
    scope.branch_country = normUp(s.branch_country ?? body.branch_country);
    scope.scope_branch_state = normUp(s.branch_state ?? "");
    scope.scope_satellite_site = norm(s.satellite_site ?? "");
    scope.scope_unit_id = s.service_unit_id ? Number(s.service_unit_id) : null;
    scope.scope_sub_unit = norm(s.sub_unit ?? "");
    return scope;
  }

  return scope;
}

function announcementScopeFromRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    branch_country: row.branch_country,
    scope_branch_state: row.scope_branch_state,
    scope_satellite_site: row.scope_satellite_site,
    scope_unit_id: row.scope_unit_id,
    scope_sub_unit: row.scope_sub_unit,
  };
}

function adminMatchesAnnouncementScope(
  adminRow: Record<string, unknown>,
  scope: Record<string, unknown>,
): boolean {
  const cc = normUp(scope.branch_country);
  const st = normUp(scope.scope_branch_state);
  const sat = norm(scope.scope_satellite_site);
  const uid = Number(scope.scope_unit_id || 0);
  const sub = norm(scope.scope_sub_unit);

  if (cc && normUp(adminRow.branch_country) !== cc) return false;
  if (st && normUp(adminRow.branch_state) !== st) return false;
  if (sat && norm(adminRow.satellite_site) !== sat) return false;
  if (uid && Number(adminRow.service_unit_id) !== uid) return false;
  if (sub && norm(adminRow.sub_unit_name).toLowerCase() !== sub.toLowerCase()) return false;
  return true;
}

function resolveAnnouncementAdminRecipients(
  admins: Record<string, unknown>[],
  destinationType: string,
  destinationConfig: Record<string, unknown>,
  scope: Record<string, unknown>,
): Record<string, unknown>[] {
  const destType = norm(destinationType);
  const cfg = destinationConfig || {};
  let roles: string[] = [];

  if (destType === "admins") {
    roles = Array.isArray((cfg as { roles?: unknown }).roles)
      ? ((cfg as { roles: unknown[] }).roles).map((r) => norm(r)).filter(Boolean)
      : [];
    return admins.filter((a) => roles.includes(norm(a.role)) && adminMatchesAnnouncementScope(a, scope));
  }

  if (destType === "leaders") {
    const mode = norm((cfg as { mode?: string }).mode) || "all";
    if (mode === "service_unit") roles = ["service_unit_leader"];
    else if (mode === "sub_unit") roles = ["sub_unit_leader"];
    else roles = ["service_unit_leader", "sub_unit_leader"];
    return admins.filter((a) => roles.includes(norm(a.role)) && adminMatchesAnnouncementScope(a, scope));
  }

  if (destType === "members") {
    return admins.filter((a) => {
      const role = norm(a.role);
      if (!["service_unit_leader", "sub_unit_leader"].includes(role)) return false;
      return adminMatchesAnnouncementScope(a, scope);
    });
  }

  return [];
}

async function fetchMemberEmailsForAnnouncementScope(
  supabase: SupabaseClient,
  scope: Record<string, unknown>,
): Promise<Array<{ email: string; name: string }>> {
  let q = supabase.from("registrations").select("email,first_name,surname").eq("status", "accepted");
  const cc = normUp(scope.branch_country);
  const st = normUp(scope.scope_branch_state);
  const sat = norm(scope.scope_satellite_site);
  const uid = Number(scope.scope_unit_id || 0);
  const sub = norm(scope.scope_sub_unit);
  if (cc) q = q.eq("branch_country", cc);
  if (st) q = q.eq("branch_state", st);
  if (sat) q = q.eq("satellite_site", sat);
  if (uid) q = q.eq("unit_id", uid);
  if (sub) q = q.eq("sub_unit", sub);
  const { data, error } = await q.limit(5000);
  if (error) throw new Error(error.message);
  const out: Array<{ email: string; name: string }> = [];
  const seen = new Set<string>();
  for (const r of data || []) {
    const email = norm((r as { email?: unknown }).email).toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    const row = r as { first_name?: string; surname?: string };
    out.push({
      email,
      name: [row.first_name, row.surname].filter(Boolean).join(" ").trim(),
    });
  }
  return out;
}

function resolveSendAllAudienceAdminRecipients(
  admins: Record<string, unknown>[],
  audienceKey: string,
  scope: Record<string, unknown>,
): Record<string, unknown>[] {
  const key = norm(audienceKey);
  if (key === "members") {
    return admins.filter((a) => {
      const role = norm(a.role);
      if (!["service_unit_leader", "sub_unit_leader"].includes(role)) return false;
      return adminMatchesAnnouncementScope(a, scope);
    });
  }
  if (key === "service_unit_leaders") {
    return admins.filter((a) => norm(a.role) === "service_unit_leader" && adminMatchesAnnouncementScope(a, scope));
  }
  if (key === "sub_unit_leaders") {
    return admins.filter((a) => norm(a.role) === "sub_unit_leader" && adminMatchesAnnouncementScope(a, scope));
  }
  if (key === "satellite_pastors") {
    return admins.filter((a) => norm(a.role) === "satellite_church_admin" && adminMatchesAnnouncementScope(a, scope));
  }
  if (key === "state_branch_pastors") {
    return admins.filter((a) => norm(a.role) === "state_super_admin" && adminMatchesAnnouncementScope(a, scope));
  }
  return [];
}

async function deliverAnnouncement(
  supabase: SupabaseClient,
  announcement: Record<string, unknown>,
): Promise<void> {
  if (norm(announcement.workflow_status) !== "sent") return;

  const mediumEmail = Number(announcement.medium_email) === 1;
  const mediumPush = Number(announcement.medium_push) === 1;
  if (!mediumEmail && !mediumPush) return;

  const destType = norm(announcement.destination_type);
  const cfg = (announcement.destination_config && typeof announcement.destination_config === "object")
    ? announcement.destination_config as Record<string, unknown>
    : {};
  const scope = announcementScopeFromRow(announcement);
  const title = String(announcement.title || "Announcement");
  const body = String(announcement.body || "");
  const annId = String(announcement.id || "");
  const preview = body.length > 140 ? `${body.slice(0, 137)}…` : body;
  const bodyInner = `<p style="margin:0 0 8px;font-size:17px;font-weight:600;">${title}</p><div>${body.replace(/\n/g, "<br>")}</div>`;

  let announcementSender = systemNotificationSender("Announcements");
  const createdById = Number(announcement.created_by_admin_id || 0);
  if (Number.isFinite(createdById) && createdById > 0) {
    const { data: author } = await supabase.from("admins").select("id,full_name,role").eq("id", createdById).maybeSingle();
    if (author) announcementSender = adminNotificationSender(author as Record<string, unknown>);
  }

  const { data: allAdmins } = await supabase.from("admins").select("*").eq("is_active", 1);
  const admins = (allAdmins || []) as Record<string, unknown>[];
  const seenAdminIds = new Set<number>();
  const seenMemberEmails = new Set<string>();

  async function notifyAdminRecipient(a: Record<string, unknown>, sendEmailToAdmin = true) {
    const id = Number(a.id);
    if (!Number.isFinite(id) || seenAdminIds.has(id)) return;
    seenAdminIds.add(id);

    if (mediumPush) {
      await insertAdminNotification(supabase, {
        admin_id: id,
        type: "announcement",
        title,
        body: body.length > 500 ? `${body.slice(0, 497)}…` : body,
        entity_type: "announcement",
        entity_id: annId,
        metadata: { destination_type: destType },
        sender: announcementSender,
      });
    }
    if (mediumEmail && sendEmailToAdmin) {
      const email = norm(a.email).toLowerCase();
      if (email) {
        const html = wrapEmailHtml({
          title,
          previewText: preview || title,
          bodyHtml: bodyInner,
        });
        await sendEmail({
          to: email,
          subject: formatOrgSubject(title, "announcement"),
          html,
          tags: ["announcement"],
        });
      }
    }
  }

  if (destType === "send_all") {
    const audiences = Array.isArray((cfg as { audiences?: unknown }).audiences)
      ? ((cfg as { audiences: unknown[] }).audiences).map((a) => norm(a)).filter(Boolean)
      : [];

    for (const aud of audiences) {
      if (aud === "members") {
        const leaderAdmins = resolveSendAllAudienceAdminRecipients(admins, "members", scope);
        for (const a of leaderAdmins) await notifyAdminRecipient(a, false);
        if (mediumEmail) {
          const members = await fetchMemberEmailsForAnnouncementScope(supabase, scope);
          for (const m of members) {
            if (!m.email || seenMemberEmails.has(m.email)) continue;
            seenMemberEmails.add(m.email);
            const greeting = m.name ? `Hello ${m.name},` : "Hello,";
            const html = wrapEmailHtml({
              title,
              previewText: preview || title,
              bodyHtml: `<p>${greeting}</p>${bodyInner}`,
            });
            await sendEmail({
              to: m.email,
              subject: formatOrgSubject(title, "announcement"),
              html,
              tags: ["announcement"],
            });
          }
        }
        continue;
      }
      const recips = resolveSendAllAudienceAdminRecipients(admins, aud, scope);
      for (const a of recips) await notifyAdminRecipient(a);
    }
    return;
  }

  const recipientAdmins = resolveAnnouncementAdminRecipients(admins, destType, cfg, scope);

  for (const a of recipientAdmins) {
    await notifyAdminRecipient(a, destType !== "members");
  }

  if (destType === "members" && mediumEmail) {
    const members = await fetchMemberEmailsForAnnouncementScope(supabase, scope);
    for (const m of members) {
      if (!m.email) continue;
      const greeting = m.name ? `Hello ${m.name},` : "Hello,";
      const html = wrapEmailHtml({
        title,
        previewText: preview || title,
        bodyHtml: `<p>${greeting}</p>${bodyInner}`,
      });
      await sendEmail({
        to: m.email,
        subject: formatOrgSubject(title, "announcement"),
        html,
        tags: ["announcement"],
      });
    }
  }
}

/** Process due scheduled announcements (for cron / process-scheduled edge function). */
export async function runScheduledAnnouncements(supabase: SupabaseClient): Promise<number> {
  const now = new Date().toISOString();
  const { data: due, error } = await supabase.from("announcements").select("*").eq(
    "workflow_status",
    "scheduled",
  ).lte("scheduled_at", now).limit(50);
  if (error) throw new Error(error.message);

  let sent = 0;
  for (const row of due || []) {
    const id = Number((row as { id?: unknown }).id);
    const { error: upErr } = await supabase.from("announcements").update({
      workflow_status: "sent",
      sent_at: now,
      scheduled_at: null,
    }).eq("id", id);
    if (upErr) continue;

    const { data: sentRow } = await supabase.from("announcements").select("*").eq("id", id).maybeSingle();
    if (sentRow) {
      try {
        await deliverAnnouncement(supabase, sentRow as Record<string, unknown>);
      } catch {
        /* partial delivery ok */
      }
    }
    sent++;
  }
  return sent;
}

async function handleCreateAnnouncement(supabase: SupabaseClient, params: Record<string, unknown>, admin: AdminRow, ip: string) {
  const body = (params.body || {}) as Record<string, unknown>;
  const title = norm(body.title);
  const text = norm(body.body);
  if (!title || !text) throw new Error("Title and message are required.");

  const mediumEmail = body.medium_email === true || body.medium_email === 1 || body.medium_email === "1" ? 1 : 0;
  const mediumPush = body.medium_push === true || body.medium_push === 1 || body.medium_push === "1" ? 1 : 0;
  if (!mediumEmail && !mediumPush) throw new Error("Select at least one medium: Email or Push notification.");

  const action = norm(body.workflow_action) || "send";
  const { destinationType, destinationConfig } = parseAnnouncementDestination(body);
  const senderRole = norm(admin.role);
  if (["service_unit_leader", "sub_unit_leader"].includes(senderRole)) {
    throw new Error("Your role cannot create announcements.");
  }
  if (destinationType === "send_all") {
    if (!["country_super_admin", "state_super_admin", "satellite_church_admin", "super_admin", "general_admin"].includes(senderRole)) {
      throw new Error("Send all announcements are not available for your role.");
    }
    validateSendAllDestination(admin, destinationConfig, params.scope_mode);
  }
  if (senderRole === "sub_unit_leader" && destinationType !== "members") {
    throw new Error("Sub-unit leaders may only send announcements to their unit members.");
  }
  if (senderRole === "service_unit_leader" && !["members", "leaders"].includes(destinationType)) {
    throw new Error("Service unit leaders may only send announcements to service unit members or sub-unit leaders.");
  }
  if (senderRole === "satellite_church_admin" && !["members", "leaders", "send_all"].includes(destinationType)) {
    throw new Error(
      "Satellite Pastor Admins may only send announcements to service unit members or service unit heads.",
    );
  }
  clampAnnouncementScope(admin, destinationConfig, params.scope_mode);
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
    medium_push: mediumPush,
    medium_sms: 0,
    workflow_status: workflowStatus,
    scheduled_at: scheduledAt,
    sent_at: sentAt,
    archived_at: null,
    created_by_admin_id: Number(admin.id),
    created_by_name: String(admin.full_name || ""),
  };

  const { data, error } = await supabase.from("announcements").insert(row).select("*").single();
  if (error) throw new Error(error.message);
  if (workflowStatus === "sent") {
    try {
      await deliverAnnouncement(supabase, data as Record<string, unknown>);
    } catch {
      /* do not fail create if delivery partially fails */
    }
  }
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
  if (body.medium_push !== undefined) patch.medium_push = body.medium_push ? 1 : 0;

  const { error } = await supabase.from("announcements").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  if (action === "send") {
    const { data: sentRow } = await supabase.from("announcements").select("*").eq("id", id).maybeSingle();
    if (sentRow) {
      try {
        await deliverAnnouncement(supabase, sentRow as Record<string, unknown>);
      } catch {
        /* do not fail update if delivery partially fails */
      }
    }
  }
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
    throw new Error("Only Super Admin, General Admin, or Data Entry Admin can access the branch catalog.");
  }
}

function assertCatalogCountryScope(admin: AdminRow, targetCountryCode: string): void {
  if (norm(admin.role) !== "country_super_admin") return;
  const myCountry = normUp(admin.branch_country);
  if (!myCountry) throw new Error("Your country scope is not configured.");
  if (normUp(targetCountryCode) !== myCountry) {
    throw new Error("Country admins can only manage locations within their own country.");
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

function buildMergedChurchRows(
  churches: Record<string, unknown>[],
  satellites: Record<string, unknown>[],
): Record<string, unknown>[] {
  const byKey = new Map<string, Record<string, unknown>>();
  for (const ch of churches) {
    const cc = normUp(ch.branch_country);
    const st = normUp(ch.branch_state);
    const name = norm(ch.name);
    if (!cc || !st || !name) continue;
    byKey.set(`${cc}:${st}:${name.toLowerCase()}`, {
      id: ch.id ?? null,
      name,
      address: norm(ch.address),
      branch_country: cc,
      branch_state: st,
      directory_branch_id: ch.directory_branch_id ?? null,
      is_active: ch.is_active ?? 1,
    });
  }
  for (const s of satellites) {
    const cc = normUp(s.branch_country);
    const st = normUp(s.branch_state);
    const name = norm(s.site_name);
    if (!cc || !st || !name) continue;
    const key = `${cc}:${st}:${name.toLowerCase()}`;
    if (!byKey.has(key)) {
      byKey.set(key, {
        id: null,
        name,
        address: "",
        branch_country: cc,
        branch_state: st,
        directory_branch_id: null,
        is_active: s.is_active ?? 1,
      });
    }
  }
  return [...byKey.values()].sort((a, b) => {
    const ac = normUp(a.branch_country).localeCompare(normUp(b.branch_country));
    if (ac !== 0) return ac;
    const st = normUp(a.branch_state).localeCompare(normUp(b.branch_state));
    if (st !== 0) return st;
    return norm(a.name).localeCompare(norm(b.name));
  });
}

async function loadScopedCatalog(supabase: SupabaseClient, admin: AdminRow) {
  const role = norm(admin.role);
  const scopedCountry = normUp(admin.branch_country);
  const scopedState = normUp(admin.branch_state);
  const scopedSatellite = norm(admin.satellite_site);

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

  let scopedCountries = (countries || []) as Record<string, unknown>[];
  let scopedStates = (states || []) as Record<string, unknown>[];
  let scopedChurches = (churches || []) as Record<string, unknown>[];
  let scopedSatellites = satellites;
  let scopedAdmins = adminRows;
  let scopedRegs = regs;

  const isGlobalCatalogView = ["super_admin", "general_admin", "data_entry_admin"].includes(role);
  if (!isGlobalCatalogView) {
    if (scopedCountry) {
      scopedCountries = scopedCountries.filter(
        (c) => normUp((c as { branch_country_code?: unknown }).branch_country_code) === scopedCountry,
      );
      const allowedCountryIds = new Set(
        scopedCountries.map((c) => Number((c as { id?: unknown }).id)).filter((id) => Number.isFinite(id)),
      );
      scopedStates = scopedStates.filter((s) => allowedCountryIds.has(Number((s as { country_id?: unknown }).country_id)));
      scopedChurches = scopedChurches.filter(
        (c) => normUp((c as { branch_country?: unknown }).branch_country) === scopedCountry,
      );
      scopedSatellites = scopedSatellites.filter(
        (s) => normUp((s as { branch_country?: unknown }).branch_country) === scopedCountry,
      );
      scopedAdmins = scopedAdmins.filter(
        (a) => normUp((a as { branch_country?: unknown }).branch_country) === scopedCountry,
      );
      scopedRegs = scopedRegs.filter(
        (r) => normUp((r as { branch_country?: unknown }).branch_country) === scopedCountry,
      );
    }

    if (["state_super_admin", "satellite_church_admin", "service_unit_leader", "sub_unit_leader"].includes(role) && scopedState) {
      scopedStates = scopedStates.filter(
        (s) => normUp((s as { branch_state_code?: unknown }).branch_state_code) === scopedState,
      );
      scopedChurches = scopedChurches.filter(
        (c) => normUp((c as { branch_state?: unknown }).branch_state) === scopedState,
      );
      scopedSatellites = scopedSatellites.filter(
        (s) => normUp((s as { branch_state?: unknown }).branch_state) === scopedState,
      );
      scopedAdmins = scopedAdmins.filter(
        (a) => normUp((a as { branch_state?: unknown }).branch_state) === scopedState,
      );
      scopedRegs = scopedRegs.filter(
        (r) => normUp((r as { branch_state?: unknown }).branch_state) === scopedState,
      );
    }

    if (["satellite_church_admin", "service_unit_leader", "sub_unit_leader"].includes(role) && scopedSatellite) {
      scopedChurches = scopedChurches.filter(
        (c) => norm((c as { name?: unknown }).name) === scopedSatellite ||
          norm((c as { satellite_site?: unknown }).satellite_site) === scopedSatellite,
      );
      scopedSatellites = scopedSatellites.filter(
        (s) => norm((s as { site_name?: unknown }).site_name) === scopedSatellite,
      );
      scopedAdmins = scopedAdmins.filter(
        (a) => norm((a as { satellite_site?: unknown }).satellite_site) === scopedSatellite,
      );
      scopedRegs = scopedRegs.filter(
        (r) => norm((r as { satellite_site?: unknown }).satellite_site) === scopedSatellite,
      );
    }
  }

  return {
    countries: scopedCountries,
    states: scopedStates,
    churches: scopedChurches,
    satellites: scopedSatellites,
    admins: scopedAdmins,
    stats: buildCatalogStats(scopedRegs),
  };
}

async function handleCatalogList(supabase: SupabaseClient, admin: AdminRow) {
  requireCatalogEditor(admin);
  return loadScopedCatalog(supabase, admin);
}

/** Church/satellite site list for admin dropdowns — same DB sources as catalogList, scoped to role. */
async function handleChurchCatalog(supabase: SupabaseClient, admin: AdminRow) {
  const catalog = await loadScopedCatalog(supabase, admin);
  return {
    churches: buildMergedChurchRows(
      catalog.churches as Record<string, unknown>[],
      catalog.satellites as Record<string, unknown>[],
    ),
  };
}

async function handleCatalogCreateLocation(
  supabase: SupabaseClient,
  params: Record<string, unknown>,
  admin: AdminRow,
  ip: string,
) {
  requireCatalogEditor(admin);
  if (norm(admin.role) === "data_entry_admin") {
    throw new Error("Data Entry Admins must submit location proposals for approval.");
  }
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
  assertCatalogCountryScope(admin, iso.toUpperCase());
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
  if (norm(admin.role) === "data_entry_admin") {
    throw new Error("Data Entry Admins must submit location proposals for approval.");
  }
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
  assertCatalogCountryScope(admin, String((cc as { branch_country_code?: string }).branch_country_code || ""));
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
  assertCatalogCountryScope(admin, countryCode);
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
  if (norm(admin.role) !== "super_admin" && norm(admin.role) !== "general_admin") {
    throw new Error("Only Super Admin or General Admin can change location visibility.");
  }
  const id = params.id;
  const isActive = Number(params.is_active) === 1 ? 1 : 0;
  const { error } = await supabase.from("churches").update({ is_active: isActive }).eq("id", id);
  if (error) throw new Error(error.message);
  await logActivity(supabase, admin, "catalog.church_active", "church", String(id), `is_active=${isActive}`, ip);
  return { ok: true };
}

async function handleCatalogDeleteChurch(supabase: SupabaseClient, params: Record<string, unknown>, admin: AdminRow, ip: string) {
  requireCatalogEditor(admin);
  if (norm(admin.role) !== "super_admin" && norm(admin.role) !== "general_admin") {
    throw new Error("Only Super Admin or General Admin can delete locations.");
  }
  const id = params.id;
  const { data: row } = await supabase.from("churches").select("directory_branch_id,branch_country").eq("id", id).maybeSingle();
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
