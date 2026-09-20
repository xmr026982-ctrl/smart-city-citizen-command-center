import { useState } from "react";
import IssueDetailsDrawer from "../../components/issues/shared/IssueDetailsDrawer";
import IssueTable from "../../components/issues/shared/IssueTable";
import PageHeader from "../../components/layout/PageHeader";
import { useIssues } from "../../store/issueStore";

function StaffWorkQueue() {
  const issues = useIssues();
  const [selectedId, setSelectedId] = useState(null);
  const queue = issues.filter((issue) => issue.status !== "resolved");
  const selected = issues.find((issue) => issue.id === selectedId) || null;

  return (
    <main className="page-stack">
      <PageHeader
        eyebrow="Work queue"
        title="City intake"
        description="Open issues across wards. Open a record to update status or leave a note."
      />
      <IssueTable issues={queue} onSelect={(issue) => setSelectedId(issue.id)} />
      <IssueDetailsDrawer issue={selected} onClose={() => setSelectedId(null)} />
    </main>
  );
}

export default StaffWorkQueue;