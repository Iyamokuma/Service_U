import { canManageSuperAdminAccount, canCountryAdminManageRole, canStateAdminManageRole } from "../roles.js";

export function isAdminActive(row) {
  if (!row) return false;
  return Number(row.is_active) === 1 || row.is_active === true;
}

/** Invite sent but password not set yet (signup incomplete). */
export function isAdminPendingSignup(row) {
  if (!row) return false;
  if (row.pending_invite === true) return true;
  if (row.pending_invite === false) return false;
  return Number(row.must_change_password) === 1 && !row.last_login;
}

export function adminStatusLabel(row) {
  if (isAdminPendingSignup(row)) return "In progress";
  if (isAdminActive(row)) return "Active";
  return "Inactive";
}

export function adminStatusBadgeClass(row) {
  if (isAdminPendingSignup(row)) return "in_progress";
  if (isAdminActive(row)) return "active";
  return "inactive";
}

export function nextAdminActiveValue(row) {
  return isAdminActive(row) ? 0 : 1;
}

/**
 * Branch admin menus: Edit → (optional Reassign) → Deactivate → Delete.
 * Global admin (Super / General): same order with Reassign when includeReassign is true.
 */
export function buildAdminRowMenuItems({
  row,
  includeReassign = false,
  onEdit,
  onReassign,
  onToggleActive,
  onDelete,
}) {
  if (!row) return [];

  const items = [];

  if (onEdit) {
    items.push({
      id: "edit",
      label: "Edit",
      onClick: onEdit,
    });
  }

  if (includeReassign && onReassign) {
    items.push({
      id: "reassign",
      label: "Reassign",
      onClick: onReassign,
    });
  }

  if (onToggleActive) {
    items.push({
      id: "toggle-active",
      label: isAdminActive(row) ? "Deactivate" : "Activate",
      onClick: onToggleActive,
    });
  }

  if (onDelete) {
    items.push({
      id: "delete",
      label: "Delete",
      danger: true,
      onClick: onDelete,
    });
  }

  return items;
}

export function canShowGlobalAdminActionMenu(row, me) {
  if (!row) return false;
  const isSelf = Number(row.id) === Number(me?.id);
  if (isSelf) return true;
  if (row.role === "super_admin" && !canManageSuperAdminAccount(me?.role)) return false;
  return true;
}

/** Whether a row can be marked for bulk delete / status actions. */
export function canBulkSelectAdmin(row, me, scope = {}) {
  if (!row?.id) return false;
  if (Number(row.id) === Number(me?.id)) return false;
  if (row.role === "super_admin" && !canManageSuperAdminAccount(me?.role)) return false;
  if (scope.isCountryAdmin && !canCountryAdminManageRole(row.role)) return false;
  if (scope.isStateAdmin && !canStateAdminManageRole(row.role)) return false;
  if (scope.isServiceLeader && row.role !== "sub_unit_leader") return false;
  if (scope.isSatellitePastor && !["service_unit_leader", "sub_unit_leader"].includes(row.role)) {
    return false;
  }
  return true;
}
