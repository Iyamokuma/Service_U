/** Directory + church-aware state validation. */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isStateValidForCountry } from "./branch_regions.ts";

function normUp(v: unknown): string {
  return String(v ?? "").trim().toUpperCase();
}

/** True when state is in static catalog, directory_states, or a live church row for the country. */
export async function isStateValidForCountryCatalog(
  supabase: SupabaseClient,
  countryCode: unknown,
  stateCode: unknown,
): Promise<boolean> {
  const cc = normUp(countryCode);
  const sc = normUp(stateCode);
  if (!cc || !sc) return false;
  if (isStateValidForCountry(cc, sc)) return true;

  const { data: country } = await supabase
    .from("directory_countries")
    .select("id")
    .eq("branch_country_code", cc)
    .maybeSingle();
  if (country?.id) {
    const { data: stateRow } = await supabase
      .from("directory_states")
      .select("id")
      .eq("country_id", country.id)
      .eq("branch_state_code", sc)
      .maybeSingle();
    if (stateRow) return true;
  }

  const { data: church } = await supabase
    .from("churches")
    .select("id")
    .eq("branch_country", cc)
    .eq("branch_state", sc)
    .limit(1)
    .maybeSingle();
  return !!church;
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
  stateCode: unknown,
): Promise<void> {
  const cc = normUp(countryCode);
  const sc = normUp(stateCode);
  if (!cc) throw new Error("Country is required.");
  if (!sc) throw new Error("State / region is required.");
  if (!(await isStateValidForCountryCatalog(supabase, cc, sc))) {
    throw new Error("State does not match the selected country. Choose a state from the dropdown.");
  }
}
