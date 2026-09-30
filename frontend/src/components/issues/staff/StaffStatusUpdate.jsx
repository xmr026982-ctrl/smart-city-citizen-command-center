import { STAFF_STATUSES, STATUS_LABEL } from "../../../constants/issueStatuses";
import { updateStatus } from "../../../store/issueStore";
import { useAuth } from "../../../store/authStore";

function StaffStatusUpdate({ issue }) {
  const user = useAuth();
  const locked = issue.status === "submitted" || issue.status === "resolved";

  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--subtle)" }}>
        Field status
      </span>
      <select
        value={issue.status}
        disabled={locked}
        onChange={(e) => updateStatus(issue.id, e.target.value, user.name, user.role)}
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
        {issue.status === "acknowledged" && (
          <option value="acknowledged">{STATUS_LABEL.acknowledged}</option>
        )}
        {issue.status === "resolved" && (
          <option value="resolved">{STATUS_LABEL.resolved}</option>
        )}
        {!locked &&
          STAFF_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABEL[status]}
            </option>
          ))}
      </select>
      {issue.status === "submitted" && (
        <span style={{ fontSize: 12, color: "var(--subtle)" }}>
          Wait for Admin to acknowledge and assign.
        </span>
      )}
      {issue.status === "acknowledged" && (
        <span style={{ fontSize: 12, color: "var(--subtle)" }}>
          Open the menu and choose In Progress when you start the site.
        </span>
      )}
    </label>
  );
}

export default StaffStatusUpdate;