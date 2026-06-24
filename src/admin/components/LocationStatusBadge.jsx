export function LocationStatusBadge({ isActive, deletionPending = false }) {
  if (deletionPending) {
    return <span className="sa-badge awaiting_removal">Awaiting removal</span>;
  }
  return (
    <span className={`sa-badge ${isActive ? "active" : "inactive"}`}>
      {isActive ? "Active" : "Hidden"}
    </span>
  );
}
