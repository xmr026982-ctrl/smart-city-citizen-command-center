import { Link, useParams } from "react-router-dom";
import { MapPin } from "lucide-react";
import IssuePriorityBadge from "../../components/issues/shared/IssuePriorityBadge";
import IssueStatusBadge from "../../components/issues/shared/IssueStatusBadge";
import IssueStatusTimeline from "../../components/issues/shared/IssueStatusTimeline";
import PageHeader from "../../components/layout/PageHeader";
import { CATEGORY_LABEL } from "../../constants/issueCategories";
import { publicStatus } from "../../constants/issueStatuses";
import { useIssues } from "../../store/issueStore";
import { formatDateTime } from "../../utils/formatDate";

function CitizenIssueDetails() {
  const { id } = useParams();
  const issue = useIssues().find((item) => item.id === id);
  if (!issue) return <main className="page-wrap"><PageHeader eyebrow="Citizen Layer" title="Report not found" description="This file is not on the board." /></main>;

  const status = publicStatus(issue.status);
  const mapTo = Number.isFinite(issue.lat) && Number.isFinite(issue.lng)
    ? `/map?lat=${issue.lat}&lng=${issue.lng}&zone=${encodeURIComponent(issue.ward)}`
    : "/map";

  return (
    <main className="page-wrap">
      <PageHeader eyebrow="Citizen Layer · File" title={issue.title} description="Status is fixed here. The city confirms each move before you see it." />
      <section style={panel}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontFamily: "var(--font-mono)", color: "var(--subtle)" }}>{issue.id}</span>
          <IssueStatusBadge status={status} />
          <IssuePriorityBadge priority={issue.priority} />
          <span style={{ color: "var(--primary-deep)" }}>{CATEGORY_LABEL[issue.category]}</span>
        </div>
        <p style={{ marginTop: 14, lineHeight: 1.65 }}>{issue.description}</p>
        <div style={geo}>
          <MapPin size={14} color="#0ea5e9" />
          <div>
            <p style={{ fontWeight: 650 }}>{issue.location}</p>
            <p style={{ fontSize: 12.5, color: "var(--muted)" }}>{issue.ward}{Number.isFinite(issue.lat) ? ` · ${issue.lat.toFixed(5)}, ${issue.lng.toFixed(5)}` : ""}</p>
          </div>
        </div>
        <p style={{ marginTop: 10, fontSize: 12.5, color: "var(--subtle)" }}>Reported {formatDateTime(issue.createdAt)} · Updated {formatDateTime(issue.updatedAt)}</p>
        <Link to={mapTo} style={mapBtn}>Open this point on the map</Link>
        <div style={{ marginTop: 20 }}>
          <IssueStatusTimeline issue={{ ...issue, status, timeline: issue.timeline.map((step) => ({ ...step, status: publicStatus(step.status) })) }} />
        </div>
      </section>
    </main>
  );
}

const panel = { marginTop: 20, padding: 22, borderRadius: 22, background: "rgba(255,255,255,0.74)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.8)", boxShadow: "0 8px 28px rgba(14,165,233,0.07)" };
const geo = { marginTop: 14, display: "flex", gap: 10, alignItems: "flex-start", padding: 12, borderRadius: 14, background: "rgba(14,165,233,0.06)", border: "1px solid rgba(14,165,233,0.14)" };
const mapBtn = { marginTop: 14, display: "inline-flex", height: 40, padding: "0 14px", borderRadius: 12, background: "linear-gradient(135deg, #0ea5e9, #0284c7)", color: "white", textDecoration: "none", alignItems: "center", fontWeight: 650 };

export default CitizenIssueDetails;