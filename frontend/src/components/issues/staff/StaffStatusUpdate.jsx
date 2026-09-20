import { ISSUE_STATUSES, STATUS_LABEL } from "../../../constants/issueStatuses";
import { updateStatus } from "../../../store/issueStore";
import { useAuth } from "../../../store/authStore";
import { Label, Select } from "../../ui/Input";

function StaffStatusUpdate({ issue }) {
  const user = useAuth();

  return (
    <div className="field">
      <Label htmlFor="staff-status">Update status</Label>
      <Select
        id="staff-status"
        value={issue.status}
        onChange={(e) => updateStatus(issue.id, e.target.value, user.name)}
      >
        {ISSUE_STATUSES.map((status) => (
          <option key={status} value={status}>
            {STATUS_LABEL[status]}
          </option>
        ))}
      </Select>
    </div>
  );
}

export default StaffStatusUpdate;