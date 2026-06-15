import { isGlobalAdminRole } from "./roles.js";

export const PIPELINE_STATUSES = ["new", "in_progress", "accepted", "rejected", "archived"];

const BASE_TABS = ["all", "new", "inprogress", "accepted", "rejected", "archived", "overdue"];

export function queueStatusTabsForRole(role) {
  const tabs = [...BASE_TABS];
  if (role === "satellite_church_admin" || isGlobalAdminRole(role)) {
    tabs.push("critical");
  }
  return tabs;
}

export function queueStatusTabLabel(tab) {
  if (tab === "all") return "All";
  if (tab === "new") return "New";
  if (tab === "inprogress") return "In Progress";
  if (tab === "accepted") return "Accepted";
  if (tab === "rejected") return "Rejected";
  if (tab === "archived") return "Archived";
  if (tab === "overdue") return "Overdue";
  if (tab === "critical") return "Critical";
  return tab;
}

export function pipelineStatusLabel(st) {
  if (st === "in_progress") return "In Progress";
  return String(st || "new").replace(/_/g, " ");
}

/** Map UI tab to queue API params (mutates scoped object). */
export function applyQueueStatusTab(scoped, statusTab, { isLeader = false } = {}) {
  delete scoped.overdue_only;
  delete scoped.critical_only;
  switch (statusTab) {
    case "new":
      scoped.status = "new";
      break;
    case "inprogress":
      scoped.status = "in_progress";
      break;
    case "accepted":
      scoped.status = "accepted";
      break;
    case "rejected":
      scoped.status = "rejected";
      break;
    case "archived":
      scoped.status = "archived";
      break;
    case "overdue":
      scoped.status = "";
      scoped.overdue_only = true;
      break;
    case "critical":
      scoped.status = "";
      scoped.critical_only = true;
      break;
    default:
      scoped.status = isLeader ? "" : scoped.status || "";
  }
}
