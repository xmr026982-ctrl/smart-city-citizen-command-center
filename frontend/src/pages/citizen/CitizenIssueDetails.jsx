import { useParams, Link } from "react-router-dom";
import IssueStatusBadge from "../components/issues/IssueStatusBadge";
import IssueStatusTimeline from "../components/issues/IssueStatusTimeline";
import "../styles/issue.css";

function IssueDetailsPage() {
  const { id } = useParams();

  // Temporary mock data – replace with real API later
  const report = {
    id: id || "ISS-2401",
    title: "Broken streetlight near Central Park",
    category: "Street Lighting",
    location: "Sector 12, Main Road, near the children’s park entrance",
    description:
      "The streetlight has been non-functional for the past week. The area becomes very dark after sunset, creating safety concerns for pedestrians and residents.",
    status: "In Progress",
    createdAt: "12 Sep 2026",
    updatedAt: "15 Sep 2026",
    photos: [],
  };

  return (
    <main className="issue-management-page">
      <div style={{ marginBottom: 28 }}>
        <Link to="/my-reports" className="issue-back-link">
          ← Back to My Reports
        </Link>
      </div>

      <section className="issue-form-section" style={{ padding: "48px 52px" }}>
        <div className="issue-details-header">
          <div>
            <span className="issue-card-id">{report.id}</span>
            <h1 className="issue-details-title">{report.title}</h1>
            <div className="issue-card-meta" style={{ marginTop: 12 }}>
              <span>{report.category}</span>
              <span className="issue-card-dot">•</span>
              <span>{report.location}</span>
            </div>
          </div>

          <IssueStatusBadge status={report.status} />
        </div>

        <div className="issue-details-block">
          <h3>Description</h3>
          <p>{report.description}</p>
        </div>

        <div className="issue-details-block">
          <h3>Status Timeline</h3>
          <IssueStatusTimeline currentStatus={report.status} />
        </div>

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
      </section>
    </main>
  );
}

export default IssueDetailsPage;