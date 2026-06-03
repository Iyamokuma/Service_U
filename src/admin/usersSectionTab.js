/** Persist Users page sub-tab (admins / workforce / members) across view-mode switches. */

const KEY = "sm_admin_users_section_tab";

const VALID = new Set(["admins", "workforce", "members"]);

export function readUsersSectionTab() {
  try {
    const v = sessionStorage.getItem(KEY);
    return VALID.has(v) ? v : "admins";
  } catch {
    return "admins";
  }
}

export function writeUsersSectionTab(tab) {
  try {
    sessionStorage.setItem(KEY, VALID.has(tab) ? tab : "admins");
  } catch {
    /* ignore */
  }
}
