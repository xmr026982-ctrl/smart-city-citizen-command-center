import { useMemo, useState } from "react";
import IssueDetailsDrawer from "../../components/issues/shared/IssueDetailsDrawer";
import IssueFilters from "../../components/issues/shared/IssueFilters";
import IssueList from "../../components/issues/shared/IssueList";
import PageHeader from "../../components/layout/PageHeader";
import { useAuth } from "../../store/authStore";
import { useIssues } from "../../store/issueStore";

function MyReports() {
  const user = useAuth();
  const issues = useIssues();
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(null);

  const mine = useMemo(
    () => issues.filter((issue) => issue.reporterId === user.id || issue.reportedBy === user.name),
    [issues, user]
  );
  const filtered = filter === "all" ? mine : mine.filter((issue) => issue.status === filter);
  const selected = issues.find((issue) => issue.id === selectedId) || null;

  return (
    <main className="page-stack">
      <PageHeader
        eyebrow="Citizen services / My reports"
        title="Your submitted reports"
        description="Track every civic issue you have reported. View live status and history in one place."
      />
      <section className="panel" style={{ padding: 28 }}>
        <p className="eyebrow">Your activity</p>
        <h2 style={{ margin: "10px 0 16px" }}>
          {filtered.length} report{filtered.length === 1 ? "" : "s"}
        </h2>
        <IssueFilters value={filter} onChange={setFilter} />
        <div style={{ marginTop: 24 }}>
          <IssueList issues={filtered} onSelect={(issue) => setSelectedId(issue.id)} />
        </div>
      </section>
      <IssueDetailsDrawer issue={selected} onClose={() => setSelectedId(null)} />
    </main>
  );
}

export default MyReports;