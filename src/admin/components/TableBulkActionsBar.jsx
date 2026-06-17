export function TableBulkActionsBar({
  selectedCount,
  onClear,
  actions = [],
  busy = false,
}) {
  if (!selectedCount) return null;

  return (
    <div className="sa-table-bulk-bar" role="toolbar" aria-label="Bulk actions">
      <span className="sa-table-bulk-count">
        {selectedCount} selected
      </span>
      <div className="sa-table-bulk-actions">
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            className={`sa-btn sa-btn-sm ${action.danger ? "sa-btn-danger" : action.primary ? "sa-btn-primary" : "sa-btn-outline"}`}
            onClick={action.onClick}
            disabled={busy || action.disabled}
          >
            {action.label}
          </button>
        ))}
        <button type="button" className="sa-btn sa-btn-sm sa-btn-ghost" onClick={onClear} disabled={busy}>
          Clear
        </button>
      </div>
    </div>
  );
}
