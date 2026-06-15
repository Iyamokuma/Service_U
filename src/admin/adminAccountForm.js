/** Shared admin account validation for create, edit, and reassign flows. */

export const ROLES_WITH_COUNTRY = [
  "country_super_admin",
  "state_super_admin",
  "satellite_church_admin",
  "service_unit_leader",
  "sub_unit_leader",
];

export const ROLES_WITH_STATE = [
  "country_super_admin",
  "state_super_admin",
  "satellite_church_admin",
  "service_unit_leader",
  "sub_unit_leader",
];

export const ROLES_WITH_SATELLITE = [
  "satellite_church_admin",
  "service_unit_leader",
  "sub_unit_leader",
];

const PENDING_ADMIN_REQUEST_STATUSES = new Set(["open", "in_review"]);

function adminFromRequestPayload(req) {
  const payload = req?.payload && typeof req.payload === "object" ? req.payload : {};
  return payload.admin && typeof payload.admin === "object" ? payload.admin : {};
}

export function occupiedCountryCodes(admins, pendingRequests, excludeId) {
  const set = new Set();
  for (const a of admins || []) {
    if (excludeId != null && Number(a.id) === Number(excludeId)) continue;
    if (a.role === "country_super_admin" && a.branch_country && Number(a.is_active) === 1) {
      set.add(String(a.branch_country).toUpperCase());
    }
  }
  for (const req of pendingRequests || []) {
    if (!PENDING_ADMIN_REQUEST_STATUSES.has(req.status)) continue;
    const admin = adminFromRequestPayload(req);
    if (admin.role === "country_super_admin" && admin.branch_country) {
      set.add(String(admin.branch_country).toUpperCase());
    }
  }
  return set;
}

export function validateAdminForm(form, { takenCountries, takenStates, isEdit, inviteCreate } = {}) {
  if (ROLES_WITH_COUNTRY.includes(form.role) && !String(form.branch_country || "").trim()) {
    return "Country is required for this role.";
  }
  if (ROLES_WITH_STATE.includes(form.role) && !String(form.branch_state || "").trim()) {
    return "State / region is required for this role.";
  }
  if (!isEdit && form.role === "country_super_admin") {
    const cc = String(form.branch_country || "").toUpperCase();
    if (takenCountries?.has(cc)) {
      return "This country already has a Country Admin (or one pending approval).";
    }
    if (!cc) return "Select a country for the Country Admin.";
    const st = String(form.branch_state || "").toUpperCase();
    if (!st) return "Select a headquarters state for the Country Admin.";
    if (takenStates?.has(st)) {
      return "This state already has a State Branch Admin (or another headquarters). Choose a different state.";
    }
  }
  if (!isEdit && form.role === "state_super_admin") {
    const cc = String(form.branch_country || "").toUpperCase();
    const st = String(form.branch_state || "").toUpperCase();
    if (!cc) return "Select a country for the State Branch Admin.";
    if (!st) return "Select a state / region for the State Branch Admin.";
    if (takenStates?.has(st)) {
      return "This state already has a State Branch Admin (or one pending approval).";
    }
  }
  if (form.role === "service_unit_leader" && !form.service_unit_id) {
    return "Service unit is required.";
  }
  if (form.role === "sub_unit_leader") {
    if (!form.service_unit_id) return "Service unit is required.";
    if (!form.sub_unit_name) return "Sub-unit is required.";
  }
  if (ROLES_WITH_SATELLITE.includes(form.role) && !String(form.satellite_site || "").trim()) {
    if (form.role === "satellite_church_admin") {
      return "Select a satellite church for this pastor admin.";
    }
    return "Select a satellite church for this leader.";
  }
  if (!isEdit && !inviteCreate) {
    const pw = String(form.password || "").trim();
    if (!pw || pw.length < 8) {
      return "Password is required (minimum 8 characters).";
    }
  }
  return "";
}

/** All new admins are created via email invite (must match server Resend + ADMIN_APP_URL config). */
export const ADMIN_EMAIL_INVITES_ENABLED = true;

/** New accounts always use invite flow; edits keep existing login. */
export function usesAdminInviteCreate(isEdit = false) {
  return !isEdit;
}

export function usesPlatformInviteCreate(_actorRole, isEdit = false) {
  return usesAdminInviteCreate(isEdit);
}

/** Validates role/scope change on reassign (login fields unchanged). */
export function validateAdminReassignForm(form, { takenCountries, takenStates } = {}) {
  const base = validateAdminForm(form, { takenCountries, takenStates, isEdit: true });
  if (base) return base;

  const cc = String(form.branch_country || "").toUpperCase();
  const st = String(form.branch_state || "").toUpperCase();

  if (form.role === "country_super_admin" && cc && takenCountries?.has(cc)) {
    return "This country already has an active Country Admin.";
  }
  if (form.role === "state_super_admin" && cc && st && takenStates?.has(st)) {
    return "This state already has an active State Branch Admin.";
  }
  return "";
}
