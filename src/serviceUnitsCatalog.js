import { SERVICE_UNITS } from "./data.js";
import { supabaseAnonHeaders, supabaseProjectUrl } from "./lib/supabaseEnv.js";

/**
 * Load service units + sub-units from Supabase (anon SELECT policies).
 * Falls back to bundled SERVICE_UNITS if env is missing or the request fails.
 */
export async function fetchServiceUnitsCatalog() {
  const base = supabaseProjectUrl();
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
  if (!base || !key) return SERVICE_UNITS;

  const select = "id,name,sort_order,is_active,sub_units(id,name,sort_order,is_active)";
  const url =
    `${base}/rest/v1/service_units?select=${encodeURIComponent(select)}` +
    "&is_active=eq.1&order=sort_order.asc";

  try {
    const r = await fetch(url, { headers: supabaseAnonHeaders() });
    if (!r.ok) throw new Error(await r.text());
    const rows = await r.json();
    if (!Array.isArray(rows) || rows.length === 0) return SERVICE_UNITS;
    return rows.map((u) => ({
      id: Number(u.id),
      name: u.name,
      subs: (u.sub_units || [])
        .filter((s) => Number(s.is_active ?? 1) === 1)
        .sort(
          (a, b) =>
            (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
            String(a.name).localeCompare(String(b.name)),
        )
        .map((s) => s.name),
    }));
  } catch {
    return SERVICE_UNITS;
  }
}
