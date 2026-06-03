const WORKFORCE_CTX_KEY = "sm_country_workforce_context";
const ADMINS_CTX_KEY = "sm_country_admins_context";

export function readCountryWorkforceContext() {
  try {
    const v = sessionStorage.getItem(WORKFORCE_CTX_KEY);
    return v === "sub_unit_leader" ? "sub_unit_leader" : "service_unit_leader";
  } catch {
    return "service_unit_leader";
  }
}

export function writeCountryWorkforceContext(ctx) {
  try {
    sessionStorage.setItem(
      WORKFORCE_CTX_KEY,
      ctx === "sub_unit_leader" ? "sub_unit_leader" : "service_unit_leader",
    );
  } catch {
    /* ignore */
  }
}

export function readCountryAdminsContext() {
  try {
    const v = sessionStorage.getItem(ADMINS_CTX_KEY);
    if (v === "state_super_admin" || v === "satellite_church_admin") return v;
    return "all";
  } catch {
    return "all";
  }
}

export function writeCountryAdminsContext(ctx) {
  try {
    const next =
      ctx === "state_super_admin" || ctx === "satellite_church_admin" ? ctx : "all";
    sessionStorage.setItem(ADMINS_CTX_KEY, next);
  } catch {
    /* ignore */
  }
}

const STATE_WORKFORCE_CTX_KEY = "sm_state_workforce_context";

export function readStateWorkforceContext() {
  try {
    const v = sessionStorage.getItem(STATE_WORKFORCE_CTX_KEY);
    return v === "sub_unit_leader" ? "sub_unit_leader" : "service_unit_leader";
  } catch {
    return "service_unit_leader";
  }
}

export function writeStateWorkforceContext(ctx) {
  try {
    sessionStorage.setItem(
      STATE_WORKFORCE_CTX_KEY,
      ctx === "sub_unit_leader" ? "sub_unit_leader" : "service_unit_leader",
    );
  } catch {
    /* ignore */
  }
}
