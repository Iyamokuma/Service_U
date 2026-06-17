import { useEffect, useRef } from "react";
import { branchStateLabel } from "../branchRegions.js";

/**
 * Collapsible HQ state picker — kept off the main Users flow until expanded.
 */
export function CountryAdminHqSettings({
  countryCode,
  homeStateDraft,
  homeStateOptions,
  myHomeState,
  hqChurch = "",
  savingHome,
  onChangeHomeState,
  onSave,
  forceOpenSignal = 0,
}) {
  const detailsRef = useRef(null);
  const currentLabel = myHomeState
    ? branchStateLabel(countryCode, myHomeState)
    : "None (country oversight only)";
  const churchNote = hqChurch ? ` · ${hqChurch}` : "";

  useEffect(() => {
    if (!forceOpenSignal) return;
    const details = detailsRef.current;
    if (details) details.open = true;
    setTimeout(() => {
      const select = document.getElementById("sa-hq-state-select");
      if (select) {
        select.scrollIntoView({ behavior: "smooth", block: "center" });
        select.focus();
      }
    }, 20);
  }, [forceOpenSignal]);

  return (
    <details className="sa-users-hq-settings" ref={detailsRef}>
      <summary className="sa-users-hq-settings-summary">
        <span className="sa-users-hq-settings-label">Headquarters state</span>
        <span className="sa-users-hq-settings-value">{currentLabel}{churchNote}</span>
      </summary>
      <div className="sa-users-hq-settings-body">
        <p className="sa-text-muted sa-text-sm" style={{ margin: "0 0 12px", lineHeight: 1.55 }}>
          {hqChurch
            ? `Your headquarters church (${hqChurch}) determines the state used in State Branch Admin view.`
            : "Optional state where you also act as State Branch Admin. Use the Country / State toggle above to switch views."}
        </p>
        <div className="sa-form-row" style={{ alignItems: "flex-end", maxWidth: 480 }}>
          <div className="sa-field" style={{ flex: 1 }}>
            <label className="sa-label" htmlFor="sa-hq-state-select">
              Headquarters state
            </label>
            <select
              id="sa-hq-state-select"
              className="sa-field-select"
              value={homeStateDraft}
              onChange={(e) => onChangeHomeState(e.target.value)}
            >
              <option value="">None — country oversight only</option>
              {homeStateOptions.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="sa-btn sa-btn-primary sa-btn-sm"
            onClick={onSave}
            disabled={savingHome || homeStateDraft === myHomeState}
          >
            {savingHome ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </details>
  );
}
