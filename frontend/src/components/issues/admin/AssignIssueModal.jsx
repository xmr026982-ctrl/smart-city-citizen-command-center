import { useState } from "react";
import { STAFF_ROSTER } from "../../../constants/issueConstants";
import { assignIssue } from "../../../store/issueStore";
import { useAuth } from "../../../store/authStore";
import Button from "../../ui/Button";
import { Select } from "../../ui/Input";

function AssignIssueModal({ issue, onClose }) {
  const user = useAuth();
  const [staff, setStaff] = useState(issue?.assignedTo || "");

  if (!issue) return null;

  return (
    <div className="drawer-overlay" style={{ display: "grid", placeItems: "center" }}>
      <div className="panel" style={{ width: "min(420px, calc(100% - 32px))", padding: 24 }}>
        <h3>Assign {issue.id}</h3>
        <div style={{ margin: "16px 0" }}>
          <Select value={staff} onChange={(e) => setStaff(e.target.value)}>
            <option value="">Unassigned</option>
            {STAFF_ROSTER.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => {
              assignIssue(issue.id, staff, user.name);
              onClose();
            }}
          >
            Save assignment
          </Button>
        </div>
      </div>
    </div>
  );
}

export default AssignIssueModal;