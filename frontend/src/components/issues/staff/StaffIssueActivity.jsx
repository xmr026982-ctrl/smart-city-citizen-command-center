import IssueActivityFeed from "../shared/IssueActivityFeed";

function StaffIssueActivity({ issueId }) {
  return (
    <div style={{
      borderRadius: 14,
      padding: 14,
      background: "rgba(255,255,255,0.55)",
      border: "1px solid rgba(14,165,233,0.16)",
    }}>
      <p style={{
        fontSize: 11,
        fontWeight: 650,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--subtle)",
        marginBottom: 10,
      }}>
        Field activity
      </p>
      <IssueActivityFeed issueId={issueId} />
    </div>
  );
}

export default StaffIssueActivity;