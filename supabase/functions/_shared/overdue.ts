import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const OVERDUE_DAYS_MIN = 1;
export const OVERDUE_DAYS_MAX = 30;

export function clampOverdueDays(n: unknown, fallback = 3): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(OVERDUE_DAYS_MAX, Math.max(OVERDUE_DAYS_MIN, Math.round(v)));
}

export function normStatus(s: unknown): string {
  const x = String(s ?? "").trim().toLowerCase();
  if (x === "pending") return "new";
  return x || "new";
}

export function isOpenPipelineStatus(status: unknown): boolean {
  const st = normStatus(status);
  return st === "new" || st === "in_progress";
}

export type OverdueMeta = {
  isOverdue: boolean;
  daysOverdue: number;
  daysWaiting: number;
  thresholdDays: number;
};

export function computeOverdueMeta(
  submittedAt: unknown,
  thresholdDays: number,
  nowMs = Date.now(),
): OverdueMeta {
  const th = clampOverdueDays(thresholdDays);
  const t = new Date(String(submittedAt || "")).getTime();
  if (!Number.isFinite(t)) {
    return { isOverdue: false, daysOverdue: 0, daysWaiting: 0, thresholdDays: th };
  }
  const daysWaiting = Math.floor((nowMs - t) / 86400000);
  const isOverdue = daysWaiting > th;
  const daysOverdue = isOverdue ? daysWaiting - th : 0;
  return { isOverdue, daysOverdue, daysWaiting, thresholdDays: th };
}

export async function loadOverdueConfig(supabase: SupabaseClient) {
  const { data: settings } = await supabase.from("app_settings").select(
    "overdue_threshold_days,overdue_threshold_hours",
  ).eq("id", 1).maybeSingle();
  let globalDays = Number(settings?.overdue_threshold_days);
  if (!Number.isFinite(globalDays) || globalDays < 1) {
    const hrs = Number(settings?.overdue_threshold_hours ?? 72);
    globalDays = clampOverdueDays(Math.ceil(hrs / 24), 3);
  } else {
    globalDays = clampOverdueDays(globalDays, 3);
  }

  const { data: units } = await supabase.from("service_units").select("id,overdue_threshold_days");
  const unitThresholds = new Map<number, number | null>();
  for (const u of units || []) {
    const id = Number((u as { id: number }).id);
    const raw = (u as { overdue_threshold_days?: number | null }).overdue_threshold_days;
    unitThresholds.set(id, raw == null ? null : clampOverdueDays(raw, globalDays));
  }
  return { globalDays, unitThresholds };
}

export function thresholdDaysForRow(
  row: Record<string, unknown>,
  globalDays: number,
  unitThresholds: Map<number, number | null>,
): number {
  const unitId = Number(row.unit_id);
  if (!unitId || !unitThresholds.has(unitId)) return globalDays;
  const override = unitThresholds.get(unitId);
  return override == null ? globalDays : override;
}

export function enrichRowOverdue(
  row: Record<string, unknown>,
  globalDays: number,
  unitThresholds: Map<number, number | null>,
  nowMs = Date.now(),
): Record<string, unknown> {
  if (!isOpenPipelineStatus(row.status)) {
    return { ...row, days_overdue: 0, is_overdue: false };
  }
  const th = thresholdDaysForRow(row, globalDays, unitThresholds);
  const meta = computeOverdueMeta(row.submitted_at, th, nowMs);
  return {
    ...row,
    days_overdue: meta.daysOverdue,
    is_overdue: meta.isOverdue,
    overdue_threshold_days: meta.thresholdDays,
  };
}

async function trySendEmail(to: string, subject: string, html: string): Promise<void> {
  const key = Deno.env.get("RESEND_API_KEY") || "";
  const from = Deno.env.get("RESEND_FROM_EMAIL") || "";
  if (!key || !from || !to) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });
  } catch {
    /* optional */
  }
}

async function insertNotification(
  supabase: SupabaseClient,
  adminId: number,
  type: string,
  title: string,
  body: string,
  entityId: string,
) {
  await supabase.from("admin_notifications").insert({
    admin_id: adminId,
    type,
    title,
    body,
    entity_type: "registration",
    entity_id: entityId,
  });
}

let lastOverdueEscalationRunMs = 0;
const OVERDUE_ESCALATION_INTERVAL_MS = 5 * 60 * 1000;

/** Avoid scanning the full queue on every leader page load. */
export async function processOverdueEscalationsThrottled(supabase: SupabaseClient): Promise<void> {
  const now = Date.now();
  if (now - lastOverdueEscalationRunMs < OVERDUE_ESCALATION_INTERVAL_MS) return;
  lastOverdueEscalationRunMs = now;
  await processOverdueEscalations(supabase);
}

