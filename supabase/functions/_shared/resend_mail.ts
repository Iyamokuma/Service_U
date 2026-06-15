import { formatOrgSubject, sendEmail, wrapEmailHtml } from "./email_delivery.ts";

function norm(s: unknown): string {
  return String(s ?? "").trim();
}

export function renderTemplate(template: string, vars: Record<string, string>): string {
  let out = template;
  for (const [key, val] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{\\{${key}\\}\\}`, "gi"), val);
  }
  return out;
}

export function applicantDisplayName(first: string, surname: string): string {
  return [first, surname].filter(Boolean).join(" ").trim() || "there";
}

/** Send one HTML email via Resend. Returns false if skipped or failed. */
export async function sendHtmlEmail(
  to: string,
  subject: string,
  html: string,
  options: { tags?: string[]; previewText?: string; title?: string } = {},
): Promise<boolean> {
  const wrapped = wrapEmailHtml({
    title: options.title || subject,
    previewText: options.previewText || subject,
    bodyHtml: html,
  });
  return sendEmail({
    to,
    subject: formatOrgSubject(subject, options.tags?.[0]),
    html: wrapped,
    tags: options.tags,
  });
}
