import { STATUS_LABEL } from "../../../constants/issueStatuses";

function IssueStatusBadge({ status }) {
  return (
    <span className={`badge status-${status}`}>
      <span className="badge-dot" style={{ background: "currentColor" }} />
      {STATUS_LABEL[status]}
    </span>
  );
}

export default IssueStatusBadge;