import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getResendFromAddress } from "./admin_invite.ts";

const OTP_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SEC = 60;
const MAX_CHALLENGES_PER_HOUR = 8;

const encoder = new TextEncoder();

function norm(s: unknown): string {
  return String(s ?? "").trim();
}

function pepper(): string {
  const denoEnv = (globalThis as { Deno?: { env?: { get?: (key: string) => string | undefined } } }).Deno?.env;
  return norm(denoEnv?.get?.("ADMIN_OTP_PEPPER") || denoEnv?.get?.("ADMIN_JWT_SECRET") || "");
}

export async function hashOtpCode(code: string): Promise<string> {
  const p = pepper();
  if (!p) throw new Error("Server OTP configuration is missing.");
  const data = encoder.encode(`${p}:login-otp:${code}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function generateOtpCode(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const n = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
  return String(n % 1_000_000).padStart(6, "0");
}

export function maskEmail(email: string): string {
  const e = norm(email).toLowerCase();
  const at = e.indexOf("@");
  if (at <= 0) return "***";
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);
  const shown = local.length <= 2 ? local[0] || "*" : `${local[0]}${"*".repeat(Math.min(4, local.length - 2))}${local.slice(-1)}`;
  return `${shown}@${domain}`;
}

export async function sendLoginOtpEmail(to: string, fullName: string, code: string): Promise<boolean> {
  const denoEnv = (globalThis as { Deno?: { env?: { get?: (key: string) => string | undefined } } }).Deno?.env;
  const key = denoEnv?.get?.("RESEND_API_KEY") || "";
  const from = getResendFromAddress();
  const email = norm(to).toLowerCase();
  if (!key || !from || !email) return false;

  const subject = "Your Salvation Ministries admin login code";
  const html = `
    <p>Hello ${fullName || "there"},</p>
    <p>Your one-time login code is:</p>
    <p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:16px 0;">${code}</p>
    <p>This code expires in <strong>${OTP_TTL_MINUTES} minutes</strong>. Enter it on the admin sign-in page to continue.</p>
    <p style="color:#666;font-size:13px;">If you did not try to sign in, you can ignore this email. Someone may have entered your password by mistake.</p>
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
      console.error("Resend login OTP failed:", res.status, errBody);
    }
    return res.ok;
  } catch (err) {
    console.error("Resend login OTP error:", err);
    return false;
  }
}

async function countRecentChallenges(supabase: SupabaseClient, adminId: number): Promise<number> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("admin_login_otp_challenges")
    .select("id", { count: "exact", head: true })
    .eq("admin_id", adminId)
    .gte("created_at", since);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function invalidateActiveChallenges(supabase: SupabaseClient, adminId: number): Promise<void> {
  const now = new Date().toISOString();
  await supabase
    .from("admin_login_otp_challenges")
    .update({ used_at: now })
    .eq("admin_id", adminId)
    .is("used_at", null);
}

export async function createLoginOtpChallenge(
  supabase: SupabaseClient,
  adminId: number,
  ip: string,
): Promise<{ challengeId: string; code: string; expiresAt: string }> {
  const recent = await countRecentChallenges(supabase, adminId);
  if (recent >= MAX_CHALLENGES_PER_HOUR) {
    throw new Error("Too many login codes requested. Wait an hour and try again.");
  }

  await invalidateActiveChallenges(supabase, adminId);

  const code = generateOtpCode();
  const otp_hash = await hashOtpCode(code);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("admin_login_otp_challenges")
    .insert({
      admin_id: adminId,
      otp_hash,
      expires_at: expiresAt,
      ip_address: ip,
      last_sent_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return { challengeId: String(data.id), code, expiresAt };
}

export async function resendLoginOtpChallenge(
  supabase: SupabaseClient,
  challengeId: string,
): Promise<{
  code: string;
  expiresAt: string;
  email_masked: string;
  adminEmail: string;
  fullName: string;
  adminId: number;
}> {
  const { data: row, error } = await supabase
    .from("admin_login_otp_challenges")
    .select("id,admin_id,attempts,expires_at,used_at,last_sent_at")
    .eq("id", challengeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row || row.used_at) {
    throw new Error("This login session expired. Sign in again with your password.");
  }

  const lastSent = new Date(String(row.last_sent_at || row.expires_at)).getTime();
  const waitSec = RESEND_COOLDOWN_SEC - Math.floor((Date.now() - lastSent) / 1000);
  if (waitSec > 0) {
    throw new Error(`Wait ${waitSec} second${waitSec === 1 ? "" : "s"} before requesting a new code.`);
  }

  const { data: admin, error: adminErr } = await supabase
    .from("admins")
    .select("id,email,full_name,is_active")
    .eq("id", row.admin_id)
    .maybeSingle();
  if (adminErr) throw new Error(adminErr.message);
  if (!admin || Number(admin.is_active) !== 1) {
    throw new Error("This account is no longer active.");
  }

  const email = norm(admin.email).toLowerCase();
  if (!email) throw new Error("This account has no email address. Contact your Super Admin.");

  const code = generateOtpCode();
  const otp_hash = await hashOtpCode(code);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();

  const { error: updErr } = await supabase
    .from("admin_login_otp_challenges")
    .update({
      otp_hash,
      expires_at: expiresAt,
      attempts: 0,
      last_sent_at: new Date().toISOString(),
    })
    .eq("id", challengeId);
  if (updErr) throw new Error(updErr.message);

  return {
    code,
    expiresAt,
    email_masked: maskEmail(email),
    adminEmail: email,
    fullName: String(admin.full_name || ""),
    adminId: Number(admin.id),
  };
}

export async function verifyLoginOtpChallenge(
  supabase: SupabaseClient,
  challengeId: string,
  otpRaw: string,
): Promise<number> {
  const otp = norm(otpRaw).replace(/\D/g, "");
  if (!/^\d{6}$/.test(otp)) {
    throw new Error("Enter the 6-digit code from your email.");
  }

  const { data: row, error } = await supabase
    .from("admin_login_otp_challenges")
    .select("id,admin_id,otp_hash,attempts,expires_at,used_at")
    .eq("id", challengeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row || row.used_at) {
    throw new Error("This login session expired. Sign in again with your password.");
  }

  const expires = new Date(String(row.expires_at)).getTime();
  if (!expires || expires < Date.now()) {
    throw new Error("This code has expired. Sign in again to receive a new one.");
  }

  const attempts = Number(row.attempts ?? 0);
  if (attempts >= MAX_ATTEMPTS) {
    throw new Error("Too many incorrect codes. Sign in again with your password.");
  }

  const expected = await hashOtpCode(otp);
  if (expected !== row.otp_hash) {
    await supabase
      .from("admin_login_otp_challenges")
      .update({ attempts: attempts + 1 })
      .eq("id", challengeId);
    const left = MAX_ATTEMPTS - attempts - 1;
    if (left <= 0) {
      throw new Error("Too many incorrect codes. Sign in again with your password.");
    }
    throw new Error(`Incorrect code. ${left} attempt${left === 1 ? "" : "s"} remaining.`);
  }

  const now = new Date().toISOString();
  await supabase.from("admin_login_otp_challenges").update({ used_at: now }).eq("id", challengeId);

  return Number(row.admin_id);
}

export const LOGIN_OTP_EXPIRES_SEC = OTP_TTL_MINUTES * 60;
export const LOGIN_OTP_RESEND_SEC = RESEND_COOLDOWN_SEC;
