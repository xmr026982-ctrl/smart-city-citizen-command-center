export const ISSUE_STATUSES = [
  "submitted",
  "acknowledged",
  "in_progress",
  "pending_review",
  "resolved",
];

export const STATUS_LABEL = {
  submitted: "Submitted",
  acknowledged: "Acknowledged",
  in_progress: "In Progress",
  pending_review: "Pending confirmation",
  resolved: "Resolved",
};

export function publicStatus(status) {
  return status === "pending_review" ? "in_progress" : status;
}