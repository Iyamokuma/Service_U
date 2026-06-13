import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendHtmlEmail } from "./resend_mail.ts";

function norm(s: unknown): string {
  return String(s ?? "").trim();
}

function regName(row: Record<string, unknown>): string {
  return [row.first_name, row.surname].filter(Boolean).join(" ").trim() || "Applicant";
}

/** Queue a new registration for batched sub-unit leader notification. */
export async function queueSubUnitLeaderNotifications(
  supabase: SupabaseClient,
  registration: Record<string, unknown>,
): Promise<void> {
  const unitId = Number(registration.unit_id);
  const subUnit = norm(registration.sub_unit);
  if (!unitId || !subUnit) return;

  const { data: leaders } = await supabase.from("admins").select("id,email,sub_unit_name").eq(
    "role",
    "sub_unit_leader",
  ).eq("service_unit_id", unitId).eq("is_active", 1);

  const regId = String(registration.id || "");
  if (!regId) return;

  for (const leader of leaders || []) {
    const adminId = Number((leader as { id: number }).id);
    if (!Number.isFinite(adminId)) continue;
    const subUnitName = norm((leader as { sub_unit_name?: string }).sub_unit_name);
    if (subUnitName.toLowerCase() !== subUnit.toLowerCase()) continue;
    await supabase.from("registration_notify_queue").upsert(
      { registration_id: regId, admin_id: adminId, notified_at: null },
      { onConflict: "registration_id,admin_id" },
    );
  }
}

/** Send batched digest emails to sub-unit leaders for pending new registrations. */
export async function processRegistrationLeaderDigests(supabase: SupabaseClient): Promise<void> {
  const { data: pending } = await supabase.from("registration_notify_queue").select(
    "id,registration_id,admin_id",
  ).is("notified_at", null).limit(500);
  if (!pending?.length) return;

  const byAdmin = new Map<number, string[]>();
  for (const row of pending) {
    const aid = Number((row as { admin_id: number }).admin_id);
    const rid = String((row as { registration_id: string }).registration_id);
    if (!byAdmin.has(aid)) byAdmin.set(aid, []);
    byAdmin.get(aid)!.push(rid);
  }

  for (const [adminId, regIds] of byAdmin) {
    const uniqueIds = [...new Set(regIds)];
    const { data: admin } = await supabase.from("admins").select("id,email,full_name,sub_unit_name").eq(
      "id",
      adminId,
    ).maybeSingle();
    const email = norm((admin as { email?: string } | null)?.email).toLowerCase();
    if (!email) {
      await supabase.from("registration_notify_queue").update({ notified_at: new Date().toISOString() }).in(
        "registration_id",
        uniqueIds,
      ).eq("admin_id", adminId).is("notified_at", null);
      continue;
    }

    const { data: regs } = await supabase.from("registrations").select(
      "id,first_name,surname,unit_name,sub_unit,submitted_at",
    ).in("id", uniqueIds);

    const items = (regs || []) as Record<string, unknown>[];
    if (!items.length) {
      await supabase.from("registration_notify_queue").update({ notified_at: new Date().toISOString() }).in(
        "registration_id",
        uniqueIds,
      ).eq("admin_id", adminId).is("notified_at", null);
      continue;
    }

    const subUnit = norm((admin as { sub_unit_name?: string })?.sub_unit_name) || "your sub-unit";
    const listHtml = items.map((r) => {
      const when = r.submitted_at ? new Date(String(r.submitted_at)).toLocaleDateString() : "";
      return `<li><strong>${regName(r)}</strong> — ${norm(r.unit_name) || "Unit"}${when ? ` (${when})` : ""}</li>`;
    }).join("");

    const title = items.length === 1
      ? "New service unit registration in your queue"
      : `${items.length} new service unit registrations in your queue`;

    const html = `
      <p>Hello ${norm((admin as { full_name?: string })?.full_name) || "there"},</p>
      <p>The following application${items.length === 1 ? "" : "s"} ${items.length === 1 ? "has" : "have"} been submitted for <strong>${subUnit}</strong>:</p>
      <ul>${listHtml}</ul>
      <p>Please sign in to the admin dashboard to review.</p>
    `;

    await sendHtmlEmail(email, title, html);

    await supabase.from("admin_notifications").insert({
      admin_id: adminId,
      type: "new_registration",
      title,
      body: items.map((r) => regName(r)).join(", "),
      entity_type: "registration",
      entity_id: String(items[0]?.id || ""),
    });

    await supabase.from("registration_notify_queue").update({ notified_at: new Date().toISOString() }).in(
      "registration_id",
      uniqueIds,
    ).eq("admin_id", adminId).is("notified_at", null);
  }
}
