import IssueTable from "../shared/IssueTable";

function StaffWorkQueue({ issues, onSelect }) {
  return <IssueTable issues={issues} onSelect={onSelect} />;
}

export default StaffWorkQueue;