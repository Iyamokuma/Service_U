import { useEffect, useMemo, useState } from "react";
import { Modal } from "./Modal.jsx";

/**
 * Two-step delete: warning → simple addition challenge → confirm.
 */
export function DeleteConfirmWithMath({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Yes, delete",
  busy = false,
}) {
  const [step, setStep] = useState(1);
  const [a, setA] = useState(2);
  const [b, setB] = useState(3);
  const [answer, setAnswer] = useState("");

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setAnswer("");
    setA(2 + Math.floor(Math.random() * 8));
    setB(2 + Math.floor(Math.random() * 8));
  }, [open]);

  const correct = useMemo(() => Number(String(answer).trim()) === a + b, [answer, a, b]);

  function close() {
    setStep(1);
    setAnswer("");
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={title || "Confirm delete"}
      size="sm"
      footer={
        step === 1 ? (
          <>
            <button type="button" className="sa-btn sa-btn-outline" onClick={close} disabled={busy}>
              Cancel
            </button>
            <button type="button" className="sa-btn sa-btn-danger" onClick={() => setStep(2)} disabled={busy}>
              Yes
            </button>
          </>
        ) : (
          <>
            <button type="button" className="sa-btn sa-btn-outline" onClick={() => setStep(1)} disabled={busy}>
              Back
            </button>
            <button
              type="button"
              className="sa-btn sa-btn-danger"
              onClick={onConfirm}
              disabled={busy || !correct}
            >
              {busy ? "Deleting…" : confirmLabel}
            </button>
          </>
        )
      }
    >
      {step === 1 ? (
        <p style={{ color: "var(--sa-text-2)", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{message}</p>
      ) : (
        <div className="sa-field">
          <p className="sa-text-sm sa-text-muted" style={{ marginBottom: 12, lineHeight: 1.55 }}>
            Type the answer to confirm you understand this action is permanent.
          </p>
          <label className="sa-label">
            What is {a} + {b}?
          </label>
          <input
            className="sa-input"
            type="number"
            inputMode="numeric"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            autoFocus
            placeholder="Enter the sum"
          />
        </div>
      )}
    </Modal>
  );
}
