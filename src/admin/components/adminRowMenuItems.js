export function isAdminActive(row) {
  if (!row) return false;
  return Number(row.is_active) === 1 || row.is_active === true;
}

export function nextAdminActiveValue(row) {
  return isAdminActive(row) ? 0 : 1;
}

/**
 * Country-admin action menu: Edit → Deactivate → Delete.
 * Super admin: same order with Reassign after Edit when includeReassign is true.
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

export function canShowGlobalAdminActionMenu(row, me, isRootSuper) {
  if (!row) return false;
  const isSelf = Number(row.id) === Number(me?.id);
  if (isSelf) return true;
  if (row.role === "super_admin" && !isRootSuper) return false;
  return true;
}
