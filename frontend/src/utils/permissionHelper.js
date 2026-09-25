export function canOperateIssues(role) {
  return role === "staff" || role === "admin";
}

export function canUpdateStatus(role) {
  return role === "staff" || role === "admin";
}

export function canAssignIssues(role) {
  return role === "admin";
}

export function canSetPriority(role) {
  return role === "admin";
}

export function canChangeCategory(role) {
  return role === "admin";
}