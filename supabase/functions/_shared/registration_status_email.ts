import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { formatOrgSubject, getOrgName, sendEmail, wrapEmailHtml } from "./email_delivery.ts";
import { applicantDisplayName, renderTemplate } from "./resend_mail.ts";
import { normStatus } from "./overdue.ts";

function norm(s: unknown): string {
  return String(s ?? "").trim();
}

type TemplateKey = "approved" | "rejected";

function templateKeyForStatus(status: string): TemplateKey | null {
  const st = normStatus(status);
  if (st === "accepted") return "approved";
  if (st === "rejected") return "rejected";
  return null;
}

const DEFAULT_TEMPLATES: Record<TemplateKey, string> = {
  approved:
    "Hello {{name}},\n\nGood news — your registration to join the {{unit}} department has been approved.\n\nA coordinator from {{unit}} will contact you shortly with next steps.\n\nGod bless you.",
  rejected:
    "Hello {{name}},\n\nThank you for your interest in serving with the {{unit}} department. After review, your registration was not approved at this time.\n\nIf you have questions, please contact your church coordinator.",
};

const SUBJECTS: Record<TemplateKey, string> = {
  approved: "Your service unit application was approved",
  rejected: "Update on your service unit application",
};

const PREVIEWS: Record<TemplateKey, string> = {
  approved: "Your application has been approved. A coordinator will contact you shortly.",
  rejected: "An update on your service unit registration application.",
};

/** Send applicant email when an admin approves or rejects (accepted / rejected only). */
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
  const unit = norm(row.unit_name) || "Service Unit";
  const sub = norm(row.sub_unit);
  const department = sub ? `${unit} (${sub})` : unit;

  const bodyText = renderTemplate(rawTemplate, { name, unit: department });
  const paragraphs = bodyText.split(/\n\n+/).map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("");
  const bodyHtml = `${paragraphs}<p style="color:#64748b;font-size:14px;">${getOrgName()}</p>`;

  const html = wrapEmailHtml({
    title: key === "approved" ? "Application approved" : "Application update",
    previewText: PREVIEWS[key],
    bodyHtml,
  });

  return sendEmail({
    to: email,
    subject: formatOrgSubject(SUBJECTS[key]),
    html,
    tags: [key === "approved" ? "registration_approved" : "registration_rejected"],
  });
}
