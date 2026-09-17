import IssueStatusBadge from "./IssueStatusBadge";
import IssueStatusTimeline from "./IssueStatusTimeline";

function IssueDetailsDrawer({ report, isOpen, onClose }) {
  if (!isOpen || !report) return null;

  return (
    <>
      {/* Overlay */}
      <div className="issue-drawer-overlay" onClick={onClose}></div>

      {/* Drawer panel */}
      <aside className="issue-drawer">
        <div className="issue-drawer-header">
          <div>
            <span className="issue-card-id">{report.id}</span>
            <h2 className="issue-drawer-title">{report.title}</h2>
          </div>

          <button
            type="button"
            className="issue-drawer-close"
            onClick={onClose}
            aria-label="Close details"
          >
            ×
          </button>
        </div>

        <div className="issue-drawer-body">
          {/* Status + meta */}
          <div className="issue-drawer-meta">
            <IssueStatusBadge status={report.status} />
            <div className="issue-card-meta" style={{ marginTop: 14 }}>
              <span>{report.category}</span>
              <span className="issue-card-dot">•</span>
              <span>{report.location}</span>
            </div>
          </div>

          {/* Description */}
          <div className="issue-details-block">
            <h3>Description</h3>
            <p>{report.description}</p>
          </div>

          {/* Timeline */}
          <div className="issue-details-block">
            <h3>Status Timeline</h3>
            <IssueStatusTimeline currentStatus={report.status} />
          </div>

          {/* Dates */}
          <div className="issue-details-meta-row">
            <div>
              <span className="issue-meta-label">Reported on</span>
              <strong>{report.createdAt}</strong>
            </div>
            <div>
              <span className="issue-meta-label">Last updated</span>
              <strong>{report.updatedAt}</strong>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

export default IssueDetailsDrawer;