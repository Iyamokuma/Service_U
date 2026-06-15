import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { issueAdminSession } from "../_shared/admin_session.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

  try {
    const supabaseUrl = requireEnv("SUPABASE_URL");
    const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

    const body = (await req.json()) as {
      op?: string;
      token?: string;
      password?: string;
    };
    const op = norm(body.op);
    const token = norm(body.token);
    if (!op || !token) return json(400, { error: "Missing op or token." });

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    if (op === "validateInvite") {
      const { data: row, error } = await supabase
        .from("admins")
        .select("id,full_name,email,role,invite_expires_at,must_change_password,invite_token,is_active")
        .eq("invite_token", token)
        .maybeSingle();
      if (error) return json(500, { error: error.message });
      if (!row || Number(row.is_active) !== 1) {
        return json(400, { error: "This invitation link is invalid or has already been used." });
      }
      const expires = row.invite_expires_at ? new Date(String(row.invite_expires_at)).getTime() : 0;
      if (!expires || expires < Date.now()) {
        return json(400, { error: "This invitation link has expired. Ask your Super Admin to resend it." });
      }
      return json(200, {
        full_name: row.full_name,
        email: row.email,
        role: row.role,
        expires_at: row.invite_expires_at,
      });
    }

    if (op === "completeInvite") {
      const password = normalizeAdminPassword(body.password);
      assertAdminPasswordFormat(password);

      const { data: row, error } = await supabase
        .from("admins")
        .select("*")
        .eq("invite_token", token)
        .maybeSingle();
      if (error) return json(500, { error: error.message });
      if (!row || Number(row.is_active) !== 1) {
        return json(400, { error: "This invitation link is invalid or has already been used." });
      }
      const expires = row.invite_expires_at ? new Date(String(row.invite_expires_at)).getTime() : 0;
      if (!expires || expires < Date.now()) {
        return json(400, { error: "This invitation link has expired. Ask your Super Admin to resend it." });
      }

      const { error: updErr } = await supabase
        .from("admins")
        .update({
          password,
          must_change_password: 0,
          invite_token: null,
          invite_expires_at: null,
          totp_enabled: false,
          totp_secret_encrypted: null,
          totp_enrolled_at: null,
          dashboard_activated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      if (updErr) return json(500, { error: updErr.message });

      const { data: fresh, error: freshErr } = await supabase
        .from("admins")
        .select("*")
        .eq("id", row.id)
        .maybeSingle();
      if (freshErr) return json(500, { error: freshErr.message });
      if (!fresh) return json(500, { error: "Account could not be loaded after activation." });

      const jwtSecret = requireEnv("ADMIN_JWT_SECRET");
      const session = await issueAdminSession(
        supabase,
        fresh as Record<string, unknown>,
        jwtSecret,
        req,
        "Completed invite and signed in",
      );

      await supabase.from("activity_logs").insert({
        admin_id: fresh.id,
        admin_name: fresh.full_name,
        action: "admin.invite_complete",
        entity_type: "admin",
        entity_id: String(fresh.id),
        description: "Completed invite and set password",
        ip_address: clientIp(req),
      });

      return json(200, {
        ok: true,
        email: norm(fresh.email).toLowerCase(),
        token: session.token,
        admin: session.admin,
      });
    }

    return json(400, { error: "Unknown op." });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected server error";
    return json(500, { error: message });
  }
});
