/** Validation for State Branch Admin workforce leader accounts. */

import { unitHasSubUnits, subUnitNamesForUnit } from "../serviceUnitUtils.js";

export function validateWorkforceLeaderForm(form, { isEdit, role, units, inviteCreate } = {}) {
  if (!String(form.full_name || "").trim()) return "Full name is required.";
  if (!isEdit && !inviteCreate && !String(form.username || "").trim()) return "Username is required.";
  if (!String(form.email || "").trim()) return "Email is required.";
  if (!isEdit && !inviteCreate && (!form.password || String(form.password).length < 8)) {
    return "Password is required (minimum 8 characters).";
  }
  if (!String(form.satellite_site || "").trim()) return "Satellite church is required.";
  if (!form.service_unit_id) return "Service unit is required.";
  const r = role || form.role;
  if (r === "sub_unit_leader") {
    const unit = (units || []).find((u) => Number(u.id) === Number(form.service_unit_id));
    if (!unitHasSubUnits(unit)) {
      return "This service unit has no sub-units. Assign a service unit leader instead.";
    }
    if (!String(form.sub_unit_name || "").trim()) {
      return "Sub-unit is required.";
    }
    const name = String(form.sub_unit_name || "").trim();
    if (!subUnitNamesForUnit(unit).some((subName) => subName === name)) {
      return "Select a sub-unit that exists on this service unit.";
    }
  }
  return "";
}
