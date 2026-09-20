import IssueStatsCards from "../../components/issues/shared/IssueStatsCards";
import PageHeader from "../../components/layout/PageHeader";
import { CATEGORY_LABEL } from "../../constants/issueCategories";
import { ISSUE_STATUSES, STATUS_LABEL } from "../../constants/issueStatuses";
import { useIssues } from "../../store/issueStore";

function Bar({ label, value, max }) {
  const width = max ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div style={{ height: 10, background: "var(--bg)", borderRadius: 999 }}>
        <div style={{ width: `${width}%`, height: "100%", background: "var(--primary)", borderRadius: 999 }} />
      </div>
    </div>
  );
}

function IssueAnalytics() {
  const issues = useIssues();
  const byStatus = ISSUE_STATUSES.map((status) => ({
    label: STATUS_LABEL[status],
    value: issues.filter((issue) => issue.status === status).length,
  }));
  const byCategory = Object.entries(CATEGORY_LABEL).map(([key, label]) => ({
    label,
    value: issues.filter((issue) => issue.category === key).length,
  }));
  const maxStatus = Math.max(...byStatus.map((item) => item.value), 1);
  const maxCategory = Math.max(...byCategory.map((item) => item.value), 1);

  return (
    <main className="page-stack">
      <PageHeader eyebrow="Analytics" title="Issue intelligence" />
      <IssueStatsCards issues={issues} />
      <section className="panel" style={{ padding: 24, display: "grid", gap: 16 }}>
        <h3>By status</h3>
        {byStatus.map((item) => (
          <Bar key={item.label} {...item} max={maxStatus} />
        ))}
      </section>
      <section className="panel" style={{ padding: 24, display: "grid", gap: 16 }}>
        <h3>By category</h3>
        {byCategory.map((item) => (
          <Bar key={item.label} {...item} max={maxCategory} />
        ))}
      </section>
    </main>
  );
}

export default IssueAnalytics;