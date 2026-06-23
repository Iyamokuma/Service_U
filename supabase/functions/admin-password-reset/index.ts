import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildPasswordResetUrl,
  canSelfServicePasswordReset,
  issuePasswordResetToken,
  sendPasswordResetEmail,
} from "../_shared/admin_password_reset.ts";
import { issueAdminSession } from "../_shared/admin_session.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GENERIC_REQUEST_OK = {
  ok: true,
  message:
    "We sent a password reset link to that email when an account is registered. Check your inbox and spam folder.",
};

const GENERIC_RESET_LINK_ERROR =
  "This reset link is invalid or has expired. Use Forgot password on the sign-in page.";

const GENERIC_RESET_SAVE_ERROR =
  "We could not update your password. Use Forgot password on the sign-in page to request a new link.";

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function norm(s: unknown): string {
  return String(s ?? "").trim();
}

function normalizeAdminPassword(raw: unknown): string {
  return String(raw ?? "").trim();
}

function assertAdminPasswordFormat(password: string): void {
  if (!password || password.length < 8) {
    throw new Error("Password is required (minimum 8 characters).");
  }
}

function requireEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  let op = "";
  try {
    const supabaseUrl = requireEnv("SUPABASE_URL");
    const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

    const body = (await req.json()) as {
      op?: string;
      email?: string;
      token?: string;
      password?: string;
    };
    op = norm(body.op);
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    if (op === "requestPasswordReset") {
      const email = norm(body.email).toLowerCase();
      if (!email) return json(400, { error: "Email is required." });

      try {
        const { data: row, error } = await supabase
          .from("admins")
          .select("id,full_name,email,role,is_active,must_change_password,invite_token")
          .eq("is_active", 1)
          .ilike("email", email)
          .maybeSingle();
        if (error) throw new Error(error.message);

        if (row && canSelfServicePasswordReset(row as Record<string, unknown>)) {
          const token = await issuePasswordResetToken(supabase, Number(row.id));
          const resetUrl = buildPasswordResetUrl(token);
          const sent = await sendPasswordResetEmail(
            String(row.email || email),
            String(row.full_name || ""),
            resetUrl,
          );

          await supabase.from("activity_logs").insert({
            admin_id: row.id,
            admin_name: row.full_name,
            action: sent.ok ? "admin.password_reset_requested" : "admin.password_reset_email_failed",
            entity_type: "admin",
            entity_id: String(row.id),
            description: sent.ok
              ? "Password reset link emailed"
              : `Password reset email failed: ${sent.error || "unknown"}`,
            ip_address: clientIp(req),
          });

          if (!sent.ok) {
            await supabase
              .from("admins")
              .update({ password_reset_token: null, password_reset_expires_at: null })
              .eq("id", row.id);
          }
        }
      } catch (err) {
        console.error("requestPasswordReset failed:", err);
      }

      return json(200, GENERIC_REQUEST_OK);
    }

    const token = norm(body.token);
    if (!op || !token) return json(400, { error: "Missing op or token." });

    if (op === "validatePasswordReset") {
      const { data: row, error } = await supabase
        .from("admins")
        .select("id,full_name,email,role,password_reset_expires_at,is_active")
        .eq("password_reset_token", token)
        .maybeSingle();
      if (error) return json(400, { error: GENERIC_RESET_LINK_ERROR });
      if (!row || Number(row.is_active) !== 1) {
        return json(400, { error: "This reset link is invalid or has already been used." });
      }
      const expires = row.password_reset_expires_at
        ? new Date(String(row.password_reset_expires_at)).getTime()
        : 0;
      if (!expires || expires < Date.now()) {
        return json(400, { error: "This reset link has expired. Request a new one from the sign-in page." });
      }
      return json(200, {
        full_name: row.full_name,
        email: row.email,
        role: row.role,
        expires_at: row.password_reset_expires_at,
      });
    }

    if (op === "completePasswordReset") {
      const password = normalizeAdminPassword(body.password);
      assertAdminPasswordFormat(password);

      const { data: row, error } = await supabase
        .from("admins")
        .select("*")
        .eq("password_reset_token", token)
        .maybeSingle();
      if (error) return json(400, { error: GENERIC_RESET_LINK_ERROR });
      if (!row || Number(row.is_active) !== 1) {
        return json(400, { error: "This reset link is invalid or has already been used." });
      }
      if (!canSelfServicePasswordReset(row as Record<string, unknown>)) {
        return json(400, { error: "This account cannot reset its password here." });
      }
      const expires = row.password_reset_expires_at
        ? new Date(String(row.password_reset_expires_at)).getTime()
        : 0;
      if (!expires || expires < Date.now()) {
        return json(400, { error: "This reset link has expired. Request a new one from the sign-in page." });
      }

      const { error: updErr } = await supabase
        .from("admins")
        .update({
          password,
          must_change_password: 0,
          password_reset_token: null,
          password_reset_expires_at: null,
        })
        .eq("id", row.id);
      if (updErr) return json(400, { error: GENERIC_RESET_SAVE_ERROR });

      const { data: fresh, error: freshErr } = await supabase
        .from("admins")
        .select("*")
        .eq("id", row.id)
        .maybeSingle();
      if (freshErr) return json(400, { error: GENERIC_RESET_SAVE_ERROR });
      if (!fresh) return json(400, { error: GENERIC_RESET_SAVE_ERROR });

      await supabase.from("activity_logs").insert({
        admin_id: fresh.id,
        admin_name: fresh.full_name,
        action: "admin.password_reset_complete",
        entity_type: "admin",
        entity_id: String(fresh.id),
        description: "Completed password reset",
        ip_address: clientIp(req),
      });

      const jwtSecret = requireEnv("ADMIN_JWT_SECRET");
      const session = await issueAdminSession(
        supabase,
        fresh as Record<string, unknown>,
        jwtSecret,
        req,
        "Reset password and signed in",
      );

      return json(200, {
        ok: true,
        email: norm(fresh.email).toLowerCase(),
        token: session.token,
        admin: session.admin,
      });
    }

    return json(400, { error: "Unknown operation." });
  } catch (err) {
    console.error("admin-password-reset error:", err);
    if (op === "requestPasswordReset") {
      return json(200, GENERIC_REQUEST_OK);
    }
    return json(400, { error: GENERIC_RESET_LINK_ERROR });
  }
});
