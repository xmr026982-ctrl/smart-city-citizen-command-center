import { Link } from "react-router-dom";
import IssueStatsCards from "../../components/issues/shared/IssueStatsCards";
import IssueTable from "../../components/issues/shared/IssueTable";
import IssueDetailsDrawer from "../../components/issues/shared/IssueDetailsDrawer";
import PageHeader from "../../components/layout/PageHeader";
import { CATEGORY_LABEL } from "../../constants/issueCategories";
import { useIssues } from "../../store/issueStore";
import { useState } from "react";

function AdminDashboard() {
  const issues = useIssues();
  const [selectedId, setSelectedId] = useState(null);
  const selected = issues.find((issue) => issue.id === selectedId) || null;
  const byCategory = Object.entries(CATEGORY_LABEL).map(([key, label]) => ({
    label,
    count: issues.filter((issue) => issue.category === key).length,
  }));

  return (
    <main className="page-stack">
      <PageHeader
        eyebrow="Command"
        title="Admin control"
        description="City-wide issue load, assignment gaps, and category mix."
      />
      <IssueStatsCards issues={issues} />
      <div className="stats-grid">
        {byCategory.slice(0, 4).map((item) => (
          <article key={item.label} className="stat-card">
            <p className="eyebrow">{item.label}</p>
            <strong>{item.count}</strong>
          </article>
        ))}
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Link to="/admin/queue" className="btn btn-primary">
          Open all issues
        </Link>
        <Link to="/admin/assignments" className="btn btn-secondary">
          Assignment board
        </Link>
      </div>
      <IssueTable issues={issues.slice(0, 6)} onSelect={(issue) => setSelectedId(issue.id)} />
      <IssueDetailsDrawer issue={selected} onClose={() => setSelectedId(null)} />
    </main>
  );
}

export default AdminDashboard;