import { SectionSegmentTabs } from "./SectionSegmentTabs.jsx";

/** Admins | Workforce | Unit members sub-tabs on the Users page. */
export function UsersSectionTabs({
  active,
  onChange,
  workforceLabel = "Workforce",
  adminsLabel = "Admins",
  showAdminsTab = true,
  showMembersTab = false,
  membersLabel = "Unit members",
}) {
  const tabs = [];
  if (showAdminsTab) tabs.push({ id: "admins", label: adminsLabel });
  tabs.push({ id: "workforce", label: workforceLabel });
  if (showMembersTab) tabs.push({ id: "members", label: membersLabel });

  return (
    <SectionSegmentTabs tabs={tabs} active={active} onChange={onChange} ariaLabel="Users sections" />
  );
}
