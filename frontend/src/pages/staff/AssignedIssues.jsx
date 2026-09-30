import { useMemo, useState } from "react";
import { MapPin, Calendar } from "lucide-react";
import IssueDetailsDrawer from "../../components/issues/shared/IssueDetailsDrawer";
import IssuePriorityBadge from "../../components/issues/shared/IssuePriorityBadge";
import IssueStatusBadge from "../../components/issues/shared/IssueStatusBadge";
import PageHeader from "../../components/layout/PageHeader";
import GlassCard from "../../components/ui/GlassCard";
import StaffStatusUpdate from "../../components/issues/staff/StaffStatusUpdate";
import { CATEGORY_LABEL } from "../../constants/issueCategories";
import { STATUS_LABEL, ISSUE_STATUSES } from "../../constants/issueStatuses";
import { useAuth } from "../../store/authStore";
import { useIssues } from "../../store/issueStore";
import { formatDate } from "../../utils/formatDate";

function AssignedIssues() {
  const user = useAuth();
  const issues = useIssues();
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(null);

  const mine = issues.filter((issue) => issue.assignedTo === user.name);
  const filtered = useMemo(
    () => (filter === "all" ? mine : mine.filter((issue) => issue.status === filter)),
    [mine, filter]
  );
  const selected = issues.find((issue) => issue.id === selectedId) || null;

  return (
    <main className="page-wrap">
      <PageHeader
        eyebrow="Field Layer · Assigned"
        title="Assigned to Me"
        description="Set In Progress here. Choose Resolved to ask Admin to close. The issue file stays locked."
      />

      <div style={{ display: "flex", gap: 8, margin: "20px 0 16px", flexWrap: "wrap" }}>
        {["all", ...ISSUE_STATUSES].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            style={{
              height: 34, padding: "0 14px", borderRadius: 999,
              border: filter === s ? "none" : "1px solid var(--line)",
              background: filter === s ? "linear-gradient(135deg, #0ea5e9, #0284c7)" : "rgba(255,255,255,0.9)",
              color: filter === s ? "white" : "var(--muted)",
              fontSize: 12.5, fontWeight: 600, cursor: "pointer",
            }}
          >
            {s === "all" ? "All" : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {filtered.length === 0 && (
          <GlassCard>
            <p style={{ padding: 40, textAlign: "center", color: "var(--subtle)" }}>
              No tickets in this filter.
            </p>
          </GlassCard>
        )}

        {filtered.map((issue, idx) => (
          <GlassCard key={issue.id} delay={idx * 40}>
            <div style={{ padding: "16px 18px" }}>
              <div onClick={() => setSelectedId(issue.id)} style={{ cursor: "pointer" }}>
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
                <p style={{ marginTop: 6, fontSize: 12.5, color: "var(--muted)", display: "flex", alignItems: "center", gap: 5 }}>
                  <MapPin size={12} /> {issue.location}
                </p>
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <IssueStatusBadge status={issue.status} />
                  <IssuePriorityBadge priority={issue.priority} />
                  <span style={{ fontSize: 12, color: "var(--subtle)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <Calendar size={11} /> {formatDate(issue.updatedAt)}
                  </span>
                </div>
              </div>

              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  marginTop: 14,
                  paddingTop: 14,
                  borderTop: "1px solid rgba(14,165,233,0.1)",
                }}
              >
                <StaffStatusUpdate issue={issue} />
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      <IssueDetailsDrawer issue={selected} onClose={() => setSelectedId(null)} />
    </main>
  );
}

export default AssignedIssues;