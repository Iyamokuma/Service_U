import { supabaseAnonHeaders, supabaseProjectUrl } from "./supabaseEnv.js";

/**
 * Public directory rows (PostgREST, anon SELECT) for registration country / state lists.
 */
export async function fetchDirectoryCountries() {
  const base = supabaseProjectUrl();
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
  if (!base || !key) return [];

  const url =
    `${base}/rest/v1/directory_countries?select=id,name,branch_country_code` +
    `&branch_country_code=not.is.null&order=name.asc`;

  const res = await fetch(url, { headers: { ...supabaseAnonHeaders() } });
  if (!res.ok) return [];
  try {
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function fetchDirectoryStates(countryId) {
  const base = supabaseProjectUrl();
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
  const id = Number(countryId);
  if (!base || !key || !Number.isFinite(id) || id < 1) return [];

  const url =
    `${base}/rest/v1/directory_states?select=id,name,branch_state_code,country_id` +
    `&country_id=eq.${id}&branch_state_code=not.is.null&order=name.asc`;

  const res = await fetch(url, { headers: { ...supabaseAnonHeaders() } });
  if (!res.ok) return [];
  try {
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
