import { useState } from "react";
import { api } from "../api.js";
import { useToast } from "../components/Toast.jsx";
import { useAdminAuth } from "../AdminContext.jsx";
import { branchCountryLabel, branchStateLabel } from "../branchRegions.js";

/**
 * Satellite Pastor Admin: propose a new service unit for Super Admin approval.
 * Does not create units directly — submits a structured request.
 */
export function SatelliteUnitRequest() {
  const toast = useToast();
  const { admin } = useAdminAuth();
  const [unitName, setUnitName] = useState("");
  const [description, setDescription] = useState("");
  const [subLines, setSubLines] = useState("");
  const [sending, setSending] = useState(false);

  const country = admin?.branch_country || "";
  const state = admin?.branch_state || "";
  const geoLine = [branchCountryLabel(country), branchStateLabel(country, state)].filter(Boolean).join(" · ");
  const sat = String(admin?.satellite_site || "").trim();

  async function submit(e) {
    e.preventDefault();
    const name = unitName.trim();
    if (!name) {
      toast("Enter a service unit name.", "error");
      return;
    }
    const subUnitNames = subLines
      .split(/\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    setSending(true);
    try {
      await api.createRequest({
        request_type: "service_unit_proposal",
        message: "",
        payload: {
          unitName: name,
          description: description.trim(),
          subUnitNames,
        },
      });
      toast("Request sent to Super Admin for review.", "success");
      setUnitName("");
      setDescription("");
      setSubLines("");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="sa-card">
      <div className="sa-card-body" style={{ maxWidth: 560 }}>
        <h2 className="sa-de-section-title" style={{ marginTop: 0 }}>
          Request a new service unit
        </h2>
        <p className="sa-text-sm sa-text-muted" style={{ marginBottom: 20, lineHeight: 1.5 }}>
          New service units are added by Super Admin after approval. Your request includes your branch context
          automatically. Optional sub-units can be created together when the unit is approved.
        </p>

        <div
          className="sa-text-sm"
          style={{
            marginBottom: 20,
            padding: "12px 14px",
            borderRadius: 10,
            background: "var(--sa-surface)",
            border: "1px solid var(--sa-border)",
            lineHeight: 1.45,
          }}
        >
          <div>
            <span className="sa-text-muted">Branch</span> · {geoLine || "—"}
          </div>
          {sat ? (
            <div style={{ marginTop: 4 }}>
              <span className="sa-text-muted">Satellite</span> · {sat}
            </div>
          ) : null}
        </div>

        <form className="sa-stack" style={{ gap: 16 }} onSubmit={submit}>
          <div className="sa-field">
            <label className="sa-label" htmlFor="sat-unit-name">
              Service unit name <span className="sa-required">*</span>
            </label>
            <input
              id="sat-unit-name"
              className="sa-input"
              value={unitName}
              onChange={(e) => setUnitName(e.target.value)}
              placeholder="e.g. Sanctuary Choir"
              autoComplete="off"
            />
          </div>
          <div className="sa-field">
            <label className="sa-label" htmlFor="sat-unit-desc">
              Notes for approver (optional)
            </label>
            <textarea
              id="sat-unit-desc"
              className="sa-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief context for Super Admin…"
              rows={3}
            />
          </div>
          <div className="sa-field">
            <label className="sa-label" htmlFor="sat-unit-subs">
              Proposed sub-units (optional)
            </label>
            <textarea
              id="sat-unit-subs"
              className="sa-textarea"
              value={subLines}
              onChange={(e) => setSubLines(e.target.value)}
              placeholder={"One name per line, e.g.\nSoprano\nAlto\nTenor"}
              rows={4}
            />
            <div className="sa-field-hint">Each non-empty line becomes a sub-unit if the proposal is approved.</div>
          </div>
          <div>
            <button type="submit" className="sa-btn sa-btn-primary" disabled={sending}>
              {sending ? "Sending…" : "Submit for approval"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
