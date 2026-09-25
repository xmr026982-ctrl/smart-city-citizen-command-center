import { useState } from "react";
import { ISSUE_PRIORITIES, PRIORITY_LABEL } from "../../../constants/issuePriorities";
import { useAuth } from "../../../store/authStore";
import { setPriority } from "../../../store/issueStore";
import Button from "../../ui/Button";
import { Select } from "../../ui/Input";

function ChangePriorityModal({ issue, onClose }) {
  const user = useAuth();
  const [priority, setLocal] = useState(issue?.priority || "medium");

  if (!issue) return null;

  if (user.role !== "admin") {
    return (
      <div className="drawer-overlay" style={{ display: "grid", placeItems: "center" }}>
        <div className="panel" style={{ width: "min(420px, calc(100% - 32px))", padding: 24 }}>
          <h3>Priority locked</h3>
          <p style={{ marginTop: 8, color: "var(--muted)", fontSize: 14 }}>
            Only command admin can change priority.
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
            <Button type="button" variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="drawer-overlay" style={{ display: "grid", placeItems: "center" }}>
      <div className="panel" style={{ width: "min(420px, calc(100% - 32px))", padding: 24 }}>
        <h3>Priority for {issue.id}</h3>
        <div style={{ margin: "16px 0" }}>
          <Select value={priority} onChange={(e) => setLocal(e.target.value)}>
            {ISSUE_PRIORITIES.map((item) => (
              <option key={item} value={item}>
                {PRIORITY_LABEL[item]}
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
              setPriority(issue.id, priority, user.name, user.role);
              onClose();
            }}
          >
            Update priority
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ChangePriorityModal;