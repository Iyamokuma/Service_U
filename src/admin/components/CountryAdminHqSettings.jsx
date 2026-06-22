import { useEffect, useState } from "react";
import { branchStateLabel } from "../branchRegions.js";
import { AdminScopePanel } from "./AdminScopePanel.jsx";
import { StateRegionSelect } from "./StateRegionSelect.jsx";

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
  const [open, setOpen] = useState(false);
  const currentLabel = myHomeState
    ? branchStateLabel(countryCode, myHomeState)
    : "None (country oversight only)";
  const churchNote = hqChurch ? ` · ${hqChurch}` : "";
  const summary = `${currentLabel}${churchNote}`;

  useEffect(() => {
    if (!forceOpenSignal) return;
    setOpen(true);
    setTimeout(() => {
      const select = document.getElementById("sa-hq-state-select");
      if (select) {
        select.scrollIntoView({ behavior: "smooth", block: "center" });
        select.focus();
      }
    }, 20);
  }, [forceOpenSignal]);

  return (
    <AdminScopePanel
      label="Headquarters state"
      summary={summary}
      hint={
        hqChurch
          ? `Your headquarters church (${hqChurch}) determines the state used in State Branch Admin view.`
          : "Optional state where you also act as State Branch Admin. Use the Country / State toggle above to switch views."
      }
      open={open}
      onToggle={setOpen}
    >
      <div className="sa-form-row" style={{ alignItems: "flex-end", maxWidth: 480 }}>
        <div className="sa-field" style={{ flex: 1 }}>
          <label className="sa-label" htmlFor="sa-hq-state-select">
            Headquarters state
          </label>
          <StateRegionSelect
            id="sa-hq-state-select"
            stateRows={homeStateOptions}
            countryCode={countryCode}
            value={homeStateDraft}
            onChange={onChangeHomeState}
            emptyOption="None — country oversight only"
          />
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
    </AdminScopePanel>
  );
}
