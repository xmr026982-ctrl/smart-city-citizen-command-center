import { Link } from "react-router-dom";
import IssueStatsCards from "../../components/issues/shared/IssueStatsCards";
import IssueTable from "../../components/issues/shared/IssueTable";
import PageHeader from "../../components/layout/PageHeader";
import { useAuth } from "../../store/authStore";
import { useIssues } from "../../store/issueStore";
import { useNavigate } from "react-router-dom";

function StaffDashboard() {
  const user = useAuth();
  const issues = useIssues();
  const navigate = useNavigate();
  const mine = issues.filter((issue) => issue.assignedTo === user.name);

  return (
    <main className="page-stack">
      <PageHeader
        eyebrow="Issue activity"
        title="Staff operations"
        description="Queue pressure and work assigned to you."
      />
      <IssueStatsCards issues={issues} />
      <div className="stats-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <Link to="/staff/queue" className="stat-card">
          <p className="eyebrow">Unassigned intake</p>
          <strong>{issues.filter((i) => !i.assignedTo && i.status === "submitted").length}</strong>
        </Link>
        <Link to="/staff/assigned" className="stat-card">
          <p className="eyebrow">My open work</p>
          <strong>{mine.filter((i) => i.status !== "resolved").length}</strong>
        </Link>
      </div>
      <IssueTable
        issues={mine.filter((i) => i.status !== "resolved")}
        onSelect={(issue) => navigate(`/staff/issues/${issue.id}`)}
      />
    </main>
  );
}

export default StaffDashboard;