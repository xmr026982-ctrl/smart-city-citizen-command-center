import { useState } from "react";
import IssueDetailsDrawer from "../../components/issues/shared/IssueDetailsDrawer";
import IssueFilters from "../../components/issues/shared/IssueFilters";
import IssueList from "../../components/issues/shared/IssueList";
import PageHeader from "../../components/layout/PageHeader";
import { useAuth } from "../../store/authStore";
import { useIssues } from "../../store/issueStore";

function AssignedIssues() {
  const user = useAuth();
  const issues = useIssues();
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const mine = issues.filter((issue) => issue.assignedTo === user.name);
  const filtered = filter === "all" ? mine : mine.filter((issue) => issue.status === filter);
  const selected = issues.find((issue) => issue.id === selectedId) || null;

  return (
    <main className="page-stack">
      <PageHeader
        eyebrow="Assigned to me"
        title="Field book"
        description={`Tickets currently owned by ${user.name}.`}
      />
      <IssueFilters value={filter} onChange={setFilter} />
      <IssueList issues={filtered} onSelect={(issue) => setSelectedId(issue.id)} />
      <IssueDetailsDrawer issue={selected} onClose={() => setSelectedId(null)} />
    </main>
  );
}

export default AssignedIssues;