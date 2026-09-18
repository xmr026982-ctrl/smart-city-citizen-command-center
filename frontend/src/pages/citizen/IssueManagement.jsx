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
    <main className="issue-management-page issue-management">
      {/* =========================
          HERO SECTION
      ========================= */}

      <section className="issue-page-hero hero-section">
        <div className="issue-hero-content hero-card">
          <span className="issue-eyebrow eyebrow">
            CITIZEN SERVICES / ISSUE REPORTING
          </span>

          <h1>Report a city issue</h1>

          <p>
            Help improve your city by reporting problems around you. Share the
            details, add the location, and track the progress of your report
            from one place.
          </p>

          <div className="issue-hero-status hero-note">
            <span className="issue-status-dot"></span>

            <span>Every report helps build a better city</span>
          </div>
        </div>

        <div className="issue-hero-card impact-card">
          <span className="issue-hero-card-label eyebrow">
            YOUR IMPACT
          </span>

          <h2>Make your city better.</h2>

          <p>
            Report civic problems responsibly and help local teams understand
            what needs attention.
          </p>
        </div>
      </section>

      {/* =========================
          HIGHLIGHT STEPS
      ========================= */}

      <section className="issue-highlights steps-grid">
        {issueHighlights.map((item) => (
          <article className="issue-highlight-card step-card" key={item.number}>
            <div>
              <span className="issue-highlight-number step-number">
                {item.number}
              </span>

              <h3>{item.title}</h3>
            </div>

            <p>{item.description}</p>
          </article>
        ))}
      </section>

      {/* =========================
          REPORT FORM SECTION
      ========================= */}

      <section className="issue-form-section report-section">
        <div className="issue-section-heading report-header">
          <div>
            <span className="issue-eyebrow eyebrow">NEW REPORT</span>

            <h2>Tell us what needs attention</h2>

            <p>
              Complete the details below. Required fields will be clearly
              marked.
            </p>
          </div>

          <span className="issue-form-secure-label citizen-badge">
            <span className="issue-status-dot"></span>
            Citizen report
          </span>
        </div>

        <div className="issue-form-wrapper form-layout">
          {/* Left side: Issue details */}
          <div className="issue-form-content form-left">
            <IssueForm />
          </div>

          {/* Right side: Photo upload */}
          <aside className="issue-photo-content form-right">
            <IssuePhotoUpload />
          </aside>
        </div>
      </section>
    </main>
  );
}

export default IssueManagement;