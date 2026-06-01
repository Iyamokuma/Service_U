import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Small action menu anchored beside the trigger (Edit, Deactivate, Delete, Reassign).
 */
export function AdminRowActionsMenu({ open, anchorEl, onClose, items = [] }) {
  const menuRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (!open || !anchorEl || !menuRef.current) return;
    const rect = anchorEl.getBoundingClientRect();
    const menu = menuRef.current.getBoundingClientRect();
    const gap = 8;
    let left = rect.right + gap;
    let top = rect.top;
    if (left + menu.width > window.innerWidth - 12) {
      left = rect.left - menu.width - gap;
    }
    if (top + menu.height > window.innerHeight - 12) {
      top = Math.max(12, window.innerHeight - menu.height - 12);
    }
    setPos({ top, left });
  }, [open, anchorEl, items.length]);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === "Escape") onClose?.();
    }
    function onPointer(e) {
      const t = e.target;
      if (menuRef.current?.contains(t) || anchorEl?.contains(t)) return;
      onClose?.();
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open, anchorEl, onClose]);

  if (!open) return null;

  return (
    <div
      ref={menuRef}
      className="sa-admin-actions-menu"
      role="menu"
      style={{ top: pos.top, left: pos.left }}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          className={`sa-admin-actions-menu-item${item.danger ? " is-danger" : ""}`}
          disabled={item.disabled}
          onClick={() => {
            item.onClick?.();
            if (!item.keepOpen) onClose?.();
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function AdminRowActionsTrigger({ onOpen, label = "Actions" }) {
  return (
    <button type="button" className="sa-btn sa-btn-outline sa-btn-sm sa-admin-actions-trigger" onClick={onOpen}>
      {label}
      <span className="sa-admin-actions-chevron" aria-hidden>
        ▾
      </span>
    </button>
  );
}
