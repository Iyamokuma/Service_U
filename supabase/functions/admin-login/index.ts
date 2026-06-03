import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { signAdminToken } from "../_shared/jwt.ts";
import { ensureCountryAdminHeadquarters } from "../_shared/admin_ops.ts";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const jwtSecret = requireEnv("ADMIN_JWT_SECRET");
    const supabaseUrl = requireEnv("SUPABASE_URL");
    const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

    const body = (await req.json()) as { username?: string; password?: string };
    const username = normText(body?.username).toLowerCase();
    const password = normText(body?.password);
    if (!username || !password) return json(400, { error: "Username and password are required." });

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const { data: rows, error } = await supabase.from("admins").select("*").eq("is_active", 1);
    if (error) return json(500, { error: error.message });

    const admin = (rows || []).find(
      (a) =>
        normText(a.username).toLowerCase() === username ||
        normText(a.email).toLowerCase() === username,
    );
    const storedPassword = normalizeAdminPassword(admin?.password);
    if (!admin || !storedPassword || storedPassword !== password) {
      return json(401, { error: "Invalid credentials." });
    }

    const now = new Date().toISOString();
    await supabase.from("admins").update({ last_login: now }).eq("id", admin.id);

    const resolved = await ensureCountryAdminHeadquarters(supabase, admin as Record<string, unknown>);

    await supabase.from("activity_logs").insert({
      admin_id: resolved.id,
      admin_name: resolved.full_name,
      action: "admin.login",
      entity_type: "admin",
      entity_id: String(resolved.id),
      description: "Admin logged in",
      ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "",
    });

    let service_unit_name = "";
    if (resolved.service_unit_id != null) {
      const { data: u } = await supabase.from("service_units").select("name").eq("id", resolved.service_unit_id).maybeSingle();
      service_unit_name = String(u?.name || "");
    }

    const token = await signAdminToken(Number(resolved.id), jwtSecret);

    const shaped = {
      id: resolved.id,
      full_name: resolved.full_name,
      username: resolved.username,
      email: resolved.email,
      role: resolved.role,
      service_unit_id: resolved.service_unit_id,
      sub_unit_name: resolved.sub_unit_name || "",
      branch_country: resolved.branch_country ?? "",
      branch_state: resolved.branch_state ?? "",
      satellite_site: resolved.satellite_site ?? "",
      service_unit_name,
    };

    return json(200, { token, admin: shaped });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected server error";
    return json(500, { error: message });
  }
});
