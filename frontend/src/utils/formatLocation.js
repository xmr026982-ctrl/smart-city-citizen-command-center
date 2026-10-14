export function formatLocation(issue) {
  return [issue.ward, issue.location].filter(Boolean).join(" · ");
}