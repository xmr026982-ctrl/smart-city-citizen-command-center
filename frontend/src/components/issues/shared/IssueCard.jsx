import { CATEGORY_LABEL } from "../../../constants/issueCategories";
import { formatDate } from "../../../utils/formatDate";
import IssuePriorityBadge from "./IssuePriorityBadge";
import IssueReportId from "./IssueReportId";
import IssueStatusBadge from "./IssueStatusBadge";

function IssueCard({ issue, onClick }) {
  return (
    <article className="issue-card" onClick={onClick}>
      <div className="issue-card-top">
        <IssueReportId id={issue.id} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <IssuePriorityBadge priority={issue.priority} />
          <IssueStatusBadge status={issue.status} />
        </div>
      </div>
      <h3 style={{ marginTop: 12, fontSize: 16 }}>{issue.title}</h3>
      <p style={{ marginTop: 8, color: "var(--muted)", fontSize: 14 }}>
        {CATEGORY_LABEL[issue.category]} · {issue.ward} · {issue.location}
      </p>
      <div className="issue-card-footer">
        <div>
          <div>Reported {formatDate(issue.createdAt)}</div>
          <div>Updated {formatDate(issue.updatedAt)}</div>
        </div>
        <span style={{ color: "var(--accent)", fontWeight: 600 }}>View details →</span>
      </div>
    </article>
  );
}

export default IssueCard;