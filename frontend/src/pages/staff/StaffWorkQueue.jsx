import { useState } from "react";
import IssueDetailsDrawer from "../../components/issues/shared/IssueDetailsDrawer";
import IssuePriorityBadge from "../../components/issues/shared/IssuePriorityBadge";
import IssueStatusBadge from "../../components/issues/shared/IssueStatusBadge";
import PageHeader from "../../components/layout/PageHeader";
import GlassCard from "../../components/ui/GlassCard";
import { CATEGORY_LABEL } from "../../constants/issueCategories";
import { useIssues } from "../../store/issueStore";
import { formatDate } from "../../utils/formatDate";

function StaffWorkQueue() {
  const issues = useIssues();
  const [selectedId, setSelectedId] = useState(null);
  const queue = issues.filter((issue) => issue.status !== "resolved");
  const selected = issues.find((issue) => issue.id === selectedId) || null;

  return (
    <main className="page-wrap">
      <PageHeader
        eyebrow="Field Layer · Intake"
        title="City Intake"
        description="Open city board. View a file here. Status updates belong on Assigned to Me."
      />

      <div style={{ display: "grid", gap: 10, marginTop: 20 }}>
        {queue.map((issue, idx) => (
          <GlassCard key={issue.id} delay={idx * 35} onClick={() => setSelectedId(issue.id)}>
            <div style={{
              padding: "16px 18px",
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: 16,
              cursor: "pointer",
            }}>
              <div>
                <div style={{ display: "flex", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--subtle)" }}>{issue.id}</span>
                  <span style={{ fontSize: 12, color: "var(--subtle)" }}>{issue.ward}</span>
                  <span style={{ fontSize: 12, color: "var(--primary-deep)" }}>
                    {CATEGORY_LABEL[issue.category] || issue.category}
                  </span>
                </div>
                <h3 style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 650, margin: 0 }}>
                  {issue.title}
                </h3>
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <IssueStatusBadge status={issue.status} />
                  <IssuePriorityBadge priority={issue.priority} />
                  <span style={{ fontSize: 12.5, color: issue.assignedTo ? "var(--fg)" : "var(--subtle)" }}>
                    {issue.assignedTo || "Unassigned"}
                  </span>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--subtle)" }}>
                  Updated
                </p>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, marginTop: 4 }}>
                  {formatDate(issue.updatedAt)}
                </p>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      <IssueDetailsDrawer issue={selected} onClose={() => setSelectedId(null)} />
    </main>
  );
}

export default StaffWorkQueue;