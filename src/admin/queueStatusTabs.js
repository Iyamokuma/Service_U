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

/** Quick status actions shown on queue rows, scoped to the active status tab. */
export function queueActionsForTab(statusTab) {
  if (statusTab === "accepted") return ["in_progress", "rejected"];
  if (statusTab === "inprogress") return ["accepted", "rejected"];
  return ["accepted", "in_progress", "rejected"];
}

export function queueActionVisible(statusTab, action) {
  return queueActionsForTab(statusTab).includes(action);
}

/** Status options in the update modal — current value plus tab-allowed transitions. */
export function queueStatusOptionsForTab(current, statusTab, baseOptions) {
  const c = current || "new";
  const base = Array.isArray(baseOptions) ? baseOptions : [];
  if (statusTab !== "accepted" && statusTab !== "inprogress") return base;
  const tabActions = queueActionsForTab(statusTab);
  const opts = new Set([c, ...tabActions.filter((s) => base.includes(s))]);
  return [...opts];
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
