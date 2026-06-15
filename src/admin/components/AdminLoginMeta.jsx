/** Username + email lines shown under an admin name or in the sidebar. */
export function AdminLoginMeta({ username, email, className = "" }) {
  const user = String(username || "").trim();
  const em = String(email || "").trim();
  if (!user && !em) return null;
  return (
    <div className={className}>
      {user ? <div className="sa-text-sm sa-text-muted">{user}</div> : null}
      {em ? <div className="sa-text-sm sa-text-muted">{em}</div> : null}
    </div>
  );
}
