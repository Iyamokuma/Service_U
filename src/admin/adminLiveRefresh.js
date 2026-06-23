export const ADMIN_CATALOG_CHANGED = "sm-admin-catalog-changed";
export const ADMIN_REQUESTS_CHANGED = "sm-admin-requests-changed";
export const ADMIN_FOCUS_REQUEST_KEY = "sm_admin_focus_request";

export function emitAdminCatalogChanged() {
  window.dispatchEvent(new CustomEvent(ADMIN_CATALOG_CHANGED));
}

export function emitAdminRequestsChanged() {
  window.dispatchEvent(new CustomEvent(ADMIN_REQUESTS_CHANGED));
}

export function setFocusRequestId(id) {
  try {
    if (id) sessionStorage.setItem(ADMIN_FOCUS_REQUEST_KEY, String(id));
    else sessionStorage.removeItem(ADMIN_FOCUS_REQUEST_KEY);
  } catch {
    /* ignore */
  }
}

export function readFocusRequestId() {
  try {
    const v = sessionStorage.getItem(ADMIN_FOCUS_REQUEST_KEY);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}
