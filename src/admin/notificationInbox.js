/** Shared helpers for the admin notification inbox. */

const TYPE_LABELS = {
  overdue_application: "Overdue",
  new_registration: "New application",
  admin_request: "Admin request",
  request_update: "Request update",
  announcement: "Announcement",
};

const TYPE_ICONS = {
  overdue_application: "⏰",
  new_registration: "📋",
  admin_request: "👤",
  request_update: "✉️",
  announcement: "📢",
};

export function notificationTypeLabel(type) {
  return TYPE_LABELS[String(type || "")] || "Update";
}

export function notificationTypeIcon(type) {
  return TYPE_ICONS[String(type || "")] || "💬";
}

export function formatInboxTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMsg = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((startOfToday - startOfMsg) / 86400000);
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 0) return time;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString("en-GB", { weekday: "short" });
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function inboxDayLabel(iso) {
  if (!iso) return "Earlier";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Earlier";
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMsg = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((startOfToday - startOfMsg) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

export function groupNotificationsByDay(items) {
  const groups = [];
  let currentDay = null;
  for (const item of items || []) {
    const day = inboxDayLabel(item.created_at);
    if (day !== currentDay) {
      currentDay = day;
      groups.push({ day, items: [] });
    }
    groups[groups.length - 1].items.push(item);
  }
  return groups;
}

export function resolveNotificationTarget(notification, admin) {
  const type = String(notification?.type || "");
  if (type === "overdue_application") return { page: "queue", queueTab: "overdue" };
  if (type === "new_registration") return { page: "queue", queueTab: "new" };
  if (type === "announcement") return { page: "announcements" };
  if (type === "admin_request" || type === "request_update") return { page: "requests" };
  if (admin?.role === "satellite_church_admin" || admin?.role === "state_super_admin") {
    if (type.includes("registration")) return { page: "oversight", queueTab: "all" };
  }
  if (admin?.role === "country_super_admin") {
    if (type.includes("registration")) return { page: "oversight", queueTab: "all" };
  }
  return null;
}

export function notificationActionLabel(type) {
  const t = String(type || "");
  if (t === "new_registration") return "Respond";
  if (t === "overdue_application" || t === "overdue_critical") return "View queue";
  if (t === "admin_request" || t === "request_update") return "View request";
  if (t === "announcement") return "View announcement";
  return "Open";
}

export function formatRelativeTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `Updated ${mins} min${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Updated ${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Updated ${days} day${days === 1 ? "" : "s"} ago`;
  return `Updated ${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
}

export function notificationInitials(title) {
  const words = String(title || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (!words.length) return "N";
  return words.map((w) => w[0]?.toUpperCase() || "").join("") || "N";
}

const TYPE_BADGE_CLASS = {
  overdue_application: "warning",
  overdue_critical: "danger",
  new_registration: "new",
  admin_request: "review",
  request_update: "review",
  announcement: "info",
};

export function notificationBadgeClass(type) {
  return TYPE_BADGE_CLASS[String(type || "")] || "muted";
}
