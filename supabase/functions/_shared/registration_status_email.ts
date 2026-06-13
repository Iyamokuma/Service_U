import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { applicantDisplayName, renderTemplate, sendHtmlEmail } from "./resend_mail.ts";
import { normStatus } from "./overdue.ts";

function norm(s: unknown): string {
  return String(s ?? "").trim();
}

type TemplateKey = "approved" | "rejected" | "waitlisted";

function templateKeyForStatus(status: string): TemplateKey | null {
  const st = normStatus(status);
  if (st === "accepted") return "approved";
  if (st === "rejected") return "rejected";
  if (st === "in_progress") return "waitlisted";
  return null;
}

const DEFAULT_TEMPLATES: Record<TemplateKey, string> = {
  approved: "Hello {{name}}, your registration to join {{unit}} has been approved.",
  rejected: "Hello {{name}}, your registration to join {{unit}} was not approved at this time.",
  waitlisted: "Hello {{name}}, your registration to join {{unit}} is currently waitlisted.",
};

const SUBJECTS: Record<TemplateKey, string> = {
  approved: "Your service unit registration was approved",
  rejected: "Update on your service unit registration",
  waitlisted: "Your service unit registration is waitlisted",
};

/** Send applicant email when queue status changes (accepted / rejected / in progress). */
export async function sendRegistrationStatusEmail(
  supabase: SupabaseClient,
  row: Record<string, unknown>,
  nextStatus: string,
): Promise<boolean> {
  const email = norm(row.email).toLowerCase();
  if (!email) return false;

  const key = templateKeyForStatus(nextStatus);
  if (!key) return false;

  const { data: settings } = await supabase.from("app_settings").select("templates").eq("id", 1).maybeSingle();
  const templates = (settings?.templates && typeof settings.templates === "object")
    ? settings.templates as Record<string, unknown>
    : {};
  const rawTemplate = norm(templates[key]) || DEFAULT_TEMPLATES[key];

  const name = applicantDisplayName(String(row.first_name || ""), String(row.surname || ""));
  const unit = norm(row.unit_name) || "your service unit";
  const sub = norm(row.sub_unit);
  const unitLabel = sub ? `${unit} (${sub})` : unit;

  const bodyText = renderTemplate(rawTemplate, { name, unit: unitLabel });
  const html = `<p>${bodyText.replace(/\n/g, "</p><p>")}</p>`;

  return sendHtmlEmail(email, SUBJECTS[key], html);
}
