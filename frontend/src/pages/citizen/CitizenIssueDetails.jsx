import { Link, useParams } from "react-router-dom";
import IssueDetails from "../../components/issues/shared/IssueDetails";
import { useIssues } from "../../store/issueStore";

function CitizenIssueDetails() {
  const { id } = useParams();
  const issues = useIssues();
  const issue = issues.find((item) => item.id === id);

  if (!issue) {
    return (
      <div className="empty-state">
        <h2>Issue not found</h2>
        <Link to="/citizen/my-reports">Back to My Reports</Link>
      </div>
    );
  }

  return (
    <main className="panel" style={{ padding: 32 }}>
      <Link to="/citizen/my-reports" className="mono">
        ← Back to My Reports
      </Link>
      <div style={{ marginTop: 20 }}>
        <IssueDetails issue={issue} />
      </div>
    </main>
  );
}

export default CitizenIssueDetails;