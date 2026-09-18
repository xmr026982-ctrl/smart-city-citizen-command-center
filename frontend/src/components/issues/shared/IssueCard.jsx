import IssueStatusBadge from "./IssueStatusBadge";

function IssueCard({ report }) {
  return (
    <article className="issue-card">
      <div className="issue-card-main">
        <div className="issue-card-top">
          <span className="issue-card-id">{report.id}</span>
          <IssueStatusBadge status={report.status} />
        </div>

        <h3 className="issue-card-title">{report.title}</h3>

        <div className="issue-card-meta">
          <span>{report.category}</span>
          <span className="issue-card-dot">•</span>
          <span>{report.location}</span>
        </div>
      </div>

      <div className="issue-card-footer">
        <div className="issue-card-dates">
          <span>Reported {report.createdAt}</span>
          <span>Updated {report.updatedAt}</span>
        </div>

        <span className="issue-card-link">View details →</span>
      </div>
    </article>
  );
}

export default IssueCard;