import { Bookmark } from "lucide-react";
import { CATEGORY_LABEL } from "../../../constants/issueCategories";
import { PRIORITY_LABEL } from "../../../constants/issuePriorities";
import { STATUS_LABEL, publicStatus } from "../../../constants/issueStatuses";
import { formatDateTime } from "../../../utils/formatDate";
import { toggleSaved } from "../../../store/issueStore";
import { useAuth } from "../../../store/authStore";
import Button from "../../ui/Button";
import IssueComments from "./IssueComments";
import IssueLocationPreview from "./IssueLocationPreview";
import IssuePriorityBadge from "./IssuePriorityBadge";
import IssueSLAIndicator from "./IssueSLAIndicator";
import IssueStatusBadge from "./IssueStatusBadge";
import IssueStatusTimeline from "./IssueStatusTimeline";
import AdminConfirmClose from "../admin/AdminConfirmClose";

function IssueDetails({ issue }) {
  const user = useAuth();
  const isCitizen = user.role === "citizen";
  const shownStatus = isCitizen ? publicStatus(issue.status) : issue.status;

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
          {!isCitizen ? <IssuePriorityBadge priority={issue.priority} /> : null}
          <IssueStatusBadge status={issue.status} citizen={isCitizen} />
          {isCitizen ? (
            <Button type="button" variant="secondary" onClick={() => toggleSaved(issue.id)}>
              <Bookmark size={14} />
              {issue.saved ? "Saved" : "Save"}
            </Button>
          ) : null}
        </div>
      </header>

      <IssueLocationPreview issue={issue} />

      <section>
        <h3 style={{ fontSize: 15, marginBottom: 8 }}>Description</h3>
        <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.6 }}>{issue.description}</p>
      </section>

      {isCitizen ? (
        <section className="panel" style={{ padding: 16 }}>
          <p className="eyebrow">Update</p>
          <p style={{ marginTop: 8, fontSize: 14 }}>
            Current status: <strong>{STATUS_LABEL[shownStatus]}</strong>
          </p>
          <p style={{ marginTop: 6, color: "var(--muted)", fontSize: 13 }}>
            City operations is handling this report. Staff names stay internal.
          </p>
        </section>
      ) : (
        <>
          <AdminConfirmClose issue={issue} />
          <section className="panel" style={{ padding: 16 }}>
            <p className="eyebrow">Dispatch</p>
            <p style={{ marginTop: 8, fontSize: 14 }}>
              Assigned to <strong>{issue.assignedTo || "Unassigned"}</strong>
            </p>
            <p style={{ marginTop: 8, color: "var(--muted)", fontSize: 13 }}>
              Status: <strong>{STATUS_LABEL[issue.status]}</strong>
              {" · "}
              Priority: <strong>{PRIORITY_LABEL[issue.priority]}</strong>
            </p>
          </section>
        </>
      )}

      <section>
        <h3 style={{ fontSize: 15, marginBottom: 12 }}>Status timeline</h3>
        <IssueStatusTimeline current={issue.status} events={issue.timeline} citizen={isCitizen} />
      </section>

      <IssueComments issue={issue} />

      <div style={{ display: "flex", gap: 32, flexWrap: "wrap", borderTop: "1px solid var(--border)", paddingTop: 16 }}>
        <div>
          <p className="eyebrow">Reported on</p>
          <p style={{ marginTop: 6 }}>{formatDateTime(issue.createdAt)}</p>
        </div>
        <div>
          <p className="eyebrow">Last updated</p>
          <p style={{ marginTop: 6 }}>{formatDateTime(issue.updatedAt)}</p>
        </div>
        {!isCitizen ? (
          <div>
            <p className="eyebrow">Service window</p>
            <p style={{ marginTop: 6 }}>
              <IssueSLAIndicator issue={issue} />
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default IssueDetails;