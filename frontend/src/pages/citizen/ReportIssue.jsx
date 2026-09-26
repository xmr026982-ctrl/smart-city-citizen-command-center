import { useState } from "react";
import CitizenReportForm from "../../components/issues/citizen/CitizenReportForm";
import IssuePhotoUpload from "../../components/issues/citizen/IssuePhotoUpload";
import { addIssue, nextIssueId } from "../../store/issueStore";
import { useAuth } from "../../store/authStore";
import { useToast } from "../../components/ui/Toast";

function ReportIssue() {
  const user = useAuth();
  const { toast } = useToast();
  const [photos, setPhotos] = useState([]);

  const handleSubmit = (draft) => {
    const createdAt = new Date().toISOString();
    addIssue({
      id: nextIssueId(),
      title: draft.title.trim(),
      description: draft.description.trim(),
      category: draft.category,
      location: draft.location.trim(),
      ward: draft.ward,
      lat: draft.lat,
      lng: draft.lng,
      photos,
      reportedBy: user.name,
      reporterId: user.id,
      status: "submitted",
      priority: "medium",
      assignedTo: null,
      comments: [],
      timeline: [{ status: "submitted", at: createdAt, by: user.name }],
      createdAt,
      updatedAt: createdAt,
      saved: false,
      slaHours: 48,
    });
    setPhotos([]);
    toast("Report submitted successfully");
  };

  const steps = [
    {
      n: "01",
      title: "Describe the issue",
      body: "Tell us what happened with a clear and simple description.",
    },
    {
      n: "02",
      title: "Add the location",
      body: "Provide the affected area so the right department can respond.",
    },
    {
      n: "03",
      title: "Attach evidence",
      body: "Upload photos to help the team understand the problem faster.",
    },
  ];

  return (
    <main className="page-stack">
      <section className="hero-grid">
        <div className="hero-card">
          <p className="eyebrow">Citizen services / Issue reporting</p>
          <h1>Report a city issue</h1>
          <p>
            Help improve your city by reporting problems around you. Share the
            details, add the location, and track the progress of your report from
            one place.
          </p>
          <div className="hero-live">
            <span className="live-dot" />
            Every report helps build a better city
          </div>
        </div>
        <aside className="impact-card">
          <p className="eyebrow">Your impact</p>
          <h2>Make your city better.</h2>
          <p>Report civic problems so local teams know what needs attention.</p>
        </aside>
      </section>

      <section className="step-grid">
        {steps.map((step) => (
          <article key={step.n} className="step-card">
            <p className="eyebrow">{step.n}</p>
            <h3>{step.title}</h3>
            <p>{step.body}</p>
          </article>
        ))}
      </section>

      <section className="panel" style={{ padding: 32 }}>
        <div className="section-head">
          <div>
            <p className="eyebrow">New report</p>
            <h2 style={{ margin: "12px 0 8px" }}>Tell us what needs attention</h2>
            <p style={{ color: "var(--muted)", maxWidth: 520 }}>
              Complete the details below. Required fields are marked in red.
            </p>
          </div>
          <span className="citizen-chip">
            <span className="live-dot" />
            Citizen report
          </span>
        </div>
        <div className="report-layout">
          <CitizenReportForm onSubmit={handleSubmit} />
          <aside className="photo-panel">
            <IssuePhotoUpload files={photos} onChange={setPhotos} />
          </aside>
        </div>
      </section>
    </main>
  );
}

export default ReportIssue;