import { useState } from "react";
import { STATUS_LABEL } from "../../../constants/issueStatuses";
import { updateStatus } from "../../../store/issueStore";
import { useAuth } from "../../../store/authStore";
import StaffCloseRequestModal from "./StaffCloseRequestModal";

function StaffStatusUpdate({ issue }) {
  const user = useAuth();
  const [askClose, setAskClose] = useState(false);
  const locked = issue.status === "submitted" || issue.status === "resolved";

  const onChange = (value) => {
    if (value === "resolved" || value === "pending_review") {
      setAskClose(true);
      return;
    }
    updateStatus(issue.id, value, user.name, user.role);
  };

  return (
    <>
      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--subtle)" }}>
          Field status
        </span>
        <select
          value={issue.status === "pending_review" ? "pending_review" : issue.status}
          disabled={locked || issue.status === "pending_review"}
          onChange={(e) => onChange(e.target.value)}
          style={{
            height: 42,
            borderRadius: 12,
            border: "1px solid var(--line)",
            background: locked ? "rgba(244,246,248,0.9)" : "rgba(255,255,255,0.92)",
            padding: "0 12px",
            fontSize: 13.5,
          }}
        >
          {issue.status === "submitted" && (
            <option value="submitted">{STATUS_LABEL.submitted}</option>
          )}
          {(issue.status === "acknowledged" || issue.status === "in_progress" || issue.status === "pending_review") && (
            <option value="acknowledged">{STATUS_LABEL.acknowledged}</option>
          )}
          {(issue.status === "acknowledged" || issue.status === "in_progress" || issue.status === "pending_review") && (
            <option value="in_progress">{STATUS_LABEL.in_progress}</option>
          )}
          {issue.status === "pending_review" && (
            <option value="pending_review">{STATUS_LABEL.pending_review}</option>
          )}
          {issue.status === "resolved" && (
            <option value="resolved">{STATUS_LABEL.resolved}</option>
          )}
          {!locked && issue.status !== "pending_review" && (
            <option value="resolved">{STATUS_LABEL.resolved}</option>
          )}
        </select>
        {issue.status === "acknowledged" && (
          <span style={{ fontSize: 12, color: "var(--subtle)" }}>
            Choose In Progress when you start, or Resolved to ask Admin to close.
          </span>
        )}
        {issue.status === "pending_review" && (
          <span style={{ fontSize: 12, color: "#b45309" }}>
            Close request sent. Waiting for Admin.
          </span>
        )}
      </label>

      {askClose && (
        <StaffCloseRequestModal issue={issue} onClose={() => setAskClose(false)} />
      )}
    </>
  );
}

export default StaffStatusUpdate;