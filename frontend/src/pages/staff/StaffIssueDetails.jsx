import { Link, useParams } from "react-router-dom";
import IssueDetails from "../../components/issues/shared/IssueDetails";
import PageHeader from "../../components/layout/PageHeader";
import { useIssues } from "../../store/issueStore";

function StaffIssueDetails() {
  const { id } = useParams();
  const issue = useIssues().find((item) => item.id === id);

  if (!issue) {
    return (
      <main className="page-wrap">
        <div className="empty-state">
          <h2>Issue not found</h2>
          <Link to="/staff/assigned">Back to assigned work</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="page-wrap">
      <PageHeader
        eyebrow="Field Layer · Record"
        title={issue.id}
        description="Read-only neural file. Change status from Assigned to Me."
      />
      <Link to="/staff/assigned" className="mono" style={{ display: "inline-block", margin: "8px 0 16px" }}>
        ← Back to assigned work
      </Link>
      <IssueDetails issue={issue} />
    </main>
  );
}

export default StaffIssueDetails;