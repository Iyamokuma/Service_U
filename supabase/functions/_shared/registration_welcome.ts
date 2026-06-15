import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { formatOrgSubject, getOrgName, sendEmail, wrapEmailHtml } from "./email_delivery.ts";

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

function departmentLabel(unitName: string, subUnit: string): string {
  const unit = unitName || "Service Unit";
  const sub = norm(subUnit);
  return sub ? `${unit} (${sub})` : unit;
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

/** Confirmation email after a public registration is saved. */
export async function sendRegistrationWelcomeEmail(
  supabase: SupabaseClient,
  payload: RegistrationWelcomePayload,
): Promise<boolean> {
  const email = norm(payload.email).toLowerCase();
  if (!email) return false;

  const firstName = norm(payload.first_name);
  const surname = norm(payload.surname);
  const name = displayName(firstName, surname);
  const unitName = await resolveUnitName(supabase, payload.unit_id, norm(payload.unit_name));
  const subUnit = norm(payload.sub_unit);
  const satellite = norm(payload.satellite_site);
  const department = departmentLabel(unitName, subUnit);

  const subject = `Application received — ${department} Department`;
  const preview = `Your application was received successfully. The ${department} department will contact you shortly.`;

  const churchLine = satellite
    ? `<p>Church / branch: <strong>${satellite}</strong></p>`
    : "";

  const bodyHtml = `
    <p>Hello ${name},</p>
    <p><strong>Application received successfully.</strong></p>
    <p>Thank you for registering to serve with ${getOrgName()}. We have received your application for the <strong>${department}</strong> department.</p>
    ${churchLine}
    <p>You will be contacted shortly by the <strong>${department}</strong> department regarding the next steps.</p>
    <p style="color:#64748b;font-size:14px;">If you did not submit this registration, you can ignore this email.</p>
  `;

  const html = wrapEmailHtml({
    title: "Application received",
    previewText: preview,
    bodyHtml,
  });

  return sendEmail({
    to: email,
    subject: formatOrgSubject(subject),
    html,
    tags: ["registration_received"],
  });
}
