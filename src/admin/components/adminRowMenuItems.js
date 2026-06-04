import { canManageSuperAdminAccount } from "../roles.js";

export function isAdminActive(row) {
  if (!row) return false;
  return Number(row.is_active) === 1 || row.is_active === true;
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
