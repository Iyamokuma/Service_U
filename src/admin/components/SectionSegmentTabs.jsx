/**
 * Segmented tab control (same visual system as Users → Admins / Workforce / Unit members).
 * @param {{ id: string, label: string }[]} tabs
 * @param {string} active - active tab id
 * @param {(id: string) => void} onChange
 * @param {string} [ariaLabel]
 * @param {string} [className]
 */
export function SectionSegmentTabs({ tabs, active, onChange, ariaLabel = "Sections", className = "" }) {
  return (
    <div
      className={`sa-users-section-tabs${className ? ` ${className}` : ""}`}
      role="tablist"
      aria-label={ariaLabel}
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={active === t.id}
          className={`sa-users-section-tab${active === t.id ? " is-active" : ""}`}
          onClick={() => onChange(t.id)}
          title={t.label}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
