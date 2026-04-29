export function Collapse({ open, children }) {
  return (
    <div className={`collapse ${open ? "open" : ""}`} aria-hidden={!open}>
      <div className="collapse-inner">{children}</div>
    </div>
  );
}
