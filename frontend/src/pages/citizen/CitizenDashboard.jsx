import { Link } from "react-router-dom";
import IssueStatsCards from "../../components/issues/shared/IssueStatsCards";
import PageHeader from "../../components/layout/PageHeader";
import { useAuth } from "../../store/authStore";
import { useIssues } from "../../store/issueStore";

function CitizenDashboard() {
  const user = useAuth();
  const issues = useIssues().filter(
    (issue) => issue.reporterId === user.id || issue.reportedBy === user.name
  );

  return (
    <main className="page-stack">
      <PageHeader eyebrow="Citizen" title="Issue overview" description="Your reports at a glance." />
      <IssueStatsCards issues={issues} />
      <Link to="/citizen/report" className="btn btn-primary" style={{ width: "fit-content" }}>
        Report an issue
      </Link>
    </main>
  );
}

export default CitizenDashboard;