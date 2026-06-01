const TABS = [
  { id: "draft", label: "Drafts" },
  { id: "scheduled", label: "Scheduled" },
  { id: "sent", label: "Sent" },
  { id: "archived", label: "Archived" },
];

function tabLabel(tab, counts) {
  const base = tab.label;
  const n = counts?.[tab.id];
  if (n != null && n > 0) return `${base} (${n})`;
  return base;
}

/** Same tab row as Application Queue (`sa-unit-tab-row` / `sa-unit-tab-btn`). */
export function AnnouncementStatusTabs({ active, onChange, counts = {}, className = "" }) {
  return (
    <div className={`sa-card-body sa-unit-tab-row${className ? ` ${className}` : ""}`} role="tablist" aria-label="Announcement status">
      {TABS.map((tab) => {
        const label = tabLabel(tab, counts);
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active === tab.id}
            className={`sa-unit-tab-btn${active === tab.id ? " is-active" : ""}`}
            onClick={() => onChange(tab.id)}
            title={label}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export const ANNOUNCEMENT_STATUS_TABS = TABS;
