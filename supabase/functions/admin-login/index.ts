import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { signAdminToken } from "../_shared/jwt.ts";

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
    if (!admin || String(admin.password ?? "") !== password) {
      return json(401, { error: "Invalid credentials." });
    }

    const now = new Date().toISOString();
    await supabase.from("admins").update({ last_login: now }).eq("id", admin.id);

    await supabase.from("activity_logs").insert({
      admin_id: admin.id,
      admin_name: admin.full_name,
      action: "admin.login",
      entity_type: "admin",
      entity_id: String(admin.id),
      description: "Admin logged in",
      ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "",
    });

    let service_unit_name = "";
    if (admin.service_unit_id != null) {
      const { data: u } = await supabase.from("service_units").select("name").eq("id", admin.service_unit_id).maybeSingle();
      service_unit_name = String(u?.name || "");
    }

    const token = await signAdminToken(Number(admin.id), jwtSecret);

    const shaped = {
      id: admin.id,
      full_name: admin.full_name,
      username: admin.username,
      email: admin.email,
      role: admin.role,
      service_unit_id: admin.service_unit_id,
      sub_unit_name: admin.sub_unit_name || "",
      branch_country: admin.branch_country ?? "",
      branch_state: admin.branch_state ?? "",
      satellite_site: admin.satellite_site ?? "",
      service_unit_name,
    };

    return json(200, { token, admin: shaped });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected server error";
    return json(500, { error: message });
  }
});
