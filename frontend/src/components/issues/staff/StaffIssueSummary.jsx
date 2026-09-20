import IssuePriorityBadge from "../shared/IssuePriorityBadge";
import IssueSLAIndicator from "../shared/IssueSLAIndicator";
import IssueStatusBadge from "../shared/IssueStatusBadge";

function StaffIssueSummary({ issue }) {
  if (!issue) return null;

  return (
    <div className="panel" style={{ padding: 16 }}>
      <p className="mono">{issue.id}</p>
      <h3 style={{ marginTop: 8, fontSize: 16 }}>{issue.title}</h3>
      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <IssueStatusBadge status={issue.status} />
        <IssuePriorityBadge priority={issue.priority} />
      </div>
      <p style={{ marginTop: 10 }}>
        <IssueSLAIndicator issue={issue} />
      </p>
    </div>
  );
}

export default StaffIssueSummary;