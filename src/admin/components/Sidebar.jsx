import { useAdminAuth } from "../AdminContext.jsx";
import { useState } from "react";
import { leaderScopeLabel } from "../leaderScope.js";

const NAV_SUPER = [
  {
    section: "Dashboard",
    items: [
      { id: "overview",  label: "Overview",       icon: <GridIcon /> },
    ],
  },
  {
    section: "Operations",
    items: [
      { id: "queue",     label: "Application Queue", icon: <ListIcon /> },
      { id: "units",     label: "Service Units",     icon: <LayersIcon /> },
      { id: "members",   label: "Unit Members",      icon: <UsersIcon /> },
    ],
  },
  {
    section: "System",
    items: [
      { id: "admins",   label: "Admin Accounts",   icon: <UsersIcon /> },
      { id: "requests", label: "Requests",         icon: <RequestIcon /> },
      { id: "activity", label: "Activity Log",      icon: <ActivityIcon /> },
      { id: "settings", label: "Settings",          icon: <SettingsIcon /> },
    ],
  },
];

const NAV_LEADER = [
  {
    section: "Dashboard",
    items: [
      { id: "overview", label: "Dashboard", icon: <GridIcon /> },
      { id: "queue", label: "Intake Queue", icon: <ListIcon /> },
      { id: "members", label: "Members List", icon: <UsersIcon /> },
      { id: "admins", label: "Team", icon: <UsersIcon /> },
      { id: "activity", label: "Activity Log", icon: <ActivityIcon /> },
      { id: "profile", label: "Profile / Settings", icon: <SettingsIcon /> },
    ],
  },
];

const NAV_SUB_UNIT = [
  {
    section: "Dashboard",
    items: [
      { id: "overview", label: "Dashboard", icon: <GridIcon /> },
      { id: "queue", label: "Intake Queue", icon: <ListIcon /> },
      { id: "members", label: "Members List", icon: <UsersIcon /> },
      { id: "profile", label: "Profile / Settings", icon: <SettingsIcon /> },
    ],
  },
];

/** Country / State supervisory: one data screen with filters (not separate queue/members nav). */
const NAV_BRANCH_SUPERVISORY = [
  {
    section: "Branch oversight",
    items: [
      { id: "oversight", label: "Registrations & filters", icon: <ListIcon /> },
      { id: "profile", label: "Profile / Settings", icon: <SettingsIcon /> },
    ],
  },
];

const ROLE_LABELS = {
  super_admin: "Super Admin",
  general_admin: "General Admin",
  country_super_admin: "Country Admin",
  state_super_admin: "State Branch Admin",
  service_unit_leader: "Service Unit Leader",
  sub_unit_leader: "Sub-Unit Leader",
};

export function Sidebar({ page, setPage, pendingCount }) {
  const { admin, logout } = useAdminAuth();
  const [logoError, setLogoError] = useState(false);
  const initials = admin?.full_name?.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "SA";
  const scope = leaderScopeLabel(admin);
  const nav =
    admin?.role === "super_admin" || admin?.role === "general_admin"
      ? NAV_SUPER
      : admin?.role === "sub_unit_leader"
        ? NAV_SUB_UNIT
        : admin?.role === "service_unit_leader"
          ? NAV_LEADER
          : admin?.role === "country_super_admin" || admin?.role === "state_super_admin"
            ? NAV_BRANCH_SUPERVISORY
            : NAV_LEADER;

  return (
    <aside className="sa-sidebar">
      <div className="sa-sidebar-brand">
        {!logoError ? (
          <img className="sa-brand-logo" src="/smh.png" alt="Salvation Ministries logo" onError={() => setLogoError(true)} />
        ) : (
          <div className="sa-brand-mark">S</div>
        )}
        <div>
          <div className="sa-brand-name">Salvation Ministries</div>
          <div className="sa-brand-sub">{ROLE_LABELS[admin?.role] || String(admin?.role || "").replace(/_/g, " ")}</div>
        </div>
      </div>

      <nav className="sa-nav">
        {nav.map((group) => (
          <div key={group.section}>
            <div className="sa-nav-section">{group.section}</div>
            {group.items.map((item) => (
              <button
                key={item.id}
                className={`sa-nav-item${page === item.id ? " active" : ""}`}
                onClick={() => setPage(item.id)}
              >
                {item.icon}
                {item.label}
                {(item.id === "queue" || item.id === "oversight") && pendingCount > 0 && (
                  <span className="sa-nav-badge">{pendingCount > 99 ? "99+" : pendingCount}</span>
                )}
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className="sa-sidebar-footer">
        <div className="sa-user-card">
          <div className="sa-avatar">{initials}</div>
          <div>
            <div className="sa-user-name">{admin?.full_name}</div>
            <div className="sa-user-role">{ROLE_LABELS[admin?.role] || String(admin?.role || "").replace(/_/g, " ")}</div>
            {scope ? <div className="sa-user-unit">{scope}</div> : null}
          </div>
        </div>
        <button className="sa-logout-btn" onClick={logout}>
          <LogoutIcon /> Sign out
        </button>
      </div>
    </aside>
  );
}

function GridIcon()     { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>; }
function ListIcon()     { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>; }
function LayersIcon()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>; }
function UsersIcon()    { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>; }
function RequestIcon()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>; }
function ActivityIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>; }
function SettingsIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.67 0 1.26.26 1.69.69.43.43.69 1.02.69 1.69s-.26 1.26-.69 1.69c-.43.43-1.02.69-1.69.69z"/></svg>; }
function LogoutIcon()   { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>; }
