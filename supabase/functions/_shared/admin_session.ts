import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ensureCountryAdminHeadquarters } from "./admin_ops.ts";
import { shapeAdminForClient } from "./admin_invite.ts";
import { isRootSuperAdminRole } from "./admin_totp.ts";
import { signAdminToken } from "./jwt.ts";

type AdminRow = Record<string, unknown>;

async function touchDashboardActivated(
  supabase: SupabaseClient,
  admin: AdminRow,
) {
  if (isRootSuperAdminRole(admin.role)) return;
  if (admin.dashboard_activated_at) return;
  await supabase
    .from("admins")
    .update({ dashboard_activated_at: new Date().toISOString() })
    .eq("id", admin.id);
}

/** Issue a signed JWT and shaped admin profile after successful authentication. */
export async function issueAdminSession(
  supabase: SupabaseClient,
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
    ip_address: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      "",
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
