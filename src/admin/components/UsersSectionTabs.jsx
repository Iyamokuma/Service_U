/** Admins | Workforce | Unit members sub-tabs on the Users page. */

export function UsersSectionTabs({
  active,
  onChange,
  workforceLabel = "Workforce",
  adminsLabel = "Admins",
  showMembersTab = false,
  membersLabel = "Unit members",
}) {
  return (
    <div className="sa-users-section-tabs" role="tablist" aria-label="Users sections">
      <button
        type="button"
        role="tab"
        aria-selected={active === "admins"}
        className={`sa-users-section-tab${active === "admins" ? " is-active" : ""}`}
        onClick={() => onChange("admins")}
      >
        {adminsLabel}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={active === "workforce"}
        className={`sa-users-section-tab${active === "workforce" ? " is-active" : ""}`}
        onClick={() => onChange("workforce")}
      >
        {workforceLabel}
      </button>
      {showMembersTab ? (
        <button
          type="button"
          role="tab"
          aria-selected={active === "members"}
          className={`sa-users-section-tab${active === "members" ? " is-active" : ""}`}
          onClick={() => onChange("members")}
        >
          {membersLabel}
        </button>
      ) : null}
    </div>
  );
}
