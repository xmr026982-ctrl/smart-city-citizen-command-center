import { useState } from "react";
import { Link } from "react-router-dom";
import { Activity, ArrowRight, CheckCircle2, FolderOpen, Layers } from "lucide-react";
import IssueDetailsDrawer from "../../components/issues/shared/IssueDetailsDrawer";
import IssuePriorityBadge from "../../components/issues/shared/IssuePriorityBadge";
import IssueStatusBadge from "../../components/issues/shared/IssueStatusBadge";
import PageHeader from "../../components/layout/PageHeader";
import GlassCard from "../../components/ui/GlassCard";
import { useAuth } from "../../store/authStore";
import { useIssues } from "../../store/issueStore";
import { formatDate } from "../../utils/formatDate";

function StaffDashboard() {
  const user = useAuth();
  const issues = useIssues();
  const [selectedId, setSelectedId] = useState(null);

  const mine = issues.filter((issue) => issue.assignedTo === user.name);
  const open = mine.filter((issue) => issue.status !== "resolved");
  const inProgress = mine.filter((issue) => issue.status === "in_progress");
  const resolved = mine.filter((issue) => issue.status === "resolved");
  const feed = [...mine]
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 4);
  const selected = issues.find((issue) => issue.id === selectedId) || null;

  const cards = [
    { label: "Assigned to me", value: mine.length, hint: "Total tickets on you", icon: FolderOpen, color: "#0ea5e9" },
    { label: "Open field work", value: open.length, hint: "Still live", icon: Activity, color: "#f59e0b" },
    { label: "In progress", value: inProgress.length, hint: "On site", icon: Layers, color: "#8b5cf6" },
    { label: "Resolved", value: resolved.length, hint: "Closed by you", icon: CheckCircle2, color: "#10b981" },
  ];

  return (
    <main className="page-wrap">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <PageHeader
          eyebrow="Field Layer · Operations"
          title="Staff Operations"
          description="Your live load. Update status from Assigned to Me — not from the issue file."
        />
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "7px 14px", borderRadius: 999,
          background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)",
          fontSize: 12.5, fontWeight: 600, color: "#059669",
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%", background: "#10b981",
            boxShadow: "0 0 0 3px rgba(16,185,129,0.25)", animation: "livePulse 1.8s ease infinite",
          }} />
          Field Online
        </div>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 12,
        marginTop: 22,
      }}>
        {cards.map((card, idx) => (
          <GlassCard key={card.label} delay={idx * 40}>
            <div style={{ padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 10,
                  background: `${card.color}18`, display: "grid", placeItems: "center",
                }}>
                  <card.icon size={15} color={card.color} />
                </div>
                <p style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--subtle)" }}>
                  {card.label}
                </p>
              </div>
              <p style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 720 }}>{card.value}</p>
              <p style={{ marginTop: 4, fontSize: 12.5, color: "var(--muted)" }}>{card.hint}</p>
            </div>
          </GlassCard>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
        <Link to="/staff/assigned" style={{
          height: 40, padding: "0 16px", borderRadius: 12,
          background: "linear-gradient(135deg, #0ea5e9, #0284c7)",
          color: "white", fontWeight: 650, fontSize: 13.5,
          display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none",
          boxShadow: "0 8px 18px rgba(14,165,233,0.28)",
        }}>
          Open assigned work <ArrowRight size={15} />
        </Link>
        <Link to="/staff/queue" style={{
          height: 40, padding: "0 16px", borderRadius: 12,
          background: "white", border: "1px solid var(--line)",
          color: "var(--fg)", fontWeight: 600, fontSize: 13.5,
          display: "inline-flex", alignItems: "center", textDecoration: "none",
        }}>
          City intake
        </Link>
      </div>

      <p style={{
        marginTop: 26, marginBottom: 10,
        fontSize: 11, fontWeight: 650, letterSpacing: "0.1em",
        textTransform: "uppercase", color: "var(--subtle)",
      }}>
        Live field feed
      </p>

      <div style={{ display: "grid", gap: 10 }}>
        {feed.length === 0 && (
          <GlassCard>
            <p style={{ padding: 28, textAlign: "center", color: "var(--subtle)" }}>No tickets on you yet.</p>
          </GlassCard>
        )}
        {feed.map((issue, idx) => (
          <GlassCard key={issue.id} delay={idx * 30} onClick={() => setSelectedId(issue.id)}>
            <div style={{
              padding: "14px 16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              cursor: "pointer",
            }}>
              <div style={{ display: "flex", gap: 10, alignItems: "baseline", minWidth: 0 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--subtle)" }}>{issue.id}</span>
                <strong style={{ fontSize: 14 }}>{issue.title}</strong>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{issue.ward}</span>
                <IssueStatusBadge status={issue.status} />
                <IssuePriorityBadge priority={issue.priority} />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--subtle)" }}>
                  {formatDate(issue.updatedAt)}
                </span>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      <IssueDetailsDrawer issue={selected} onClose={() => setSelectedId(null)} />

      <style>{`
        @keyframes livePulse {
          0%, 100% { box-shadow: 0 0 0 3px rgba(16,185,129,0.25); }
          50% { box-shadow: 0 0 0 6px rgba(16,185,129,0.1); }
        }
      `}</style>
    </main>
  );
}

export default StaffDashboard;