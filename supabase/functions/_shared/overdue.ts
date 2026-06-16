import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { insertAdminNotification, systemNotificationSender } from "./admin_notifications_helper.ts";
import { getResendFromAddress } from "./admin_invite.ts";
import { sendHtmlEmail } from "./resend_mail.ts";

export const OVERDUE_DAYS_MIN = 1;
export const OVERDUE_DAYS_MAX = 30;
export const CRITICAL_DAYS_MIN = 1;
export const CRITICAL_DAYS_MAX = 90;
export const CRITICAL_DAYS_DEFAULT = 30;

export function clampOverdueDays(n: unknown, fallback = 3): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(OVERDUE_DAYS_MAX, Math.max(OVERDUE_DAYS_MIN, Math.round(v)));
}

export function clampCriticalDays(n: unknown, fallback = CRITICAL_DAYS_DEFAULT): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(CRITICAL_DAYS_MAX, Math.max(CRITICAL_DAYS_MIN, Math.round(v)));
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
  isCritical: boolean;
  daysOverdue: number;
  daysWaiting: number;
  thresholdDays: number;
  criticalThresholdDays: number;
};

export function computeOverdueMeta(
  submittedAt: unknown,
  thresholdDays: number,
  criticalThresholdDays: number,
  nowMs = Date.now(),
): OverdueMeta {
  const th = clampOverdueDays(thresholdDays);
  const crit = clampCriticalDays(criticalThresholdDays);
  const t = new Date(String(submittedAt || "")).getTime();
  if (!Number.isFinite(t)) {
    return {
      isOverdue: false,
      isCritical: false,
      daysOverdue: 0,
      daysWaiting: 0,
      thresholdDays: th,
      criticalThresholdDays: crit,
    };
  }
  const daysWaiting = Math.floor((nowMs - t) / 86400000);
  const isOverdue = daysWaiting > th;
  const daysOverdue = isOverdue ? daysWaiting - th : 0;
  const isCritical = isOverdue && daysOverdue >= crit;
  return { isOverdue, isCritical, daysOverdue, daysWaiting, thresholdDays: th, criticalThresholdDays: crit };
}

export async function loadOverdueConfig(supabase: SupabaseClient) {
  const { data: settings } = await supabase.from("app_settings").select(
    "overdue_threshold_days,overdue_threshold_hours,critical_threshold_days",
  ).eq("id", 1).maybeSingle();
  let globalDays = Number(settings?.overdue_threshold_days);
  if (!Number.isFinite(globalDays) || globalDays < 1) {
    const hrs = Number(settings?.overdue_threshold_hours ?? 72);
    globalDays = clampOverdueDays(Math.ceil(hrs / 24), 3);
  } else {
    globalDays = clampOverdueDays(globalDays, 3);
  }
  const criticalDays = clampCriticalDays(settings?.critical_threshold_days, CRITICAL_DAYS_DEFAULT);

  const { data: units } = await supabase.from("service_units").select("id,overdue_threshold_days");
  const unitThresholds = new Map<number, number | null>();
  for (const u of units || []) {
    const id = Number((u as { id: number }).id);
    const raw = (u as { overdue_threshold_days?: number | null }).overdue_threshold_days;
    unitThresholds.set(id, raw == null ? null : clampOverdueDays(raw, globalDays));
  }
  return { globalDays, unitThresholds, criticalDays };
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
  criticalDays: number,
  nowMs = Date.now(),
): Record<string, unknown> {
  if (!isOpenPipelineStatus(row.status)) {
    return {
      ...row,
      days_overdue: 0,
      is_overdue: false,
      is_critical: false,
      overdue_threshold_days: globalDays,
      critical_threshold_days: criticalDays,
    };
  }
  const th = thresholdDaysForRow(row, globalDays, unitThresholds);
  const meta = computeOverdueMeta(row.submitted_at, th, criticalDays, nowMs);
  return {
    ...row,
    days_overdue: meta.daysOverdue,
    is_overdue: meta.isOverdue,
    is_critical: meta.isCritical,
    overdue_threshold_days: meta.thresholdDays,
    critical_threshold_days: meta.criticalThresholdDays,
  };
}

