import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { signAdminToken } from "../_shared/jwt.ts";
import { ensureCountryAdminHeadquarters } from "../_shared/admin_ops.ts";
import { shapeAdminForClient } from "../_shared/admin_invite.ts";
import { isRootSuperAdminRole, verifyAdminTotp } from "../_shared/admin_totp.ts";
import {
  createLoginOtpChallenge,
  LOGIN_OTP_EXPIRES_SEC,
  LOGIN_OTP_RESEND_SEC,
  maskEmail,
  resendLoginOtpChallenge,
  sendLoginOtpEmail,
  sendLoginOtpForChallenge,
  verifyDualLoginChallenge,
  verifyLoginOtpChallenge,
} from "../_shared/admin_login_otp.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-jwt",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function normText(v: unknown): string {
  return String(v ?? "").trim();
}

function normalizeAdminPassword(raw: unknown): string {
  return String(raw ?? "").trim();
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

type AdminRow = Record<string, unknown>;

function isTotpEnabled(admin: AdminRow): boolean {
  return admin.totp_enabled === true || Number(admin.totp_enabled) === 1;
}

async function findAdminForLogin(
  supabase: ReturnType<typeof createClient>,
  loginId: string,
): Promise<AdminRow | null> {
  const normalized = normText(loginId).toLowerCase();
  if (!normalized) return null;

  const { data: byEmail, error: emailErr } = await supabase
    .from("admins")
    .select("*")
    .eq("is_active", 1)
    .ilike("email", normalized)
    .maybeSingle();
  if (emailErr) throw new Error(emailErr.message);
  if (byEmail) return byEmail;

  const { data: byUsername, error: userErr } = await supabase
    .from("admins")
    .select("*")
    .eq("is_active", 1)
    .ilike("username", normalized)
    .maybeSingle();
  if (userErr) throw new Error(userErr.message);
  return byUsername;
}

function assertPasswordAndInviteGate(admin: AdminRow, password: string): void {
  if (normText(admin.invite_token) && Number(admin.must_change_password) === 1) {
    throw new Error(
      "This account is not activated yet. Open the link in your invitation email to set your password.",
    );
  }
  const storedPassword = normalizeAdminPassword(admin?.password);
  if (!storedPassword || storedPassword !== password) {
    throw new Error("Invalid credentials.");
  }
}

async function touchDashboardActivated(
  supabase: ReturnType<typeof createClient>,
  admin: AdminRow,
) {
  if (isRootSuperAdminRole(admin.role)) return;
  if (admin.dashboard_activated_at) return;
  await supabase
    .from("admins")
    .update({ dashboard_activated_at: new Date().toISOString() })
    .eq("id", admin.id);
}

async function issueAdminSession(
  supabase: ReturnType<typeof createClient>,
  admin: AdminRow,
  jwtSecret: string,
  req: Request,
  logDescription: string,
) {
  const now = new Date().toISOString();
  await supabase.from("admins").update({ last_login: now }).eq("id", admin.id);
  await touchDashboardActivated(supabase, admin);

  const resolved = await ensureCountryAdminHeadquarters(supabase, admin);

  await supabase.from("activity_logs").insert({
    admin_id: resolved.id,
    admin_name: resolved.full_name,
    action: "admin.login",
    entity_type: "admin",
    entity_id: String(resolved.id),
    description: logDescription,
    ip_address: clientIp(req),
  });

  let service_unit_name = "";
  if (resolved.service_unit_id != null) {
    const { data: u } = await supabase.from("service_units").select("name").eq("id", resolved.service_unit_id)
      .maybeSingle();
    service_unit_name = String(u?.name || "");
  }

  const { data: fresh } = await supabase.from("admins").select("*").eq("id", resolved.id).maybeSingle();
  const token = await signAdminToken(Number(resolved.id), jwtSecret);
  const shaped = shapeAdminForClient((fresh || resolved) as Record<string, unknown>, service_unit_name);
  return { token, admin: shaped };
}

async function handleStartLogin(
  supabase: ReturnType<typeof createClient>,
  loginId: string,
  password: string,
  jwtSecret: string,
  req: Request,
) {
  const admin = await findAdminForLogin(supabase, loginId);
  if (!admin) throw new Error("Invalid credentials.");

  try {
    assertPasswordAndInviteGate(admin, password);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid credentials.";
    if (msg.includes("activated")) throw e;
    throw new Error("Invalid credentials.");
  }

  if (isRootSuperAdminRole(admin.role)) {
    return issueAdminSession(supabase, admin, jwtSecret, req, "Super Admin logged in");
  }

  const email = normText(admin.email).toLowerCase();
  if (!email) {
    throw new Error("This account has no email on file. Ask your Super Admin to add one before signing in.");
  }

  const ip = clientIp(req);
  const { challengeId, code } = await createLoginOtpChallenge(supabase, Number(admin.id), ip);

  if (isTotpEnabled(admin)) {
    return {
      step: "dual_verify_required",
      challenge_id: challengeId,
      email_masked: maskEmail(email),
      expires_in: LOGIN_OTP_EXPIRES_SEC,
      resend_after: 0,
      email_sent: false,
    };
  }

  const sent = await sendLoginOtpEmail(email, String(admin.full_name || ""), code);
  if (sent) {
    await supabase.from("admin_login_otp_challenges").update({
      otp_emailed_at: new Date().toISOString(),
    }).eq("id", challengeId);
  }

  await supabase.from("activity_logs").insert({
    admin_id: admin.id,
    admin_name: admin.full_name,
    action: sent ? "admin.login_otp_sent" : "admin.login_otp_send_failed",
    entity_type: "admin",
    entity_id: String(admin.id),
    description: sent
      ? "Login verification code emailed"
      : "Login verification code created but email delivery failed",
    ip_address: ip,
  });

  return {
    step: "otp_required",
    challenge_id: challengeId,
    email_masked: maskEmail(email),
    expires_in: LOGIN_OTP_EXPIRES_SEC,
    resend_after: LOGIN_OTP_RESEND_SEC,
    email_sent: sent,
    ...(sent
      ? {}
      : {
        message:
          "We could not email your code yet. Wait a moment, then tap Send code on the next screen.",
      }),
  };
}

async function handleVerifyOtp(
  supabase: ReturnType<typeof createClient>,
  challengeId: string,
  otp: string,
  jwtSecret: string,
  req: Request,
) {
  const adminId = await verifyLoginOtpChallenge(supabase, challengeId, otp);
  const { data: admin, error } = await supabase.from("admins").select("*").eq("id", adminId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!admin || Number(admin.is_active) !== 1) {
    throw new Error("This account is no longer active.");
  }

  return issueAdminSession(supabase, admin as AdminRow, jwtSecret, req, "Admin logged in (email code verified)");
}

async function handleVerifyDualOtp(
  supabase: ReturnType<typeof createClient>,
  challengeId: string,
  emailOtp: string,
  totp: string,
  jwtSecret: string,
  req: Request,
) {
  const adminId = await verifyDualLoginChallenge(
    supabase,
    challengeId,
    emailOtp,
    totp,
    (id, code) => verifyAdminTotp(supabase, id, code),
  );
  const { data: admin, error } = await supabase.from("admins").select("*").eq("id", adminId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!admin || Number(admin.is_active) !== 1) {
    throw new Error("This account is no longer active.");
  }
  if (!isTotpEnabled(admin as AdminRow)) {
    throw new Error("Authenticator is not enabled on this account.");
  }

  return issueAdminSession(
    supabase,
    admin as AdminRow,
    jwtSecret,
    req,
    "Admin logged in (email + authenticator verified)",
  );
}

async function handleSendOtp(
  supabase: ReturnType<typeof createClient>,
  challengeId: string,
  req: Request,
) {
  const { code, email_masked, adminEmail, fullName, adminId } = await sendLoginOtpForChallenge(
    supabase,
    challengeId,
  );
  const sent = await sendLoginOtpEmail(adminEmail, fullName, code);
  if (!sent) {
    throw new Error("Could not send your login code. Try again shortly.");
  }

  await supabase.from("activity_logs").insert({
    admin_id: adminId,
    admin_name: fullName,
    action: "admin.login_otp_sent",
    entity_type: "admin",
    entity_id: challengeId,
    description: "Login verification code emailed",
    ip_address: clientIp(req),
  });

  return {
    ok: true,
    email_masked,
    expires_in: LOGIN_OTP_EXPIRES_SEC,
    resend_after: LOGIN_OTP_RESEND_SEC,
  };
}

async function handleResendOtp(
  supabase: ReturnType<typeof createClient>,
  challengeId: string,
  req: Request,
) {
  const { code, email_masked, adminEmail, fullName, adminId } = await resendLoginOtpChallenge(
    supabase,
    challengeId,
  );
  const sent = await sendLoginOtpEmail(adminEmail, fullName, code);
  if (!sent) {
    throw new Error("Could not resend your login code. Try again shortly.");
  }

  await supabase.from("activity_logs").insert({
    admin_id: adminId,
    admin_name: fullName,
    action: "admin.login_otp_resent",
    entity_type: "admin",
    entity_id: challengeId,
    description: "Login verification code resent",
    ip_address: clientIp(req),
  });

  return {
    ok: true,
    email_masked,
    expires_in: LOGIN_OTP_EXPIRES_SEC,
    resend_after: LOGIN_OTP_RESEND_SEC,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const jwtSecret = requireEnv("ADMIN_JWT_SECRET");
    const supabaseUrl = requireEnv("SUPABASE_URL");
    const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

    const body = (await req.json()) as {
      op?: string;
      username?: string;
      email?: string;
      password?: string;
      challenge_id?: string;
      otp?: string;
      email_otp?: string;
      totp?: string;
    };

    const op = normText(body.op) || "startLogin";
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    if (op === "verifyOtp") {
      const challengeId = normText(body.challenge_id);
      const otp = normText(body.otp);
      if (!challengeId || !otp) return json(400, { error: "Missing challenge or code." });
      const session = await handleVerifyOtp(supabase, challengeId, otp, jwtSecret, req);
      return json(200, session);
    }

    if (op === "verifyDualOtp") {
      const challengeId = normText(body.challenge_id);
      const emailOtp = normText(body.email_otp || body.otp);
      const totp = normText(body.totp);
      if (!challengeId || !emailOtp || !totp) {
        return json(400, { error: "Email code and authenticator code are required." });
      }
      const session = await handleVerifyDualOtp(supabase, challengeId, emailOtp, totp, jwtSecret, req);
      return json(200, session);
    }

    if (op === "sendOtp") {
      const challengeId = normText(body.challenge_id);
      if (!challengeId) return json(400, { error: "Missing login session." });
      const result = await handleSendOtp(supabase, challengeId, req);
      return json(200, result);
    }

    if (op === "resendOtp") {
      const challengeId = normText(body.challenge_id);
      if (!challengeId) return json(400, { error: "Missing login session." });
      const result = await handleResendOtp(supabase, challengeId, req);
      return json(200, result);
    }

    if (op === "startLogin") {
      const loginId = normText(body.email || body.username).toLowerCase();
      const password = normText(body.password);
      if (!loginId || !password) return json(400, { error: "Email and password are required." });
      const result = await handleStartLogin(supabase, loginId, password, jwtSecret, req);
      return json(200, result);
    }

    return json(400, { error: "Unknown operation." });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected server error";
    const status = message === "Invalid credentials." ? 401 : 400;
    return json(status, { error: message });
  }
});
