import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/** Digits-only phone for identity matching (+234… vs 080… formats differ in UI only). */
export function normalizePhoneDigits(phone: string | null | undefined): string {
  return String(phone ?? "").replace(/\D/g, "");
}

export function normalizeRegistrationEmail(email: string | null | undefined): string | null {
  const e = String(email ?? "").trim().toLowerCase();
  return e || null;
}

export function registrationIdentityColumns(
  phone1: string,
  phone2: string | null | undefined,
  email: string | null | undefined,
) {
  const d1 = normalizePhoneDigits(phone1);
  const d2Raw = phone2 != null && String(phone2).trim() !== "" ? normalizePhoneDigits(phone2) : "";
  return {
    phone1_digits: d1.length >= 7 ? d1 : null,
    phone2_digits: d2Raw.length >= 7 ? d2Raw : null,
    email_normalized: normalizeRegistrationEmail(email),
  };
}

function uniqueDigits(phone1: string, phone2: string | null | undefined): string[] {
  const d1 = normalizePhoneDigits(phone1);
  const d2 = phone2 != null && String(phone2).trim() !== "" ? normalizePhoneDigits(phone2) : "";
  return [...new Set([d1, d2].filter((d) => d.length >= 7))];
}

const DUPLICATE_BLOCK_STATUSES = ["new", "in_progress", "accepted"];

/** Blocks duplicate active registrations (new, in progress, or accepted). Rejected/archived may re-apply. */
export async function assertRegistrationIdentityAvailable(
  supabase: SupabaseClient,
  phone1: string,
  phone2: string | null | undefined,
  email: string | null | undefined,
): Promise<void> {
  const digits = uniqueDigits(phone1, phone2);
  const em = normalizeRegistrationEmail(email);

  for (const d of digits) {
    const { data, error } = await supabase
      .from("registrations")
      .select("id")
      .in("status", DUPLICATE_BLOCK_STATUSES)
      .or(`phone1_digits.eq.${d},phone2_digits.eq.${d}`)
      .limit(1);
    if (error) throw new Error(error.message);
    if (data?.length) {
      throw new Error(
        "A registration with this phone number already exists. If you already applied, contact your service unit leader instead of submitting again.",
      );
    }
  }

  if (em) {
    const { data, error } = await supabase
      .from("registrations")
      .select("id")
      .in("status", DUPLICATE_BLOCK_STATUSES)
      .eq("email_normalized", em)
      .limit(1);
    if (error) throw new Error(error.message);
    if (data?.length) {
      throw new Error(
        "A registration with this email address already exists. If you already applied, contact your service unit leader instead of submitting again.",
      );
    }
  }
}

export function registrationIdentityConflictMessage(dbError: { message?: string; code?: string }): string | null {
  const msg = String(dbError.message || "");
  if (dbError.code === "23505") {
    if (msg.includes("idx_registrations_phone1_digits") || msg.includes("phone1_digits")) {
      return "A registration with this phone number already exists. If you already applied, contact your service unit leader.";
    }
    if (msg.includes("idx_registrations_email_normalized") || msg.includes("email_normalized")) {
      return "A registration with this email address already exists. If you already applied, contact your service unit leader.";
    }
  }
  return null;
}
