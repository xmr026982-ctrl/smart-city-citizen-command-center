import "../styles/issue.css";

import IssueForm from "../components/issues/IssueForm";
import IssuePhotoUpload from "../components/issues/IssuePhotoUpload";

function IssueManagement() {
  const issueHighlights = [
    {
      number: "01",
      title: "Describe the issue",
      description:
        "Tell us what happened with a clear and simple description.",
    },
    {
      number: "02",
      title: "Add the location",
      description:
        "Provide the affected area so the right department can respond.",
    },
    {
      number: "03",
      title: "Attach evidence",
      description:
        "Upload photos to help the team understand the problem faster.",
    },
  ];

  return (
    <main className="issue-management-page">
      <section className="issue-page-hero">
        <div className="issue-hero-content">
          <span className="issue-eyebrow">
            CITIZEN SERVICES / ISSUE REPORTING
          </span>

          <h1>Report a city issue</h1>

          <p>
            Help improve your city by reporting problems around you.
            Share the details, add the location, and track the progress
            of your report from one place.
          </p>

          <div className="issue-hero-status">
            <span className="issue-status-dot"></span>

            <span>Every report helps build a better city</span>
          </div>
        </div>

        <div className="issue-hero-card">
          <span className="issue-hero-card-label">YOUR IMPACT</span>

          <strong>Make your city better.</strong>

          <p>
            Report civic problems responsibly and help local teams
            understand what needs attention.
          </p>
        </div>
      </section>

      <section className="issue-highlights">
        {issueHighlights.map((item) => (
          <article className="issue-highlight-card" key={item.number}>
            <span className="issue-highlight-number">
              {item.number}
            </span>

            <div>
              <h2>{item.title}</h2>

              <p>{item.description}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="issue-form-section">
        <div className="issue-section-heading">
          <div>
            <span className="issue-eyebrow">NEW REPORT</span>

            <h2>Tell us what needs attention</h2>

            <p>
              Complete the details below. Required fields will be
              clearly marked.
            </p>
          </div>

          <span className="issue-form-secure-label">
            <span className="issue-status-dot"></span>
            Citizen report
          </span>
        </div>

        <div className="issue-form-wrapper">
          <IssueForm />

          <IssuePhotoUpload />
        </div>
      </section>
    </main>
  );
}

export default IssueManagement;