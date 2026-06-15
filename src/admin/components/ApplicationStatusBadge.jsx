import { pipelineStatusLabel } from "../queueStatusTabs.js";

/** Pipeline status with optional overdue / critical markers for open applications. */
export function ApplicationStatusBadge({ row }) {
  const st = row?.status || "new";
  const label = pipelineStatusLabel(st);
  const open = st === "new" || st === "in_progress";

  if (open && row?.is_critical) {
    return (
      <span className="sa-status-stack">
        <span className="sa-badge critical">Critical</span>
        <span className={`sa-badge ${st}`}>{label}</span>
      </span>
    );
  }
  if (open && row?.is_overdue) {
    return (
      <span className="sa-status-stack">
        <span className="sa-badge overdue">Overdue</span>
        <span className={`sa-badge ${st}`}>{label}</span>
      </span>
    );
  }
  return <span className={`sa-badge ${st}`}>{label}</span>;
}
