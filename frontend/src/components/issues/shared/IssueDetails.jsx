import { Bookmark } from "lucide-react";
import { CATEGORY_LABEL } from "../../../constants/issueCategories";
import { ISSUE_PRIORITIES, PRIORITY_LABEL } from "../../../constants/issuePriorities";
import { ISSUE_STATUSES, STATUS_LABEL } from "../../../constants/issueStatuses";
import { formatDateTime } from "../../../utils/formatDate";
import {
  canSetPriority,
  canUpdateStatus,
} from "../../../utils/permissionHelper";
import { setPriority, toggleSaved, updateStatus } from "../../../store/issueStore";
import { useAuth } from "../../../store/authStore";
import Button from "../../ui/Button";
import { Select } from "../../ui/Input";
import IssueComments from "./IssueComments";
import IssueLocationPreview from "./IssueLocationPreview";
import IssuePriorityBadge from "./IssuePriorityBadge";
import IssueSLAIndicator from "./IssueSLAIndicator";
import IssueStatusBadge from "./IssueStatusBadge";
import IssueStatusTimeline from "./IssueStatusTimeline";

function IssueDetails({ issue }) {
  const user = useAuth();
  const canStatus = canUpdateStatus(user.role);
  const canPriority = canSetPriority(user.role);
  const isCitizen = user.role === "citizen";

  return (
    <div className="page-stack">
      {/* Header */}
      <header style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <p className="mono">{issue.id}</p>
          <h1 style={{ marginTop: 8, fontSize: 28 }}>{issue.title}</h1>
          <p style={{ marginTop: 8, color: "var(--muted)", fontSize: 14 }}>
            {CATEGORY_LABEL[issue.category]} · {issue.ward} · {issue.location}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
          {!isCitizen ? <IssuePriorityBadge priority={issue.priority} /> : null}
          <IssueStatusBadge status={issue.status} />
          {isCitizen ? (
            <Button type="button" variant="secondary" onClick={() => toggleSaved(issue.id)}>
              <Bookmark size={14} />
              {issue.saved ? "Saved" : "Save"}
            </Button>
          ) : null}
        </div>
      </header>

      {/* Description */}
      <section>
        <h3 style={{ fontSize: 15, marginBottom: 8 }}>Description</h3>
        <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.6 }}>
          {issue.description}
        </p>
      </section>

      {/* Location */}
      <IssueLocationPreview issue={issue} />

      {/* Dispatch / Status info – FIXED assignee (no dropdown) */}
      <section className="panel" style={{ padding: 16 }}>
        {isCitizen ? (
          <>
            <p className="eyebrow">Update</p>
            <p style={{ marginTop: 8, fontSize: 14 }}>
              {issue.status === "resolved"
                ? "City operations marked this report resolved."
                : issue.assignedTo
                  ? "City operations is handling this report."
                  : "Your report is with the command desk."}
            </p>
            <p style={{ marginTop: 6, color: "var(--muted)", fontSize: 13 }}>
              Current status: <strong>{STATUS_LABEL[issue.status]}</strong>. Staff names stay internal.
            </p>
          </>
        ) : (
          <>
            <p className="eyebrow">Dispatch</p>
            <p style={{ marginTop: 8, fontSize: 14 }}>
              Assigned to{" "}
              <strong style={{ color: issue.assignedTo ? "var(--primary-deep)" : "var(--subtle)" }}>
                {issue.assignedTo || "Unassigned"}
              </strong>
            </p>
            <p style={{ marginTop: 6, color: "var(--muted)", fontSize: 13 }}>
              Priority set by command: <strong>{PRIORITY_LABEL[issue.priority]}</strong>.
              Assignment can only be changed from the Dispatch Board.
            </p>
          </>
        )}
      </section>

      {/* Status + Priority controls (no Assignee) */}
      {(canStatus || canPriority) && (
        <div className="form-grid panel" style={{ padding: 16 }}>
          {canStatus && (
            <label className="field">
              <span className="field-label">Status</span>
              <Select
                value={issue.status}
                onChange={(e) => updateStatus(issue.id, e.target.value, user.name)}
              >
                {ISSUE_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABEL[status]}
                  </option>
                ))}
              </Select>
            </label>
          )}

          {canPriority && (
            <label className="field">
              <span className="field-label">Priority</span>
              <Select
                value={issue.priority}
                onChange={(e) => setPriority(issue.id, e.target.value, user.name, user.role)}
              >
                {ISSUE_PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {PRIORITY_LABEL[priority]}
                  </option>
                ))}
              </Select>
            </label>
          )}
        </div>
      )}

      {/* Timeline */}
      <section>
        <h3 style={{ fontSize: 15, marginBottom: 12 }}>Status timeline</h3>
        <IssueStatusTimeline current={issue.status} events={issue.timeline} />
      </section>

      {/* Comments */}
      <IssueComments issue={issue} />

      {/* Reported / Updated / SLA dates – restored */}
      <div
        style={{
          display: "flex",
          gap: 32,
          flexWrap: "wrap",
          borderTop: "1px solid var(--border)",
          paddingTop: 16,
        }}
      >
        <div>
          <p className="eyebrow">Reported on</p>
          <p style={{ marginTop: 6 }}>{formatDateTime(issue.createdAt)}</p>
        </div>
        <div>
          <p className="eyebrow">Last updated</p>
          <p style={{ marginTop: 6 }}>{formatDateTime(issue.updatedAt)}</p>
        </div>
        {!isCitizen && (
          <div>
            <p className="eyebrow">Service window</p>
            <p style={{ marginTop: 6 }}>
              <IssueSLAIndicator issue={issue} />
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default IssueDetails;