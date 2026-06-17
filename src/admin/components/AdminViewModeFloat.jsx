import { useAdminAuth } from "../AdminContext.jsx";
import { useToast } from "./Toast.jsx";
import { canSwitchAdminView, normalizePageForViewMode } from "../adminViewMode.js";
import { countryAdminHomeState } from "../roles.js";
import { branchStateLabel } from "../branchRegions.js";

/**
 * Sticky Country ↔ State view bar (Country Admin HQ dual role) — below the topbar.
 */
export function AdminViewModeFloat({ page, setPage }) {
  const toast = useToast();
  const { admin, viewMode, setViewMode } = useAdminAuth();

  if (!canSwitchAdminView(admin)) return null;

  const isState = viewMode === "state";
  const hqState = countryAdminHomeState(admin);
  const hqChurch = String(admin?.satellite_site || "").trim();
  const hqStateLabel = hqState ? branchStateLabel(admin.branch_country, hqState) || hqState : "";

  function selectMode(mode) {
    if (mode === viewMode) return;
    if (mode === "state" && !hqState) {
      toast("Set your headquarters state in Profile / Settings before using State Branch view.", "error");
      setPage?.("profile");
      return;
    }
    const nextPage = normalizePageForViewMode(page, admin, mode);
    setViewMode(mode);
    setPage?.(nextPage);
  }

  return (
    <div className="sa-view-mode-bar" role="region" aria-label="Dashboard view mode">
      <div className="sa-view-mode-bar-inner">
        <div className="sa-view-mode-bar-switch" role="group" aria-label="Country or State dashboard">
          <button
            type="button"
            className={`sa-view-mode-bar-btn${!isState ? " is-active" : ""}`}
            aria-pressed={!isState}
            onClick={() => selectMode("country")}
          >
            Country Admin
          </button>
          <button
            type="button"
            className={`sa-view-mode-bar-btn${isState ? " is-active" : ""}`}
            aria-pressed={isState}
            onClick={() => selectMode("state")}
          >
            State Branch Admin
          </button>
        </div>
        {hqState ? (
          <span className="sa-text-muted sa-text-sm" style={{ marginLeft: 12 }}>
            HQ state: {hqStateLabel}
            {hqChurch ? ` · ${hqChurch}` : ""}
          </span>
        ) : null}
      </div>
    </div>
  );
}
