import { useCallback, useEffect, useMemo, useState } from "react";

/** Row selection for admin tables: toggle rows, select-all on current page, clear. */
export function useTableSelection(rows, getRowId = (row) => row?.id) {
  const [selected, setSelected] = useState(() => new Set());

  const rowIds = useMemo(() => rows.map((row) => getRowId(row)).filter((id) => id != null), [rows, getRowId]);

  useEffect(() => {
    const valid = new Set(rowIds);
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => valid.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [rowIds]);

  const isSelected = useCallback((id) => selected.has(id), [selected]);

  const toggle = useCallback((id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelected(new Set(rowIds));
  }, [rowIds]);

  const clear = useCallback(() => setSelected(new Set()), []);

  const toggleAll = useCallback(() => {
    if (rowIds.length > 0 && selected.size === rowIds.length) {
      clear();
    } else {
      selectAll();
    }
  }, [rowIds, selected.size, selectAll, clear]);

  const selectedRows = useMemo(
    () => rows.filter((row) => selected.has(getRowId(row))),
    [rows, selected, getRowId],
  );

  const allSelected = rowIds.length > 0 && selected.size === rowIds.length;
  const someSelected = selected.size > 0 && !allSelected;

  return {
    selected,
    selectedRows,
    selectedCount: selected.size,
    isSelected,
    toggle,
    selectAll,
    clear,
    toggleAll,
    allSelected,
    someSelected,
    hasSelectableRows: rowIds.length > 0,
  };
}
