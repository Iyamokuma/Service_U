import { supabaseAnonHeaders, supabaseProjectUrl } from "./supabaseEnv.js";

/**
 * Active church rows from public.churches (PostgREST).
 * Used by the public registration form for country → state → branch selection.
 */
export async function fetchChurchesCatalog() {
  const base = supabaseProjectUrl();
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
  if (!base || !key) return [];

  const url =
    `${base}/rest/v1/churches?select=id,name,address,branch_country,branch_state,directory_branch_id` +
    `&is_active=eq.1&order=name.asc&limit=3000`;

  const res = await fetch(url, { headers: { ...supabaseAnonHeaders(), Prefer: "count=exact" } });
  if (!res.ok) return [];
  try {
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
