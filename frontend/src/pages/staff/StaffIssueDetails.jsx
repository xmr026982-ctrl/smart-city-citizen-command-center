import { Link, useParams } from "react-router-dom";
import IssueDetails from "../../components/issues/shared/IssueDetails";
import { useIssues } from "../../store/issueStore";

function StaffIssueDetails() {
  const { id } = useParams();
  const issue = useIssues().find((item) => item.id === id);

  if (!issue) {
    return (
      <div className="empty-state">
        <h2>Issue not found</h2>
        <Link to="/staff/queue">Back to queue</Link>
      </div>
    );
  }

  return (
    <main className="panel" style={{ padding: 32 }}>
      <Link to="/staff/queue" className="mono">
        ← Back to queue
      </Link>
      <div style={{ marginTop: 20 }}>
        <IssueDetails issue={issue} />
      </div>
    </main>
  );
}

export default StaffIssueDetails;