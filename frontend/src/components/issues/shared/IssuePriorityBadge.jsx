import { PRIORITY_LABEL } from "../../../constants/issuePriorities";

function IssuePriorityBadge({ priority }) {
  return (
    <span className={`badge priority-${priority}`}>{PRIORITY_LABEL[priority]}</span>
  );
}

export default IssuePriorityBadge;