import { useEffect, useMemo, useState } from "react";
import { Modal } from "./Modal.jsx";
import { branchCountryLabel, branchStateLabel } from "../branchRegions.js";
import { StateRegionSelect } from "./StateRegionSelect.jsx";

function iso2ForBranchCountry(branchCountryCode) {
  const cc = String(branchCountryCode || "").trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(cc)) return cc;
  return cc;
}

function continentForScope(satellites, branchCountry, branchState) {
  const cc = String(branchCountry || "").toUpperCase();
  const st = String(branchState || "").toUpperCase();
  const row = (satellites || []).find(
    (s) =>
      String(s.branch_country || "").toUpperCase() === cc &&
      (!st || String(s.branch_state || "").toUpperCase() === st),
  );
  return String(row?.continent || "").trim();
}

/**
 * Add satellite churches under an existing catalog country or state.
 * Global admins publish immediately; data entry submits for approval.
 */
export function AddSatellitesModal({
  open,
  onClose,
  onSubmit,
  saving,
  catalog,
  preset = null,
  mode = "publish",
}) {
  const [stateCode, setStateCode] = useState("");
  const [lgaName, setLgaName] = useState("");
  const [satellites, setSatellites] = useState([""]);

  const branchCountry = String(preset?.branch_country || "").toUpperCase();
  const lockedState = preset?.branch_state ? String(preset.branch_state).toUpperCase() : "";
  const countryRow = useMemo(
    () =>
      (catalog?.countries || []).find(
        (c) => String(c.branch_country_code || "").toUpperCase() === branchCountry,
      ),
    [catalog?.countries, branchCountry],
  );
  const countryName = countryRow?.name || branchCountryLabel(branchCountry) || branchCountry;

  const stateOptions = useMemo(() => {
    if (!countryRow) return [];
    return (catalog?.states || [])
      .filter((s) => Number(s.country_id) === Number(countryRow.id))
      .map((s) => ({
        code: String(s.branch_state_code || "").toUpperCase(),
        name: s.name || branchStateLabel(branchCountry, s.branch_state_code),
      }))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [catalog?.states, countryRow, branchCountry]);

  const selectedState = useMemo(() => {
    const code = lockedState || stateCode;
    return stateOptions.find((s) => s.code === code) || null;
  }, [lockedState, stateCode, stateOptions]);

  const lgaSuggestions = useMemo(() => {
    const st = lockedState || stateCode;
    if (!branchCountry || !st) return [];
    const seen = new Set();
    for (const s of catalog?.satellites || []) {
      if (String(s.branch_country || "").toUpperCase() !== branchCountry) continue;
      if (String(s.branch_state || "").toUpperCase() !== st) continue;
      const lga = String(s.lga || "").trim();
      if (lga) seen.add(lga);
    }
    return [...seen].sort((a, b) => a.localeCompare(b));
  }, [catalog?.satellites, branchCountry, lockedState, stateCode]);

  useEffect(() => {
    if (!open) return;
    setStateCode(lockedState || "");
    setLgaName("");
    setSatellites([""]);
  }, [open, lockedState, branchCountry]);

  function setSatellite(i, v) {
    setSatellites((prev) => prev.map((x, j) => (j === i ? v : x)));
  }

  function handleSubmit(e) {
    e.preventDefault();
    const stCode = lockedState || stateCode;
    const stName = selectedState?.name || branchStateLabel(branchCountry, stCode);
    const cleanedSats = satellites.map((s) => s.trim()).filter(Boolean);
    onSubmit({
      continent: continentForScope(catalog?.satellites, branchCountry, stCode),
      countryIso2: iso2ForBranchCountry(branchCountry),
      countryName,
      branch_country: branchCountry,
      branch_state: stCode,
      stateName: stName,
      lgaName: lgaName.trim(),
      satelliteChurches: cleanedSats,
    });
  }

  const title = lockedState
    ? `Add satellites · ${branchStateLabel(branchCountry, lockedState)}`
    : `Add satellites · ${countryName}`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="lg"
      footer={
        <>
          <button type="button" className="sa-btn sa-btn-outline" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="add-satellites-form" className="sa-btn sa-btn-primary" disabled={saving}>
            {saving
              ? mode === "propose"
                ? "Submitting…"
                : "Publishing…"
              : mode === "propose"
                ? "Submit for approval"
                : "Publish satellites"}
          </button>
        </>
      }
    >
      <form id="add-satellites-form" onSubmit={handleSubmit}>
        <p className="sa-text-sm sa-text-muted" style={{ marginBottom: 16, lineHeight: 1.5 }}>
          {mode === "propose"
            ? "Propose new satellite churches for an existing country or state. A Super Admin or General Admin must approve before they appear on the public registration form."
            : "Add satellite churches to an existing country or state. They go live on the registration form immediately."}
        </p>

        <div className="sa-de-grid">
          <div className="sa-field">
            <label className="sa-label">Country</label>
            <input className="sa-input" value={countryName} readOnly disabled />
          </div>

          {!lockedState ? (
            <div className="sa-field">
              <label className="sa-label">
                State / region <span className="sa-required">*</span>
              </label>
              <StateRegionSelect
                stateRows={stateOptions}
                countryCode={branchCountry}
                value={stateCode}
                onChange={setStateCode}
                disabled={stateOptions.length === 0}
              />
              {stateOptions.length === 0 ? (
                <p className="sa-field-hint">No states in the directory for this country yet.</p>
              ) : null}
            </div>
          ) : (
            <div className="sa-field">
              <label className="sa-label">State / region</label>
              <input
                className="sa-input"
                value={branchStateLabel(branchCountry, lockedState)}
                readOnly
                disabled
              />
            </div>
          )}

          <div className="sa-field">
            <label className="sa-label">
              LGA / city <span className="sa-required">*</span>
            </label>
            {lgaSuggestions.length > 0 ? (
              <select
                className="sa-field-select"
                value={lgaName}
                required
                onChange={(e) => setLgaName(e.target.value)}
              >
                <option value="">Select or type below</option>
                {lgaSuggestions.map((lga) => (
                  <option key={lga} value={lga}>
                    {lga}
                  </option>
                ))}
              </select>
            ) : null}
            <input
              className="sa-input"
              style={lgaSuggestions.length > 0 ? { marginTop: 8 } : undefined}
              value={lgaName}
              required
              onChange={(e) => setLgaName(e.target.value)}
              placeholder="LGA or city name"
              disabled={!lockedState && !stateCode}
            />
          </div>
        </div>

        <div className="sa-field" style={{ marginTop: 16 }}>
          <label className="sa-label">
            Satellite churches <span className="sa-required">*</span>
          </label>
          <div className="sa-de-sat-list">
            {satellites.map((s, i) => (
              <div key={i} className="sa-de-sat-row">
                <input
                  className="sa-input"
                  value={s}
                  required={i === 0}
                  onChange={(e) => setSatellite(i, e.target.value)}
                  placeholder={`Satellite church ${i + 1}`}
                />
                {satellites.length > 1 ? (
                  <button
                    type="button"
                    className="sa-btn sa-btn-ghost sa-btn-sm"
                    onClick={() => setSatellites((prev) => (prev.length <= 1 ? prev : prev.filter((_, j) => j !== i)))}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          <button
            type="button"
            className="sa-btn sa-btn-outline sa-btn-sm"
            style={{ marginTop: 8 }}
            onClick={() => setSatellites((prev) => [...prev, ""])}
          >
            Add another satellite
          </button>
        </div>
      </form>
    </Modal>
  );
}
