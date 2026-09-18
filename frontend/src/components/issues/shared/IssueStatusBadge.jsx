function IssueStatusBadge({ status }) {
  const statusMap = {
    Submitted: "submitted",
    Acknowledged: "acknowledged",
    "In Progress": "in-progress",
    Resolved: "resolved",
  };

  const className = statusMap[status] || "submitted";

  return (
    <span className={`issue-status-badge ${className}`}>
      <span className="issue-status-dot-small"></span>
      {status}
    </span>
  );
}

export default IssueStatusBadge;