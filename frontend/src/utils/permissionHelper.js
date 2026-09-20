export function canOperateIssues(role) {
  return role === "staff" || role === "admin";
}

export function canAssignIssues(role) {
  return role === "admin";
}