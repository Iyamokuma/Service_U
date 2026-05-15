import { useEffect, useState } from "react";
import { Modal } from "./Modal.jsx";

/**
 * Required before moving in_progress → accepted.
 * Records optional candidate criteria and required admin verification steps.
 */
export function AcceptVerifyModal({ open, candidateName = "", onClose, onConfirm }) {
  const [foundation, setFoundation] = useState(false);
  const [baptism, setBaptism] = useState(false);
  const [called, setCalled] = useState(false);
  const [meet, setMeet] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setFoundation(false);
      setBaptism(false);
      setCalled(false);
      setMeet(false);
    }
  }, [open]);

  async function submit() {
    setSaving(true);
    try {
      await onConfirm({
        verify_foundation_class: foundation,
        verify_water_baptism: baptism,
        verify_called_candidate: called,
        verify_physical_meeting: meet,
      });
    } finally {
      setSaving(false);
    }
  }

  const canMove = called && meet;
  const name = String(candidateName || "").trim() || "this candidate";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Confirm candidates Criteria"
      size="sm"
      footer={
        <>
          <button type="button" className="sa-btn sa-btn-outline" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="sa-btn sa-btn-primary" onClick={submit} disabled={!canMove || saving}>
            {saving ? "Moving…" : "Move to accepted"}
          </button>
        </>
      }
    >
      <div className="sa-stack" style={{ gap: 20 }}>
        <div>
          <p className="sa-verify-section-title">Has the candidate done these?</p>
          <p className="sa-text-xs sa-text-muted" style={{ marginTop: 2, marginBottom: 10 }}>
            Optional — tick what applies for <strong>{name}</strong>.
          </p>
          <div className="sa-stack" style={{ gap: 10 }}>
            <label className="sa-check-row">
              <input type="checkbox" checked={foundation} onChange={(e) => setFoundation(e.target.checked)} />
              <span>Foundation Class</span>
              <span className="sa-badge-optional">optional</span>
            </label>
            <label className="sa-check-row">
              <input type="checkbox" checked={baptism} onChange={(e) => setBaptism(e.target.checked)} />
              <span>Water Baptism</span>
              <span className="sa-badge-optional">optional</span>
            </label>
          </div>
        </div>

        <div className="sa-verify-divider" />

        <div>
          <p className="sa-verify-section-title">Which of these have you done?</p>
          <p className="sa-text-xs sa-text-muted" style={{ marginTop: 2, marginBottom: 10 }}>
            Both are required before this application can be accepted.
          </p>
          <div className="sa-stack" style={{ gap: 10 }}>
            <label className="sa-check-row">
              <input type="checkbox" checked={called} onChange={(e) => setCalled(e.target.checked)} />
              <span>Called the Candidate</span>
            </label>
            <label className="sa-check-row">
              <input type="checkbox" checked={meet} onChange={(e) => setMeet(e.target.checked)} />
              <span>Invited for a physical meeting in church</span>
            </label>
          </div>
        </div>

        {!canMove && (
          <p className="sa-text-xs sa-text-muted" style={{ color: "var(--sa-warning, #d97706)", margin: 0 }}>
            You must confirm both actions above to proceed.
          </p>
        )}
      </div>
    </Modal>
  );
}

/** True when UI must show acceptance verification before updating status. */
export function needsAcceptVerification(fromStatus, toStatus) {
  return String(fromStatus || "") === "in_progress" && String(toStatus || "") === "accepted";
}
