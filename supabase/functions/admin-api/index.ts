import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { dispatchAdminOp } from "../_shared/admin_ops.ts";
import { verifyAdminToken } from "../_shared/jwt.ts";

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

function requireEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

function readAdminJwt(req: Request): string {
  const h = req.headers.get("x-admin-jwt")?.trim() || "";
  if (h.toLowerCase().startsWith("bearer ")) return h.slice(7).trim();
  return h;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const jwtSecret = requireEnv("ADMIN_JWT_SECRET");
    const supabaseUrl = requireEnv("SUPABASE_URL");
    const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

    const adminJwt = readAdminJwt(req);
    if (!adminJwt) return json(401, { error: "Unauthorized" });

    let payload: { sub: string };
    try {
      payload = await verifyAdminToken(adminJwt, jwtSecret);
    } catch {
      return json(401, { error: "Unauthorized" });
    }

    const adminId = Number(payload.sub);
    if (!Number.isFinite(adminId)) return json(401, { error: "Unauthorized" });

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const { data: adminRow, error: adminErr } = await supabase.from("admins").select("*").eq("id", adminId).single();
    if (adminErr || !adminRow || Number(adminRow.is_active ?? 1) !== 1) {
      return json(401, { error: "Unauthorized" });
    }

    const envelope = (await req.json()) as { op?: string; params?: Record<string, unknown> };
    const op = String(envelope?.op || "");
    if (!op) return json(400, { error: "Missing op." });

    const params = envelope.params || {};
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "";

    const result = await dispatchAdminOp(supabase, op, params, { admin: adminRow, ip });
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected server error";
    const status = message === "Unauthorized" ? 401 : 500;
    return json(status, { error: message });
  }
});
