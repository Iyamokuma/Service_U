import { api } from "./api.js";

/**
 * Churches + satellite sites from the admin API (service role, same sources as Locations catalog).
 * Use this in the admin portal instead of public PostgREST fetchChurchesCatalog.
 */
export async function fetchAdminChurchesCatalog() {
  try {
    const r = await api.churchCatalog();
    return Array.isArray(r?.churches) ? r.churches : [];
  } catch {
    return [];
  }
}
