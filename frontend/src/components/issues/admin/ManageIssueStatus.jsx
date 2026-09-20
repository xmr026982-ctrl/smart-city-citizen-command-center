import { ISSUE_STATUSES, STATUS_LABEL } from "../../../constants/issueStatuses";
import { updateStatus } from "../../../store/issueStore";
import { useAuth } from "../../../store/authStore";
import { Select } from "../../ui/Input";

function ManageIssueStatus({ issue }) {
  const user = useAuth();

  return (
    <Select value={issue.status} onChange={(e) => updateStatus(issue.id, e.target.value, user.name)}>
      {ISSUE_STATUSES.map((status) => (
        <option key={status} value={status}>
          {STATUS_LABEL[status]}
        </option>
      ))}
    </Select>
  );
}

export default ManageIssueStatus;