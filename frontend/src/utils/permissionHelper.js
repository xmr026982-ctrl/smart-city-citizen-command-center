export function canOperateIssues(role) {
  return role === "staff" || role === "admin";
}

export function canUpdateStatus(role) {
  return role === "staff" || role === "admin";
}

// Assignment is ONLY allowed from the Dispatch Board page
export function canAssignIssues(role) {
  return false;
}

export function canSetPriority(role) {
  return role === "admin";
}

export function canChangeCategory(role) {
  return role === "admin";
}