import { useState } from "react";
import IssueDetailsDrawer from "../../components/issues/shared/IssueDetailsDrawer";
import IssueList from "../../components/issues/shared/IssueList";
import PageHeader from "../../components/layout/PageHeader";
import { useAuth } from "../../store/authStore";
import { useIssues } from "../../store/issueStore";

function SavedReports() {
  const user = useAuth();
  const issues = useIssues();
  const [selectedId, setSelectedId] = useState(null);
  const saved = issues.filter(
    (issue) => issue.saved && (issue.reporterId === user.id || issue.reportedBy === user.name)
  );
  const selected = issues.find((issue) => issue.id === selectedId) || null;

  return (
    <main className="page-stack">
      <PageHeader
        eyebrow="Saved reports"
        title="Watchlist"
        description="Pin issues you want to follow without scanning the full list."
      />
      <IssueList issues={saved} onSelect={(issue) => setSelectedId(issue.id)} />
      <IssueDetailsDrawer issue={selected} onClose={() => setSelectedId(null)} />
    </main>
  );
}

export default SavedReports;