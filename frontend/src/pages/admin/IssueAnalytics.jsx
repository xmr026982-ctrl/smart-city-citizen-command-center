import PageHeader from "../../components/layout/PageHeader";
import { CATEGORY_LABEL } from "../../constants/issueCategories";
import { ISSUE_STATUSES, STATUS_LABEL } from "../../constants/issueStatuses";
import { useIssues } from "../../store/issueStore";

function pct(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function IssueAnalytics() {
  const issues = useIssues();
  const total = issues.length;
  const open = issues.filter((i) => i.status !== "resolved").length;
  const inProgress = issues.filter((i) => i.status === "in_progress").length;
  const unassigned = issues.filter((i) => !i.assignedTo).length;
  const resolved = issues.filter((i) => i.status === "resolved").length;
  const assigned = issues.filter((i) => i.assignedTo).length;
  const critical = issues.filter((i) => i.priority === "critical" || i.priority === "high").length;
  const resolveRate = pct(resolved, total);
  const coverage = pct(assigned, total);

  const byStatus = ISSUE_STATUSES.map((status) => ({
    label: STATUS_LABEL[status],
    value: issues.filter((issue) => issue.status === status).length,
  }));

  const byCategory = Object.entries(CATEGORY_LABEL).map(([key, label]) => ({
    label,
    value: issues.filter((issue) => issue.category === key).length,
  }));

  return (
    <main className="page-stack">
      <div className="section-head">
        <PageHeader
          eyebrow="Analytics"
          title="Issue intelligence"
          description="Live load, coverage, and category pressure across the city board."
        />
        <span className="citizen-chip">
          <span className="live-dot" />
          Command intel
        </span>
      </div>

      <section className="stats-grid">
        <article className="stat-card">
          <p className="eyebrow">Open board</p>
          <strong>{open}</strong>
          <p>{pct(open, total)}% of all reports</p>
        </article>
        <article className="stat-card">
          <p className="eyebrow">In progress</p>
          <strong>{inProgress}</strong>
          <p>Active field work</p>
        </article>
        <article className="stat-card">
          <p className="eyebrow">Unassigned</p>
          <strong>{unassigned}</strong>
          <p>Waiting for dispatch</p>
        </article>
        <article className="stat-card">
          <p className="eyebrow">Resolved</p>
          <strong>{resolved}</strong>
          <p>{resolveRate}% close rate</p>
        </article>
      </section>

      <section className="intel-grid">
        <article className="panel intel-panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">Status mix</p>
              <h3 style={{ marginTop: 8 }}>Pipeline share</h3>
            </div>
            <span className="mono">{total} records</span>
          </div>
          <div className="intel-row" style={{ marginTop: 24 }}>
            {byStatus.map((item) => (
              <div key={item.label}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
                  <span>{item.label}</span>
                  <span className="mono">
                    {item.value} · {pct(item.value, total)}%
                  </span>
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${pct(item.value, total)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="panel intel-panel">
          <p className="eyebrow">Resolution</p>
          <h3 style={{ marginTop: 8 }}>Operational health</h3>
          <div className="gauge-wrap" style={{ marginTop: 28 }}>
            <div className="gauge" style={{ ["--p"]: resolveRate }}>
              <span>{resolveRate}%</span>
            </div>
            <div>
              <p style={{ fontWeight: 600 }}>Close rate</p>
              <p style={{ marginTop: 8, color: "var(--muted)", fontSize: 14 }}>
                {assigned} assigned · {coverage}% coverage
              </p>
              <p style={{ marginTop: 8, color: "var(--muted)", fontSize: 14 }}>
                {critical} high / critical still on the board
              </p>
            </div>
          </div>
          <div style={{ marginTop: 28 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
              <span>Assignment coverage</span>
              <span className="mono">{coverage}%</span>
            </div>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${coverage}%` }} />
            </div>
          </div>
        </article>
      </section>

      <section className="panel intel-panel">
        <p className="eyebrow">Category pressure</p>
        <h3 style={{ margin: "8px 0 20px" }}>Where the city is reporting</h3>
        <div className="category-grid">
          {byCategory.map((item) => (
            <div key={item.label} className="cat-tile">
              <p className="eyebrow">{item.label}</p>
              <strong>{item.value}</strong>
              <div className="bar-track" style={{ marginTop: 12 }}>
                <div className="bar-fill" style={{ width: `${pct(item.value, total)}%` }} />
              </div>
              <p className="mono" style={{ marginTop: 8 }}>
                {pct(item.value, total)}% of board
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

export default IssueAnalytics;