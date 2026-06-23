import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateInviteToken, getAdminAppUrl, getResendFromAddress } from "./admin_invite.ts";
import { isRootSuperAdminRole } from "./admin_totp.ts";

function norm(s: unknown): string {
  return String(s ?? "").trim();
}

export const PASSWORD_RESET_TTL_HOURS = 1;

export function passwordResetExpiresAt(hours = PASSWORD_RESET_TTL_HOURS): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

export function buildPasswordResetUrl(token: string): string {
  const base = getAdminAppUrl();
  if (!base || !token) return "";
  return `${base}/reset-password?token=${encodeURIComponent(token)}`;
}

export async function issuePasswordResetToken(
  supabase: SupabaseClient,
  adminId: number,
): Promise<string> {
  const token = await generateInviteToken();
  const { error } = await supabase
    .from("admins")
    .update({
      password_reset_token: token,
      password_reset_expires_at: passwordResetExpiresAt(),
    })
    .eq("id", adminId);
  if (error) throw new Error(error.message);
  return token;
}

export async function sendPasswordResetEmail(
  to: string,
  fullName: string,
  resetUrl: string,
): Promise<{ ok: boolean; error?: string }> {
  const denoEnv = (globalThis as { Deno?: { env?: { get?: (key: string) => string | undefined } } }).Deno?.env;
  const key = denoEnv?.get?.("RESEND_API_KEY") || "";
  const from = getResendFromAddress();
  const email = norm(to).toLowerCase();
  if (!key) return { ok: false, error: "RESEND_API_KEY is not set in Supabase Edge Function secrets." };
  if (!from) {
    return {
      ok: false,
      error: "RESEND_FROM_EMAIL is not set. Use a verified sender, e.g. Salvation Ministries <noreply@yourdomain.com>.",
    };
  }
  if (!email) return { ok: false, error: "Recipient email is missing." };
  if (!resetUrl) return { ok: false, error: "Reset link could not be built (check ADMIN_APP_URL)." };

  const subject = "Reset your Salvation Ministries admin password";
  const html = `
    <p>Hello ${fullName || "there"},</p>
    <p>We received a request to reset the password for your admin account (<strong>${email}</strong>).</p>
    <p><a href="${resetUrl}" style="display:inline-block;padding:12px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Choose a new password</a></p>
    <p style="font-size:14px;color:#444;">Or copy this link: <a href="${resetUrl}">${resetUrl}</a></p>
    <p>This link expires in <strong>${PASSWORD_RESET_TTL_HOURS} hour</strong>. Open it to choose a new password, then sign in on the admin login page with your new password.</p>
    <p style="color:#666;font-size:13px;">If you did not request a reset, you can ignore this email — your password will stay the same.</p>
    <p style="color:#666;font-size:13px;">Super Admin accounts cannot use self-service reset. Contact your platform owner if you need help.</p>
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
      console.error("Resend password reset email failed:", res.status, errBody);
      let detail = errBody;
      try {
        const parsed = JSON.parse(errBody) as { message?: string };
        if (parsed.message) detail = parsed.message;
      } catch {
        /* use raw body */
      }
      return { ok: false, error: detail || `Resend rejected the email (HTTP ${res.status}).` };
    }
    return { ok: true };
  } catch (err) {
    console.error("Resend password reset email error:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Could not reach Resend." };
  }
}

export function canSelfServicePasswordReset(admin: Record<string, unknown>): boolean {
  if (!admin || Number(admin.is_active) !== 1) return false;
  if (isRootSuperAdminRole(admin.role)) return false;
  if (!norm(admin.email)) return false;
  if (norm(admin.invite_token) && Number(admin.must_change_password) === 1) return false;
  return true;
}
