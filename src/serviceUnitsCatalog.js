import { SERVICE_UNITS } from "./data.js";
import { supabaseAnonHeaders, supabaseProjectUrl } from "./lib/supabaseEnv.js";

/**
 * Load service units + sub-units from Supabase (anon SELECT policies).
 * Fetches units and sub-units separately so nested embed/RLS issues do not hide sub-units.
 */
export async function fetchServiceUnitsCatalog() {
  const base = supabaseProjectUrl();
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
  if (!base || !key) return SERVICE_UNITS;

  const unitsUrl =
    `${base}/rest/v1/service_units?select=id,name,sort_order,is_active` +
    "&is_active=eq.1&order=sort_order.asc&limit=500";

  const subsUrl =
    `${base}/rest/v1/sub_units?select=id,unit_id,name,sort_order,is_active` +
    "&is_active=eq.1&order=sort_order.asc&limit=5000";

  try {
    const [unitsRes, subsRes] = await Promise.all([
      fetch(unitsUrl, { headers: supabaseAnonHeaders() }),
      fetch(subsUrl, { headers: supabaseAnonHeaders() }),
    ]);
    if (!unitsRes.ok) throw new Error(await unitsRes.text());
    if (!subsRes.ok) throw new Error(await subsRes.text());

    const units = await unitsRes.json();
    const subs = await subsRes.json();
    if (!Array.isArray(units) || units.length === 0) return SERVICE_UNITS;

    const subsByUnit = new Map();
    for (const s of Array.isArray(subs) ? subs : []) {
      if (Number(s.is_active ?? 1) !== 1) continue;
      const uid = Number(s.unit_id);
      if (!Number.isFinite(uid)) continue;
      if (!subsByUnit.has(uid)) subsByUnit.set(uid, []);
      subsByUnit.get(uid).push(s);
    }

    return units.map((u) => {
      const uid = Number(u.id);
      const unitSubs = (subsByUnit.get(uid) || []).sort(
        (a, b) =>
          (a.sort_order ?? 0) - (b.sort_order ?? 0) || String(a.name).localeCompare(String(b.name)),
      );
      return {
        id: uid,
        name: u.name,
        subs: unitSubs.map((s) => String(s.name || "").trim()).filter(Boolean),
      };
    });
  } catch {
    return SERVICE_UNITS;
  }
}
