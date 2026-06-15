import { getResendFromAddress } from "./admin_invite.ts";

function norm(s: unknown): string {
  return String(s ?? "").trim();
}

export function getReplyToAddress(): string {
  const denoEnv = (globalThis as { Deno?: { env?: { get?: (key: string) => string | undefined } } }).Deno?.env;
  return norm(denoEnv?.get?.("RESEND_REPLY_TO_EMAIL") || "");
}

export function getOrgName(): string {
  const denoEnv = (globalThis as { Deno?: { env?: { get?: (key: string) => string | undefined } } }).Deno?.env;
  return norm(denoEnv?.get?.("RESEND_ORG_NAME") || "") || "Salvation Ministries";
}

/** Strip HTML to a readable plain-text part (multipart improves inbox placement). */
export function htmlToPlainText(html: string): string {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type EmailLayoutOptions = {
  title: string;
  previewText?: string;
  bodyHtml: string;
  footerHtml?: string;
};

/** Branded HTML wrapper with hidden preheader for inbox preview. */
export function wrapEmailHtml({ title, previewText, bodyHtml, footerHtml }: EmailLayoutOptions): string {
  const org = getOrgName();
  const preview = norm(previewText) || norm(title) || org;
  const footer = footerHtml ||
    `<p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#64748b;">This message was sent by ${org}. Please add our sender address to your contacts so future emails arrive in your primary inbox.</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preview)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:20px 24px;background:#0f172a;color:#ffffff;font-size:16px;font-weight:700;">${escapeHtml(org)}</td>
          </tr>
          <tr>
            <td style="padding:24px;font-size:15px;line-height:1.6;">
              ${bodyHtml}
              ${footer}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Primary action button for transactional admin emails. */
export function emailCtaButtonHtml(label: string, href: string): string {
  const url = norm(href);
  const text = norm(label) || "Open";
  if (!url) return "";
  return `<p style="margin:28px 0 8px;text-align:center;">
    <a href="${escapeHtml(url)}" style="display:inline-block;padding:14px 28px;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;border-radius:8px;">${escapeHtml(text)}</a>
  </p>`;
}

export type SendEmailOptions = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  tags?: string[];
  replyTo?: string;
};

/** Send HTML + plain-text email via Resend (multipart improves primary-inbox placement). */
export async function sendEmail(opts: SendEmailOptions): Promise<boolean> {
  const email = norm(opts.to).toLowerCase();
  if (!email) return false;

  const key = Deno.env.get("RESEND_API_KEY") || "";
  const from = getResendFromAddress();
  if (!key || !from) return false;

  const text = norm(opts.text) || htmlToPlainText(opts.html);
  const replyTo = norm(opts.replyTo) || getReplyToAddress();
  const payload: Record<string, unknown> = {
    from,
    to: [email],
    subject: norm(opts.subject),
    html: opts.html,
    text,
  };
  if (replyTo) payload.reply_to = replyTo;
  if (opts.tags?.length) {
    payload.tags = opts.tags.map((name) => ({ name: "category", value: name }));
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error("Resend email failed:", res.status, errBody);
    }
    return res.ok;
  } catch (err) {
    console.error("Resend email error:", err);
    return false;
  }
}

/** Prefix subject with org name when missing (clear sender identity in inbox). */
export function formatOrgSubject(subject: string, _category?: string): string {
  const org = getOrgName();
  const s = norm(subject);
  if (!s) return org;
  if (s.toLowerCase().startsWith(org.toLowerCase())) return s;
  return `${org} — ${s}`;
}
