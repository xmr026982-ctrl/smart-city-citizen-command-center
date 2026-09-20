import IssueCard from "./IssueCard";
import IssueEmptyState from "./IssueEmptyState";

function IssueList({ issues, onSelect }) {
  if (!issues.length) {
    return <IssueEmptyState />;
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {issues.map((issue) => (
        <IssueCard key={issue.id} issue={issue} onClick={() => onSelect(issue)} />
      ))}
    </div>
  );
}

export default IssueList;