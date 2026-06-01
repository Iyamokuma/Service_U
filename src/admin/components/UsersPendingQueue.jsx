import { useMemo } from "react";

/**
 * Compact pending admin-account requests strip at top of Users page.
 */
export function UsersPendingQueue({
  requests = [],
  onOpenQueue,
  title = "Pending admin requests",
  compact = false,
}) {
  const pending = useMemo(
    () =>
      (requests || []).filter(
        (r) =>
          r.request_type === "admin_account" &&
          (r.status === "open" || r.status === "in_review"),
      ),
    [requests],
  );

  if (!pending.length) return null;

  if (compact) {
    return (
      <div className="sa-users-queue sa-users-queue-compact" role="status">
        <span className="sa-users-queue-compact-text">
          {pending.length} admin account request{pending.length !== 1 ? "s" : ""} pending review
        </span>
        {onOpenQueue ? (
          <button type="button" className="sa-btn sa-btn-outline sa-btn-sm" onClick={onOpenQueue}>
            Open queue
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="sa-users-queue" role="region" aria-label={title}>
      <div className="sa-users-queue-head">
        <div>
          <span className="sa-users-queue-title">{title}</span>
          <span className="sa-users-queue-count">{pending.length} awaiting review</span>
        </div>
        {onOpenQueue ? (
          <button type="button" className="sa-btn sa-btn-outline sa-btn-sm" onClick={onOpenQueue}>
            Open application queue
          </button>
        ) : null}
      </div>
      <ul className="sa-users-queue-list">
        {pending.slice(0, 5).map((r) => {
          const admin = r.payload?.admin || {};
          const name = admin.full_name || r.message || `Request #${r.id}`;
          const role = admin.role ? String(admin.role).replace(/_/g, " ") : "admin account";
          return (
            <li key={r.id} className="sa-users-queue-item">
              <span className="sa-fw-600">{name}</span>
              <span className="sa-text-sm sa-text-muted"> · {role}</span>
              <span className={`sa-badge ${r.status === "open" ? "in_review" : "active"}`} style={{ marginLeft: 8 }}>
                {r.status === "in_review" ? "In review" : "Open"}
              </span>
            </li>
          );
        })}
      </ul>
      {pending.length > 5 ? (
        <p className="sa-text-sm sa-text-muted" style={{ margin: "8px 0 0" }}>
          +{pending.length - 5} more in the application queue
        </p>
      ) : null}
    </div>
  );
}