export async function processOverdueEscalations(supabase: SupabaseClient): Promise<void> {
  const { globalDays, unitThresholds } = await loadOverdueConfig(supabase);
  const now = Date.now();
  const { data: rows } = await supabase.from("registrations").select(
    "id,status,submitted_at,unit_id,sub_unit,branch_country,branch_state,satellite_site,first_name,surname",
  ).in("status", ["new", "in_progress"]).limit(5000);
  if (!rows?.length) return;

  const overdueRows = (rows as Record<string, unknown>[])
    .map((r) => enrichRowOverdue(r, globalDays, unitThresholds, now))
    .filter((r) => r.is_overdue);

  if (!overdueRows.length) return;

  const { data: admins } = await supabase.from("admins").select(
    "id,email,role,service_unit_id,sub_unit_name,branch_country,branch_state,satellite_site,is_active",
  ).eq("is_active", 1);
  const activeAdmins = (admins || []) as Record<string, unknown>[];

  for (const row of overdueRows) {
    const regId = String(row.id);
    const { data: esc } = await supabase.from("overdue_escalation").select("*").eq("registration_id", regId)
      .maybeSingle();
    const submittedMs = new Date(String(row.submitted_at || "")).getTime();
    const th = Number(row.overdue_threshold_days) || globalDays;
    const crossedAt = new Date(submittedMs + th * 86400000);

    if (!esc) {
      await supabase.from("overdue_escalation").insert({
        registration_id: regId,
        threshold_crossed_at: crossedAt.toISOString(),
      });
    }

    const { data: escRow } = await supabase.from("overdue_escalation").select("*").eq("registration_id", regId)
      .maybeSingle();
    if (!escRow) continue;
    const crossedMs = new Date(String(escRow.threshold_crossed_at || "")).getTime();
    const unitId = Number(row.unit_id);
    const subUnit = String(row.sub_unit || "").trim();
    const name = [row.first_name, row.surname].filter(Boolean).join(" ");

    const subLeaders = activeAdmins.filter(
      (a) =>
        String(a.role) === "sub_unit_leader" &&
        Number(a.service_unit_id) === unitId &&
        String(a.sub_unit_name || "").trim().toLowerCase() === subUnit.toLowerCase(),
    );

    if (!escRow.sub_notified_at && subLeaders.length) {
      const list = overdueRows
        .filter(
          (r) =>
            Number(r.unit_id) === unitId &&
            String(r.sub_unit || "").trim().toLowerCase() === subUnit.toLowerCase(),
        )
        .map((r) => `• ${[r.first_name, r.surname].filter(Boolean).join(" ")} (${r.days_overdue}d overdue)`)
        .join("\n");
      for (const leader of subLeaders) {
        const aid = Number(leader.id);
        const { data: dedup } = await supabase.from("overdue_notify_dedup").select("registration_id").eq(
          "registration_id",
          regId,
        ).eq("admin_id", aid).maybeSingle();
        if (dedup) continue;
        await supabase.from("overdue_notify_dedup").insert({ registration_id: regId, admin_id: aid });
        const title = "Overdue applications in your queue";
        const body = list || `• ${name} is overdue and needs action.`;
        await insertNotification(supabase, aid, "overdue_application", title, body, regId);
        const email = String(leader.email || "");
        if (email) {
          await trySendEmail(
            email,
            title,
            `<p>You have overdue applications in your sub-unit queue:</p><pre>${body}</pre>`,
          );
        }
      }
      await supabase.from("overdue_escalation").update({ sub_notified_at: new Date().toISOString() }).eq(
        "registration_id",
        regId,
      );
    }

    const hoursSinceCross = (now - crossedMs) / 3600000;
    if (hoursSinceCross >= 24 && !escRow.unit_escalated_at) {
      const unitLeaders = activeAdmins.filter(
        (a) => String(a.role) === "service_unit_leader" && Number(a.service_unit_id) === unitId,
      );
      for (const leader of unitLeaders) {
        const aid = Number(leader.id);
        const title = "Escalation: overdue application (24h)";
        const body =
          `${name} has been overdue more than 24 hours with no action. Sub-unit: ${subUnit || "—"}.`;
        await insertNotification(supabase, aid, "overdue_escalation", title, body, regId);
        const email = String(leader.email || "");
        if (email) await trySendEmail(email, title, `<p>${body}</p>`);
      }
      await supabase.from("overdue_escalation").update({ unit_escalated_at: new Date().toISOString() }).eq(
        "registration_id",
        regId,
      );
    }

    if (hoursSinceCross >= 48 && !escRow.satellite_escalated_at) {
      const cc = String(row.branch_country || "").toUpperCase();
      const st = String(row.branch_state || "").toUpperCase();
      const sat = String(row.satellite_site || "").trim();
      const pastors = activeAdmins.filter(
        (a) =>
          String(a.role) === "satellite_church_admin" &&
          String(a.branch_country || "").toUpperCase() === cc &&
          String(a.branch_state || "").toUpperCase() === st &&
          String(a.satellite_site || "").trim() === sat,
      );
      for (const pastor of pastors) {
        const aid = Number(pastor.id);
        const title = "Escalation: overdue application (48h)";
        const body = `${name} remains overdue after 48 hours with no resolution.`;
        await insertNotification(supabase, aid, "overdue_escalation", title, body, regId);
        const email = String(pastor.email || "");
        if (email) await trySendEmail(email, title, `<p>${body}</p>`);
      }
      await supabase.from("overdue_escalation").update({ satellite_escalated_at: new Date().toISOString() }).eq(
        "registration_id",
        regId,
      );
    }
  }
}

export async function clearOverdueEscalation(supabase: SupabaseClient, registrationId: string) {
  await supabase.from("overdue_escalation").delete().eq("registration_id", registrationId);
  await supabase.from("overdue_notify_dedup").delete().eq("registration_id", registrationId);
}