async function insertNotification(
  supabase: SupabaseClient,
  adminId: number,
  type: string,
  title: string,
  body: string,
  entityId: string,
) {
  await insertAdminNotification(supabase, {
    admin_id: adminId,
    type,
    title,
    body,
    entity_type: "registration",
    entity_id: entityId,
    sender: systemNotificationSender("Intake queue"),
  });
}

function regName(row: Record<string, unknown>): string {
  return [row.first_name, row.surname].filter(Boolean).join(" ").trim() || "Applicant";
}

function subUnitKey(unitId: number, subUnit: string): string {
  return `${unitId}::${subUnit.trim().toLowerCase()}`;
}

let lastOverdueEscalationRunMs = 0;
const OVERDUE_ESCALATION_INTERVAL_MS = 5 * 60 * 1000;

export async function processOverdueEscalationsThrottled(supabase: SupabaseClient): Promise<void> {
  const now = Date.now();
  if (now - lastOverdueEscalationRunMs < OVERDUE_ESCALATION_INTERVAL_MS) return;
  lastOverdueEscalationRunMs = now;
  await processOverdueEscalations(supabase);
}

export async function processOverdueEscalations(supabase: SupabaseClient): Promise<void> {
  const { globalDays, unitThresholds, criticalDays } = await loadOverdueConfig(supabase);
  const now = Date.now();
  const { data: rows } = await supabase.from("registrations").select(
    "id,status,submitted_at,unit_id,sub_unit,branch_country,branch_state,satellite_site,first_name,surname,unit_name",
  ).in("status", ["new", "in_progress"]).limit(5000);
  if (!rows?.length) return;

  const enriched = (rows as Record<string, unknown>[])
    .map((r) => enrichRowOverdue(r, globalDays, unitThresholds, criticalDays, now));
  const overdueRows = enriched.filter((r) => r.is_overdue);
  if (!overdueRows.length) return;

  const { data: admins } = await supabase.from("admins").select(
    "id,email,role,service_unit_id,sub_unit_name,branch_country,branch_state,satellite_site,is_active",
  ).eq("is_active", 1);
  const activeAdmins = (admins || []) as Record<string, unknown>[];

  // Ensure escalation rows exist.
  for (const row of overdueRows) {
    const regId = String(row.id);
    const { data: esc } = await supabase.from("overdue_escalation").select("registration_id").eq(
      "registration_id",
      regId,
    ).maybeSingle();
    if (!esc) {
      const submittedMs = new Date(String(row.submitted_at || "")).getTime();
      const th = Number(row.overdue_threshold_days) || globalDays;
      await supabase.from("overdue_escalation").insert({
        registration_id: regId,
        threshold_crossed_at: new Date(submittedMs + th * 86400000).toISOString(),
      });
    }
  }

  const { data: escRows } = await supabase.from("overdue_escalation").select("*").in(
    "registration_id",
    overdueRows.map((r) => String(r.id)),
  );
  const escByReg = new Map((escRows || []).map((e) => [String((e as { registration_id: string }).registration_id), e]));

  // --- Batched overdue emails to sub-unit leaders ---
  const overdueBySubUnit = new Map<string, Record<string, unknown>[]>();
  for (const row of overdueRows) {
    const unitId = Number(row.unit_id);
    const subUnit = String(row.sub_unit || "").trim();
    if (!unitId || !subUnit) continue;
    const key = subUnitKey(unitId, subUnit);
    if (!overdueBySubUnit.has(key)) overdueBySubUnit.set(key, []);
    overdueBySubUnit.get(key)!.push(row);
  }

  for (const [key, group] of overdueBySubUnit) {
    const [unitIdStr, subLower] = key.split("::");
    const unitId = Number(unitIdStr);
    const needsNotify = group.some((r) => {
      const esc = escByReg.get(String(r.id)) as { sub_notified_at?: string | null } | undefined;
      return !esc?.sub_notified_at;
    });
    if (!needsNotify) continue;

    const subLeaders = activeAdmins.filter(
      (a) =>
        String(a.role) === "sub_unit_leader" &&
        Number(a.service_unit_id) === unitId &&
        String(a.sub_unit_name || "").trim().toLowerCase() === subLower,
    );
    if (!subLeaders.length) continue;

    const listText = group.map((r) => `• ${regName(r)} (${Number(r.days_overdue) || 0}d overdue)`).join("\n");
    const listHtml = group.map((r) =>
      `<li><strong>${regName(r)}</strong> — ${Number(r.days_overdue) || 0} day(s) overdue</li>`
    ).join("");
    const title = group.length === 1
      ? "Overdue application in your queue"
      : `${group.length} overdue applications in your queue`;
    const body = listText;

    for (const leader of subLeaders) {
      const aid = Number(leader.id);
      await insertNotification(supabase, aid, "overdue_application", title, body, String(group[0]?.id || ""));
      const email = String(leader.email || "");
      if (email) {
        await sendHtmlEmail(
          email,
          title,
          `<p>You have overdue applications in your sub-unit queue:</p><ul>${listHtml}</ul>`,
        );
      }
    }

    const regIds = group.map((r) => String(r.id));
    await supabase.from("overdue_escalation").update({ sub_notified_at: new Date().toISOString() }).in(
      "registration_id",
      regIds,
    );
  }

  // --- Batched critical emails to service unit leaders ---
  const criticalRows = overdueRows.filter((r) => r.is_critical);
  const criticalByUnit = new Map<number, Record<string, unknown>[]>();
  for (const row of criticalRows) {
    const unitId = Number(row.unit_id);
    if (!unitId) continue;
    const esc = escByReg.get(String(row.id)) as { critical_notified_at?: string | null } | undefined;
    if (esc?.critical_notified_at) continue;
    if (!criticalByUnit.has(unitId)) criticalByUnit.set(unitId, []);
    criticalByUnit.get(unitId)!.push(row);
  }

  for (const [unitId, group] of criticalByUnit) {
    const unitLeaders = activeAdmins.filter(
      (a) => String(a.role) === "service_unit_leader" && Number(a.service_unit_id) === unitId,
    );
    if (!unitLeaders.length) continue;

    const listText = group.map((r) =>
      `• ${regName(r)} (${Number(r.days_overdue) || 0}d overdue, sub-unit: ${String(r.sub_unit || "—")})`
    ).join("\n");
    const listHtml = group.map((r) =>
      `<li><strong>${regName(r)}</strong> — ${Number(r.days_overdue) || 0} day(s) overdue (${String(r.sub_unit || "—")})</li>`
    ).join("");
    const title = group.length === 1
      ? "Critical: overdue application needs action"
      : `Critical: ${group.length} overdue applications need action`;
    const body = `${listText}\n\nThese records have exceeded the critical threshold (${criticalDays} days overdue).`;

    for (const leader of unitLeaders) {
      const aid = Number(leader.id);
      await insertNotification(supabase, aid, "overdue_critical", title, body, String(group[0]?.id || ""));
      const email = String(leader.email || "");
      if (email) {
        await sendHtmlEmail(
          email,
          title,
          `<p>The following application${group.length === 1 ? "" : "s"} ${group.length === 1 ? "has" : "have"} reached the <strong>critical</strong> threshold (${criticalDays} days overdue):</p><ul>${listHtml}</ul><p>Please ensure sub-unit leaders take action promptly.</p>`,
        );
      }
    }

    const regIds = group.map((r) => String(r.id));
    await supabase.from("overdue_escalation").update({ critical_notified_at: new Date().toISOString() }).in(
      "registration_id",
      regIds,
    );
  }
}

export async function clearOverdueEscalation(supabase: SupabaseClient, registrationId: string) {
  await supabase.from("overdue_escalation").delete().eq("registration_id", registrationId);
  await supabase.from("overdue_notify_dedup").delete().eq("registration_id", registrationId);
}
