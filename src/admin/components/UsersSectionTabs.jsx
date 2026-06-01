/** Workforce | Admins sub-tabs on the Users page. */

export function UsersSectionTabs({ active, onChange, workforceLabel = "Workforce", adminsLabel = "Admins" }) {
  return (
    <div className="sa-users-section-tabs" role="tablist" aria-label="Users sections">
      <button
        type="button"
        role="tab"
        aria-selected={active === "workforce"}
        className={`sa-users-section-tab${active === "workforce" ? " is-active" : ""}`}
        onClick={() => onChange("workforce")}
      >
        {workforceLabel}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={active === "admins"}
        className={`sa-users-section-tab${active === "admins" ? " is-active" : ""}`}
        onClick={() => onChange("admins")}
      >
        {adminsLabel}
      </button>
    </div>
  );
}
