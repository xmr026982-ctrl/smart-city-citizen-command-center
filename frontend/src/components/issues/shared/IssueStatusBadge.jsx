import { STATUS_LABEL, publicStatus } from "../../../constants/issueStatuses";

function IssueStatusBadge({ status, citizen = false }) {
  const shown = citizen ? publicStatus(status) : status;
  return (
    <span className={`badge status-${shown}`}>
      <span className="badge-dot" style={{ background: "currentColor" }} />
      {STATUS_LABEL[shown]}
    </span>
  );
}

export default IssueStatusBadge;