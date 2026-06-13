import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as OTPAuth from "https://esm.sh/otpauth@9.3.2";

const ISSUER = "Salvation Ministries";
export const MFA_GRACE_DAYS = 11;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function norm(s: unknown): string {
  return String(s ?? "").trim();
}

function pepper(): string {
  const denoEnv = (globalThis as { Deno?: { env?: { get?: (key: string) => string | undefined } } }).Deno?.env;
  return norm(denoEnv?.get?.("ADMIN_TOTP_PEPPER") || denoEnv?.get?.("ADMIN_JWT_SECRET") || "");
}

async function deriveAesKey(): Promise<CryptoKey> {
  const p = pepper();
  if (!p) throw new Error("Server MFA configuration is missing.");
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(`totp-aes:${p}`));
  return crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptTotpSecret(plain: string): Promise<string> {
  const key = await deriveAesKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(plain));
  const packed = new Uint8Array(iv.length + cipher.byteLength);
  packed.set(iv, 0);
  packed.set(new Uint8Array(cipher), iv.length);
  return btoa(String.fromCharCode(...packed));
}

export async function decryptTotpSecret(stored: string): Promise<string> {
  const raw = Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
  const iv = raw.slice(0, 12);
  const data = raw.slice(12);
  const key = await deriveAesKey();
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return decoder.decode(plain);
}

export function generateTotpSecretBase32(): string {
  const secret = new OTPAuth.Secret({ size: 20 });
  return secret.base32;
}

export function buildTotpUri(secretBase32: string, email: string): string {
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    label: norm(email) || "Admin",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  });
  return totp.toString();
}

export function verifyTotpCode(secretBase32: string, codeRaw: string): boolean {
  const code = norm(codeRaw).replace(/\D/g, "");
  if (!/^\d{6}$/.test(code)) return false;
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  });
  return totp.validate({ token: code, window: 1 }) !== null;
}

export function isRootSuperAdminRole(role: unknown): boolean {
  return norm(role) === "super_admin";
}

export function totpClientMeta(row: Record<string, unknown>): Record<string, unknown> {
  const enabled = row.totp_enabled === true || Number(row.totp_enabled) === 1;
  if (isRootSuperAdminRole(row.role)) {
    return {
      totp_enabled: enabled,
      totp_enrollment_required: false,
      totp_grace_days_remaining: null,
    };
  }
  const activatedRaw = row.dashboard_activated_at;
  if (!activatedRaw) {
    return {
      totp_enabled: enabled,
      totp_enrollment_required: false,
      totp_grace_days_remaining: enabled ? null : MFA_GRACE_DAYS,
    };
  }
  const activated = new Date(String(activatedRaw)).getTime();
  if (!Number.isFinite(activated)) {
    return { totp_enabled: enabled, totp_enrollment_required: false, totp_grace_days_remaining: null };
  }
  const deadline = activated + MFA_GRACE_DAYS * 86400000;
  const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 86400000));
  return {
    totp_enabled: enabled,
    totp_enrollment_required: !enabled && Date.now() >= deadline,
    totp_grace_days_remaining: enabled ? null : remaining,
  };
}

export async function loadAdminTotpSecret(supabase: SupabaseClient, adminId: number): Promise<string | null> {
  const { data, error } = await supabase
    .from("admins")
    .select("totp_enabled,totp_secret_encrypted")
    .eq("id", adminId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || !(data.totp_enabled === true || Number(data.totp_enabled) === 1)) return null;
  const enc = norm(data.totp_secret_encrypted);
  if (!enc) return null;
  return decryptTotpSecret(enc);
}

export async function verifyAdminTotp(supabase: SupabaseClient, adminId: number, code: string): Promise<boolean> {
  const secret = await loadAdminTotpSecret(supabase, adminId);
  if (!secret) return false;
  return verifyTotpCode(secret, code);
}
