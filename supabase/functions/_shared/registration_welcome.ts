import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getResendFromAddress } from "./admin_invite.ts";

function norm(s: unknown): string {
  return String(s ?? "").trim();
}

export type RegistrationWelcomePayload = {
  email: string;
  first_name: string;
  surname: string;
  unit_id?: number | null;
  unit_name?: string;
  sub_unit?: string;
  satellite_site?: string;
};

function displayName(first: string, surname: string): string {
  return [first, surname].filter(Boolean).join(" ").trim() || "there";
}

function unitLine(unitName: string, subUnit: string): string {
  const unit = unitName || "your service unit";
  const sub = norm(subUnit);
  if (sub) return `<strong>${unit}</strong> (${sub})`;
  return `<strong>${unit}</strong>`;
}

async function resolveUnitName(
  supabase: SupabaseClient,
  unitId: number | null | undefined,
  unitName: string,
): Promise<string> {
  const fromRow = norm(unitName);
  if (fromRow) return fromRow;
  if (!unitId || !Number.isFinite(unitId)) return "";
  const { data } = await supabase.from("service_units").select("name").eq("id", unitId).maybeSingle();
  return norm((data as { name?: string } | null)?.name);
}

/** Best-effort welcome email after a public registration is saved. */
export async function sendRegistrationWelcomeEmail(
  supabase: SupabaseClient,
  payload: RegistrationWelcomePayload,
): Promise<boolean> {
  const email = norm(payload.email).toLowerCase();
  if (!email) return false;

  const key = Deno.env.get("RESEND_API_KEY") || "";
  const from = getResendFromAddress();
  if (!key || !from) return false;

  const firstName = norm(payload.first_name);
  const surname = norm(payload.surname);
  const name = displayName(firstName, surname);
  const unitName = await resolveUnitName(supabase, payload.unit_id, norm(payload.unit_name));
  const subUnit = norm(payload.sub_unit);
  const satellite = norm(payload.satellite_site);
  const unitHtml = unitLine(unitName, subUnit);

  const subject = unitName
    ? `Welcome to ${unitName} — Salvation Ministries`
    : "Welcome — your service unit registration was received";

  const churchLine = satellite
    ? `<p>Branch: <strong>${satellite}</strong></p>`
    : "";

  const html = `
    <p>Hello ${name},</p>
    <p>Thank you for registering to serve with Salvation Ministries. We have received your application to join ${unitHtml}.</p>
    ${churchLine}
    <p>A unit coordinator will review your application and be in touch within a week.</p>
    <p style="color:#666;font-size:13px;">If you did not submit this registration, you can ignore this email.</p>
  `;

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
      console.error("Registration welcome email failed:", res.status, errBody);
    }
    return res.ok;
  } catch (err) {
    console.error("Registration welcome email error:", err);
    return false;
  }
}
