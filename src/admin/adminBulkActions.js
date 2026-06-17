import { api } from "./api.js";
import { isAdminActive, nextAdminActiveValue } from "./components/adminRowMenuItems.js";

async function runSequential(rows, handler) {
  let succeeded = 0;
  const errors = [];
  for (const row of rows) {
    try {
      await handler(row);
      succeeded += 1;
    } catch (e) {
      errors.push({ row, message: e?.message || "Unknown error" });
    }
  }
  return { succeeded, errors };
}

export async function bulkDeleteAdmins({ rows, me, onDeleted, confirmMessage }) {
  if (!rows?.length) return { succeeded: 0, errors: [] };
  const label = rows.length === 1 ? rows[0].full_name : `${rows.length} admin accounts`;
  const ok = window.confirm(
    confirmMessage ||
      `Delete ${label} permanently? Their accounts will be removed from the database and can be invited again with the same email.`,
  );
  if (!ok) return { succeeded: 0, errors: [], cancelled: true };

  return runSequential(rows, async (row) => {
    await api.deleteAdmin(row.id, { viewer: me });
    onDeleted?.(row);
  });
}

export async function bulkSetAdminsActive({ rows, me, active, onUpdated }) {
  if (!rows?.length) return { succeeded: 0, errors: [] };

  const targets = rows.filter((row) => isAdminActive(row) !== active);
  if (!targets.length) return { succeeded: 0, errors: [] };

  const verb = active ? "Activate" : "Deactivate";
  const ok = window.confirm(`${verb} ${targets.length} selected account${targets.length !== 1 ? "s" : ""}?`);
  if (!ok) return { succeeded: 0, errors: [], cancelled: true };

  return runSequential(targets, async (row) => {
    const nextActive = active ? 1 : 0;
    const res = await api.updateAdmin(row.id, { is_active: nextActive, viewer: me });
    onUpdated?.(row, res?.data ? { ...row, ...res.data, is_active: nextActive } : { ...row, is_active: nextActive });
  });
}

export function bulkActivateAdmins(opts) {
  return bulkSetAdminsActive({ ...opts, active: true });
}

export function bulkDeactivateAdmins(opts) {
  return bulkSetAdminsActive({ ...opts, active: false });
}

export function summarizeBulkResult({ succeeded, errors, cancelled }, toast, { noun = "account", verb = "Updated" } = {}) {
  if (cancelled) return;
  if (succeeded > 0) {
    toast(
      `${verb} ${succeeded} ${noun}${succeeded !== 1 ? "s" : ""}.`,
      errors.length ? "error" : "success",
    );
  }
  if (errors.length) {
    const names = errors
      .slice(0, 3)
      .map((e) => e.row?.full_name || "Account")
      .join(", ");
    toast(
      `Failed for ${errors.length} ${noun}${errors.length !== 1 ? "s" : ""}${names ? `: ${names}` : ""}.`,
      "error",
    );
  }
}

export function bulkToggleLabel(rows) {
  const activeCount = rows.filter((row) => isAdminActive(row)).length;
  const inactiveCount = rows.length - activeCount;
  if (inactiveCount > 0 && activeCount === 0) return "Activate";
  if (activeCount > 0 && inactiveCount === 0) return "Deactivate";
  return "Toggle status";
}

export function bulkToggleActive(rows, me, onUpdated) {
  const activeCount = rows.filter((row) => isAdminActive(row)).length;
  const inactiveCount = rows.length - activeCount;
  if (inactiveCount >= activeCount) {
    return bulkActivateAdmins({ rows, me, onUpdated });
  }
  return bulkDeactivateAdmins({ rows, me, onUpdated });
}

export { nextAdminActiveValue };
