/**
 * Segmented control for Users sub-views (e.g. State vs Satellite admins, Unit vs Sub-unit leaders).
 */
export function UsersContextSwitch({ value, onChange, options, ariaLabel = "Filter view" }) {
  return (
    <div className="sa-users-context-switch" role="region" aria-label={ariaLabel}>
      <div className="sa-view-mode-bar-switch" role="group" aria-label={ariaLabel}>
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={`sa-view-mode-bar-btn${value === opt.id ? " is-active" : ""}`}
            aria-pressed={value === opt.id}
            onClick={() => onChange(opt.id)}
          >
            {opt.label}
            {opt.count != null ? (
              <span className="sa-users-context-count">{opt.count}</span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}
