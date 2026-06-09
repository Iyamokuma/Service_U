import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

function norm(s: unknown): string {
  return String(s ?? "").trim();
}

export function getAdminAppUrl(): string {
  const denoEnv = (globalThis as { Deno?: { env?: { get?: (key: string) => string | undefined } } }).Deno?.env;
  return norm(denoEnv?.get?.("ADMIN_APP_URL") || "").replace(/\/+$/, "");
}

/** Resend "from" — supports RESEND_FROM_EMAIL or legacy RESEND_SENDER_NAME + RESEND_SENDER_EMAIL. */
export function getResendFromAddress(): string {
  const denoEnv = (globalThis as { Deno?: { env?: { get?: (key: string) => string | undefined } } }).Deno?.env;
  const direct = norm(denoEnv?.get?.("RESEND_FROM_EMAIL") || "");
  if (direct) return direct;
  const email = norm(denoEnv?.get?.("RESEND_SENDER_EMAIL") || "");
  const name = norm(denoEnv?.get?.("RESEND_SENDER_NAME") || "");
  if (email && name) return `${name} <${email}>`;
  return email;
}

export function isPlatformAdminRole(role: unknown): boolean {
  const r = norm(role);
  return r === "super_admin" || r === "general_admin";
}

/** Resend must be configured (RESEND_API_KEY, RESEND_FROM_EMAIL, ADMIN_APP_URL). */
export function isEmailInviteEnabled(): boolean {
  const denoEnv = (globalThis as { Deno?: { env?: { get?: (key: string) => string | undefined } } }).Deno?.env;
  const v = norm(denoEnv?.get?.("ADMIN_EMAIL_INVITES") || "").toLowerCase();
  if (v === "false" || v === "0" || v === "no") return false;
  return true;
}

/** All new admin accounts are invite-only (except Super Admin bootstrap). */
export function usesInviteOnCreate(_actorRole: unknown): boolean {
  if (!isEmailInviteEnabled()) {
    throw new Error(
      "Admin invites are required. Configure RESEND_API_KEY, RESEND_FROM_EMAIL, and ADMIN_APP_URL on the server.",
    );
  }
  return true;
}

export async function generateInviteToken(): Promise<string> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomInternalPassword(): string {
  return `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
}

export function usernameBaseFromEmail(email: string): string {
  const local = norm(email).split("@")[0].toLowerCase();
  const cleaned = local.replace(/[^a-z0-9._-]/g, ".").replace(/\.+/g, ".").replace(/^\.+|\.+$/g, "");
  return (cleaned || "admin").slice(0, 48);
}

export async function resolveAvailableUsername(
  supabase: SupabaseClient,
  email: string,
  excludeId?: number,
): Promise<string> {
  const base = usernameBaseFromEmail(email);
  let candidate = base;
  for (let n = 0; n < 200; n++) {
    const { data, error } = await supabase.from("admins").select("id").ilike("username", candidate);
    if (error) throw new Error(error.message);
    const taken = (data || []).find((r) => Number(r.id) !== Number(excludeId ?? 0));
    if (!taken) return candidate;
    candidate = `${base}.${n + 1}`.slice(0, 64);
  }
  throw new Error("Could not generate a unique username for this email.");
}

export function inviteExpiresAt(hours = 72): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

export function shapeAdminForClient(
  row: Record<string, unknown>,
  serviceUnitName = "",
): Record<string, unknown> {
  const pendingInvite = !!norm(row.invite_token) && Number(row.must_change_password ?? 0) === 1;
  return {
    id: row.id,
    full_name: row.full_name,
    username: row.username,
    email: row.email,
    role: row.role,
    service_unit_id: row.service_unit_id,
    sub_unit_name: row.sub_unit_name || "",
    branch_country: row.branch_country ?? "",
    branch_state: row.branch_state ?? "",
    satellite_site: row.satellite_site ?? "",
    service_unit_name: serviceUnitName,
    must_change_password: Number(row.must_change_password ?? 0) === 1,
    pending_invite: pendingInvite,
  };
}

const ROLE_INVITE_LABELS: Record<string, string> = {
  general_admin: "General Admin",
  country_super_admin: "Country Admin",
  state_super_admin: "State Branch Admin",
  satellite_church_admin: "Satellite Pastor Admin",
  service_unit_leader: "Service Unit Leader",
  sub_unit_leader: "Sub-Unit Leader",
  data_entry_admin: "Data Entry Admin",
};

export function inviteRoleLabel(role: unknown): string {
  const r = norm(role);
  return ROLE_INVITE_LABELS[r] || "Admin";
}

export async function sendAdminInviteEmail(
  to: string,
  fullName: string,
  inviteUrl: string,
  role = "",
): Promise<boolean> {
  const denoEnv = (globalThis as { Deno?: { env?: { get?: (key: string) => string | undefined } } }).Deno?.env;
  const key = denoEnv?.get?.("RESEND_API_KEY") || "";
  const from = getResendFromAddress();
  const email = norm(to).toLowerCase();
  if (!key || !from || !email || !inviteUrl) return false;

  const roleLabel = inviteRoleLabel(role);
  const subject = "Activate your Salvation Ministries admin account";
  const html = `
    <p>Hello ${fullName || "there"},</p>
    <p>You have been invited as <strong>${roleLabel}</strong> on the Salvation Ministries admin dashboard.</p>
    <p><a href="${inviteUrl}" style="display:inline-block;padding:12px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Activate account &amp; set password</a></p>
    <p style="font-size:14px;color:#444;">Or copy this link: <a href="${inviteUrl}">${inviteUrl}</a></p>
    <p>This link expires in <strong>72 hours</strong>. After activation, sign in with <strong>${email}</strong> and the password you choose.</p>
    <p style="color:#666;font-size:13px;">If you did not expect this email, you can ignore it.</p>
  `;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [email], subject, html }),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error("Resend invite email failed:", res.status, errBody);
    }
    return res.ok;
  } catch (err) {
    console.error("Resend invite email error:", err);
    return false;
  }
}
