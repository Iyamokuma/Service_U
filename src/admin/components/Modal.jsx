import { useEffect } from "react";

export function Modal({ open, onClose, title, size = "md", children, footer }) {
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="sa-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`sa-modal sa-modal-${size}`}>
        <div className="sa-modal-head">
          <h3>{title}</h3>
          <button className="sa-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="sa-modal-body">{children}</div>
        {footer && <div className="sa-modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmModal({ open, onClose, onConfirm, title, message, danger }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title || "Confirm"}
      size="sm"
      footer={
        <>
          <button className="sa-btn sa-btn-outline" onClick={onClose}>Cancel</button>
          <button className={`sa-btn ${danger ? "sa-btn-danger" : "sa-btn-primary"}`} onClick={onConfirm}>
            Confirm
          </button>
        </>
      }
    >
      <p style={{ color: "var(--sa-text-2)", lineHeight: 1.6 }}>{message}</p>
    </Modal>
  );
}
