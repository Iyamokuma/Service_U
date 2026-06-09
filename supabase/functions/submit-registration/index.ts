import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  branchCodesFromChurchId,
  canonicalizeRegistrationBranch,
} from "../_shared/location_directory.ts";
import {
  assertRegistrationIdentityAvailable,
  registrationIdentityColumns,
  registrationIdentityConflictMessage,
} from "../_shared/registration_identity.ts";

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

function requireEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const supabaseUrl = requireEnv("SUPABASE_URL");
    const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    const body = (await req.json()) as Record<string, unknown>;

    const row = {
      first_name: String(body.first_name ?? "").trim(),
      surname: String(body.surname ?? "").trim(),
      other_names: String(body.other_names ?? "").trim() || null,
      dob_month: String(body.dob_month ?? ""),
      dob_day: String(body.dob_day ?? ""),
      dob_year: String(body.dob_year ?? ""),
      sex: String(body.sex ?? ""),
      marital_status: String(body.marital_status ?? ""),
      nationality: String(body.nationality ?? ""),
      address: String(body.address ?? ""),
      bus_stop: String(body.bus_stop ?? ""),
      branch_country: String(body.branch_country ?? "").trim().toUpperCase() || null,
      branch_state: String(body.branch_state ?? "").trim().toUpperCase() || null,
      satellite_site: String(body.satellite_site ?? "").trim(),
      phone1: String(body.phone1 ?? "").trim(),
      phone2: String(body.phone2 ?? "").trim() || null,
      email: String(body.email ?? "").trim() || null,
      workplace: String(body.workplace ?? "").trim() || null,
      tithe_card: String(body.tithe_card ?? "").trim() || null,
      homecell: String(body.homecell ?? "").trim() || null,
      joined_church_month: String(body.joined_church_month ?? ""),
      joined_church_year: String(body.joined_church_year ?? ""),
      born_again: String(body.born_again ?? ""),
      born_again_year: String(body.born_again_year ?? ""),
      foundation: String(body.foundation ?? ""),
      foundation_month: String(body.foundation_month ?? ""),
      foundation_year: String(body.foundation_year ?? ""),
      baptised: String(body.baptised ?? ""),
      baptised_month: String(body.baptised_month ?? ""),
      baptised_year: String(body.baptised_year ?? ""),
      wolbi: String(body.wolbi ?? ""),
      wolbi_month: String(body.wolbi_month ?? ""),
      wolbi_year: String(body.wolbi_year ?? ""),
      wolbi_level: String(body.wolbi_level ?? ""),
      unit_id: body.unit_id != null && body.unit_id !== "" ? Number(body.unit_id) : null,
      unit_name: String(body.unit_name ?? ""),
      sub_unit: String(body.sub_unit ?? ""),
      status: "new",
      notes: "",
      submitted_at: String(body.submitted_at ?? new Date().toISOString()),
      photo_path: String(body.photo_path ?? ""),
    };

    if (!row.first_name || !row.surname || !row.phone1) {
      return json(400, { error: "Missing required fields (name, phone)." });
    }
    const churchId = body.church_id != null && body.church_id !== "" ? Number(body.church_id) : null;
    if (!Number.isFinite(churchId) || churchId! <= 0) {
      return json(400, { error: "Church / branch selection is required." });
    }
    const fromChurch = await branchCodesFromChurchId(supabase, churchId!);
    if (!fromChurch) return json(400, { error: "Invalid church / branch selection." });
    row.branch_country = fromChurch.branch_country;
    row.branch_state = fromChurch.branch_state;
    row.satellite_site = fromChurch.satellite_site;

    if (!row.branch_country || !row.branch_state) {
      return json(400, { error: "Branch country and state are required." });
    }

    const canonical = await canonicalizeRegistrationBranch(
      supabase,
      String(row.branch_country),
      String(row.branch_state),
    );
    row.branch_country = canonical.branch_country;
    row.branch_state = canonical.branch_state;

    await assertRegistrationIdentityAvailable(
      supabase,
      String(row.phone1),
      row.phone2 != null ? String(row.phone2) : null,
      row.email != null ? String(row.email) : null,
    );

    const identity = registrationIdentityColumns(
      String(row.phone1),
      row.phone2 != null ? String(row.phone2) : null,
      row.email != null ? String(row.email) : null,
    );

    const { data, error } = await supabase
      .from("registrations")
      .insert({ ...row, ...identity })
      .select("id")
      .maybeSingle();
    if (error) {
      const friendly = registrationIdentityConflictMessage(error);
      return json(400, { error: friendly || error.message });
    }

    return json(200, { ok: true, id: data?.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected server error";
    return json(500, { error: message });
  }
});
