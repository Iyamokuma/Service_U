/** Directory + church-aware state validation. */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isStateValidForCountry } from "./branch_regions.ts";
import {
  resolveExistingDirectoryCountry,
  resolveExistingDirectoryState,
} from "./location_directory.ts";

function norm(v: unknown): string {
  return String(v ?? "").trim();
}

function normUp(v: unknown): string {
  return norm(v).toUpperCase();
}

/** True when state is in static catalog, directory_states, or a live church row for the country. */
export async function isStateValidForCountryCatalog(
  supabase: SupabaseClient,
  countryCode: unknown,
  stateInput: unknown,
): Promise<boolean> {
  const cc = normUp(countryCode);
  const raw = norm(stateInput);
  if (!cc || !raw) return false;
  if (isStateValidForCountry(cc, normUp(raw))) return true;

  const country = await resolveExistingDirectoryCountry(supabase, { branchCountryCode: cc });
  if (country) {
    const state = await resolveExistingDirectoryState(supabase, country.id, cc, raw);
    if (state) return true;
  }

  const { data: churchByName } = await supabase
    .from("churches")
    .select("id")
    .eq("branch_country", cc)
    .ilike("branch_state", raw)
    .limit(1)
    .maybeSingle();
  if (churchByName) return true;

  const legacyCode = normUp(raw);
  if (legacyCode !== raw) {
    const { data: churchByCode } = await supabase
      .from("churches")
      .select("id")
      .eq("branch_country", cc)
      .eq("branch_state", legacyCode)
      .limit(1)
      .maybeSingle();
    if (churchByCode) return true;
  }

  return false;
}

/** State codes from directory_states for a country (data-entry catalog). */
export async function directoryStateCodesForCountry(
  supabase: SupabaseClient,
  countryCode: unknown,
): Promise<string[]> {
  const cc = normUp(countryCode);
  if (!cc) return [];
  const { data: country } = await supabase
    .from("directory_countries")
    .select("id")
    .eq("branch_country_code", cc)
    .maybeSingle();
  if (!country?.id) return [];
  const { data: states } = await supabase
    .from("directory_states")
    .select("branch_state_code")
    .eq("country_id", country.id)
    .order("name");
  return (states || [])
    .map((s) => normUp(s.branch_state_code))
    .filter(Boolean);
}

export async function assertStateBelongsToCountryCatalog(
  supabase: SupabaseClient,
  countryCode: unknown,
  stateInput: unknown,
): Promise<void> {
  const cc = normUp(countryCode);
  const raw = norm(stateInput);
  if (!cc) throw new Error("Country is required.");
  if (!raw) throw new Error("State / region is required.");
  if (!(await isStateValidForCountryCatalog(supabase, cc, raw))) {
    throw new Error("State does not match the selected country. Choose a state from the dropdown.");
  }
}
