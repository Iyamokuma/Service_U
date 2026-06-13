import { getResendFromAddress } from "./admin_invite.ts";

function norm(s: unknown): string {
  return String(s ?? "").trim();
}

/** Send one HTML email via Resend. Returns false if skipped or failed. */
export async function sendHtmlEmail(to: string, subject: string, html: string): Promise<boolean> {
  const email = norm(to).toLowerCase();
  if (!email) return false;

  const key = Deno.env.get("RESEND_API_KEY") || "";
  const from = getResendFromAddress();
  if (!key || !from) return false;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [email], subject, html }),
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
