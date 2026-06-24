/** Parse admin_requests.payload (object or JSON string from API). */
export function parseRequestPayload(raw) {
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

const PENDING_DELETE_STATUSES = new Set(["open", "in_review"]);

/** Church ids with a pending location_catalog_delete request. */
export function pendingDeletionChurchIds(requests) {
  const ids = new Set();
  for (const r of requests || []) {
    if (r.request_type !== "location_catalog_delete") continue;
    if (!PENDING_DELETE_STATUSES.has(String(r.status || ""))) continue;
    const p = parseRequestPayload(r.payload);
    const id = Number(p?.churchId);
    if (Number.isFinite(id) && id > 0) ids.add(id);
  }
  return ids;
}
