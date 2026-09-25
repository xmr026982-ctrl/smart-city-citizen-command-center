import { Bookmark } from "lucide-react";
import { CATEGORY_LABEL } from "../../../constants/issueCategories";
import { STAFF_ROSTER } from "../../../constants/issueConstants";
import { ISSUE_PRIORITIES, PRIORITY_LABEL } from "../../../constants/issuePriorities";
import { ISSUE_STATUSES, STATUS_LABEL } from "../../../constants/issueStatuses";
import { formatDateTime } from "../../../utils/formatDate";
import {
  canAssignIssues,
  canSetPriority,
  canUpdateStatus,
} from "../../../utils/permissionHelper";
import { assignIssue, setPriority, toggleSaved, updateStatus } from "../../../store/issueStore";
import { useAuth } from "../../../store/authStore";
import Button from "../../ui/Button";
import { Select } from "../../ui/Input";
import IssueComments from "./IssueComments";
import IssuePriorityBadge from "./IssuePriorityBadge";
import IssueSLAIndicator from "./IssueSLAIndicator";
import IssueStatusBadge from "./IssueStatusBadge";
import IssueStatusTimeline from "./IssueStatusTimeline";

function IssueDetails({ issue }) {
  const user = useAuth();
  const canStatus = canUpdateStatus(user.role);
  const canAssign = canAssignIssues(user.role);
  const canPriority = canSetPriority(user.role);

  return (
    <div className="page-stack">
      <header style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <p className="mono">{issue.id}</p>
          <h1 style={{ marginTop: 8, fontSize: 28 }}>{issue.title}</h1>
          <p style={{ marginTop: 8, color: "var(--muted)", fontSize: 14 }}>
            {CATEGORY_LABEL[issue.category]} · {issue.ward} · {issue.location}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
          <IssuePriorityBadge priority={issue.priority} />
          <IssueStatusBadge status={issue.status} />
          {user.role === "citizen" ? (
            <Button type="button" variant="secondary" onClick={() => toggleSaved(issue.id)}>
              <Bookmark size={14} />
              {issue.saved ? "Saved" : "Save"}
            </Button>
          ) : null}
        </div>
      </header>

      <section>
        <h3 style={{ fontSize: 15, marginBottom: 8 }}>Description</h3>
        <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.6 }}>{issue.description}</p>
      </section>

      <section className="panel" style={{ padding: 16 }}>
        <div className="section-head">
          <div>
            <p className="eyebrow">Dispatch</p>
            <p style={{ marginTop: 8, fontSize: 14 }}>
              Assigned to <strong>{issue.assignedTo || "Unassigned"}</strong>
            </p>
          </div>
          <IssuePriorityBadge priority={issue.priority} />
        </div>
        <p style={{ marginTop: 10, color: "var(--muted)", fontSize: 13 }}>
          Priority set by command: <strong>{PRIORITY_LABEL[issue.priority]}</strong>
          {canPriority
            ? ". You can update assignment and priority."
            : ". Visible to staff, locked from field changes."}
        </p>
      </section>

      {issue.photos?.length ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          {issue.photos.map((photo) => (
            <img
              key={photo.id}
              src={photo.url}
              alt={photo.name}
              style={{ width: "100%", aspectRatio: "3 / 2", objectFit: "cover", borderRadius: 12 }}
            />
          ))}
        </div>
      ) : null}

      {canStatus || canAssign || canPriority ? (
        <div className="form-grid panel" style={{ padding: 16 }}>
          {canStatus ? (
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
          ) : null}

          {canAssign ? (
            <label className="field">
              <span className="field-label">Assignee</span>
              <Select
                value={issue.assignedTo || ""}
                onChange={(e) => assignIssue(issue.id, e.target.value, user.name, user.role)}
              >
                <option value="">Unassigned</option>
                {STAFF_ROSTER.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </Select>
            </label>
          ) : null}

          {canPriority ? (
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
          ) : null}
        </div>
      ) : null}

      <section>
        <h3 style={{ fontSize: 15, marginBottom: 12 }}>Status timeline</h3>
        <IssueStatusTimeline current={issue.status} events={issue.timeline} />
      </section>

      <IssueComments issue={issue} />

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
        <div>
          <p className="eyebrow">Service window</p>
          <p style={{ marginTop: 6 }}>
            <IssueSLAIndicator issue={issue} />
          </p>
        </div>
      </div>
    </div>
  );
}

export default IssueDetails;