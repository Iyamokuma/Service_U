import { useAdminAuth } from "../AdminContext.jsx";
import { canSwitchAdminView, normalizePageForViewMode } from "../adminViewMode.js";

/**
 * Sticky Country ↔ State view bar (Country Admin HQ dual role) — below the topbar.
 */
export function AdminViewModeFloat({ setPage }) {
  const { admin, viewMode, setViewMode } = useAdminAuth();

  if (!canSwitchAdminView(admin)) return null;

  const isState = viewMode === "state";

  function selectMode(mode) {
    if (mode === viewMode) return;
    setViewMode(mode);
    setPage?.((p) => normalizePageForViewMode(p, admin, mode));
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
      </div>
    </div>
  );
}
