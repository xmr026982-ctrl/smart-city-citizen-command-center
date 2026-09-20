import IssueList from "../shared/IssueList";

function CitizenReportHistory({ issues, onSelect }) {
  return <IssueList issues={issues} onSelect={onSelect} />;
}

export default CitizenReportHistory;