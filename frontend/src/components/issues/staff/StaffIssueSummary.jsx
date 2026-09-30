import IssuePriorityBadge from "../shared/IssuePriorityBadge";
import IssueSLAIndicator from "../shared/IssueSLAIndicator";
import IssueStatusBadge from "../shared/IssueStatusBadge";

function StaffIssueSummary({ issue }) {
  if (!issue) return null;

  return (
    <div style={{
      borderRadius: 16,
      padding: 16,
      background: "rgba(255,255,255,0.62)",
      border: "1px solid rgba(14,165,233,0.16)",
      backdropFilter: "blur(12px)",
    }}>
      <p className="mono">{issue.id}</p>
      <h3 style={{ marginTop: 8, fontSize: 16, fontFamily: "var(--font-display)" }}>
        {issue.title}
      </h3>
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