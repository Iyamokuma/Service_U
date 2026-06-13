import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { runScheduledAnnouncements } from "../_shared/admin_ops.ts";
import { processOverdueEscalations } from "../_shared/overdue.ts";
import { processRegistrationLeaderDigests } from "../_shared/registration_leader_notify.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return json(500, { error: "Server not configured." });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    const announcements = await runScheduledAnnouncements(supabase);
    await processOverdueEscalations(supabase);
    await processRegistrationLeaderDigests(supabase);

    return json(200, { ok: true, announcements_sent: announcements });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected server error";
    return json(500, { error: message });
  }
});
