/**
 * Compact inline summary (replaces stat card grids on Users pages).
 */
export function UsersPageMeta({ items = [] }) {
  const visible = items.filter(Boolean);
  if (!visible.length) return null;

  return (
    <p className="sa-users-meta" role="status">
      {visible.map((text, i) => (
        <span key={text} className="sa-users-meta-item">
          {i > 0 ? <span className="sa-users-meta-sep" aria-hidden> · </span> : null}
          {text}
        </span>
      ))}
    </p>
  );
}
