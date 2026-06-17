import { useCallback, useMemo, useState } from "react";
import { useTableSelection } from "./useTableSelection.js";
import { canBulkSelectAdmin } from "../components/adminRowMenuItems.js";
import { useToast } from "../components/Toast.jsx";
import {
  bulkDeleteAdmins,
  bulkActivateAdmins,
  bulkDeactivateAdmins,
  summarizeBulkResult,
} from "../adminBulkActions.js";

/** Shared bulk mark + activate / deactivate / delete for admin user tables. */
export function useAdminTableBulk({ rows, me, reload, bulkScope = {}, noun = "account", onDeleted } = {}) {
  const toast = useToast();
  const [bulkBusy, setBulkBusy] = useState(false);

  const selectableRows = useMemo(
    () => (me && reload ? rows.filter((row) => canBulkSelectAdmin(row, me, bulkScope)) : []),
    [rows, me, reload, bulkScope],
  );

  const selection = useTableSelection(selectableRows, (row) => row.id);
  const enabled = Boolean(me && reload && selectableRows.length > 0);

  const canSelectRow = useCallback(
    (row) => enabled && canBulkSelectAdmin(row, me, bulkScope),
    [enabled, me, bulkScope],
  );

  async function runBulkAction(runner, verb = "Updated") {
    if (!selection.selectedCount || bulkBusy) return;
    setBulkBusy(true);
    try {
      const result = await runner(selection.selectedRows);
      summarizeBulkResult(result, toast, { noun, verb });
      if (result.succeeded > 0) {
        selection.clear();
        await reload?.();
      }
    } finally {
      setBulkBusy(false);
    }
  }

  const bulkActions = enabled
    ? [
        {
          id: "activate",
          label: "Activate",
          onClick: () => runBulkAction((selected) => bulkActivateAdmins({ rows: selected, me }), "Activated"),
        },
        {
          id: "deactivate",
          label: "Deactivate",
          onClick: () => runBulkAction((selected) => bulkDeactivateAdmins({ rows: selected, me }), "Deactivated"),
        },
        {
          id: "delete",
          label: "Delete",
          danger: true,
          onClick: () =>
            runBulkAction(
              (selected) => bulkDeleteAdmins({ rows: selected, me, onDeleted }),
              "Deleted",
            ),
        },
      ]
    : [];

  return {
    enabled,
    selection,
    bulkBusy,
    bulkActions,
    canSelectRow,
    showBulkColumn: enabled,
  };
}
