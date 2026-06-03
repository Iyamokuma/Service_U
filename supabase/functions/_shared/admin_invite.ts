import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

function norm(s: unknown): string {
  return String(s ?? "").trim();
}

export function getAdminAppUrl(): string {
  const denoEnv = (globalThis as { Deno?: { env?: { get?: (key: string) => string | undefined } } }).Deno?.env;
  return norm(denoEnv?.get?.("ADMIN_APP_URL") || "").replace(/\/+$/, "");
}

export function isPlatformAdminRole(role: unknown): boolean {
  const r = norm(role);
  return r === "super_admin" || r === "general_admin";
}

export function usesInviteOnCreate(actorRole: unknown): boolean {
  return isPlatformAdminRole(actorRole);
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

export async function sendAdminInviteEmail(
  to: string,
  fullName: string,
  inviteUrl: string,
): Promise<boolean> {
  const denoEnv = (globalThis as { Deno?: { env?: { get?: (key: string) => string | undefined } } }).Deno?.env;
  const key = denoEnv?.get?.("RESEND_API_KEY") || "";
  const from = denoEnv?.get?.("RESEND_FROM_EMAIL") || "";
  const email = norm(to).toLowerCase();
  if (!key || !from || !email || !inviteUrl) return false;

  const subject = "Your Salvation Ministries admin account";
  const html = `
    <p>Hello ${fullName || "there"},</p>
    <p>A Super Admin created an admin account for you on the Salvation Ministries dashboard.</p>
    <p><a href="${inviteUrl}">Activate your account and set your password</a></p>
    <p>This link expires in 72 hours. If it expires, ask your Super Admin to resend the invitation.</p>
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
    return res.ok;
  } catch {
    return false;
  }
}
