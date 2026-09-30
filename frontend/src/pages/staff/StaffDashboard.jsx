import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Layers, Activity, FolderOpen, CheckCircle2, ArrowRight
} from "lucide-react";
import IssueDetailsDrawer from "../../components/issues/shared/IssueDetailsDrawer";
import IssueStatusBadge from "../../components/issues/shared/IssueStatusBadge";
import IssuePriorityBadge from "../../components/issues/shared/IssuePriorityBadge";
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
  const openMine = mine.filter((i) => i.status !== "resolved");
  const selected = issues.find((i) => i.id === selectedId) || null;

  const stats = [
    { label: "Assigned to me", value: mine.length, icon: FolderOpen, color: "#0ea5e9", sub: "Total tickets on you" },
    { label: "Open field work", value: openMine.length, icon: Activity, color: "#f59e0b", sub: "Still live" },
    { label: "In progress", value: mine.filter((i) => i.status === "in_progress").length, icon: Layers, color: "#8b5cf6", sub: "On site" },
    { label: "Resolved", value: mine.filter((i) => i.status === "resolved").length, icon: CheckCircle2, color: "#10b981", sub: "Closed by you" },
  ];

  return (
    <main className="page-wrap">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
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
        gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
        gap: 14,
        margin: "28px 0 24px",
      }}>
        {stats.map((s, i) => (
          <GlassCard key={s.label} delay={i * 50}>
            <div style={{ padding: "16px 16px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 11,
                  background: `${s.color}16`, display: "grid", placeItems: "center",
                }}>
                  <s.icon size={17} color={s.color} />
                </div>
                <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--subtle)" }}>
                  {s.label}
                </p>
              </div>
              <p style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 700, lineHeight: 1 }}>{s.value}</p>
              <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>{s.sub}</p>
            </div>
          </GlassCard>
        ))}
      </div>

      <div style={{ display: "flex", gap: 11, flexWrap: "wrap", marginBottom: 24 }}>
        <Link to="/staff/assigned" style={primaryBtn}>Open assigned work <ArrowRight size={15} /></Link>
        <Link to="/staff/queue" style={secondaryBtn}>City intake</Link>
      </div>

      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--subtle)", marginBottom: 10 }}>
        Live Field Feed
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {openMine.length === 0 && (
          <GlassCard>
            <p style={{ padding: 28, textAlign: "center", color: "var(--subtle)" }}>
              No open tickets on you.
            </p>
          </GlassCard>
        )}
        {openMine.slice(0, 6).map((issue, idx) => (
          <GlassCard key={issue.id} delay={idx * 40} onClick={() => setSelectedId(issue.id)}>
            <div style={{
              padding: "14px 18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 14,
              flexWrap: "wrap",
              cursor: "pointer",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 220 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--subtle)" }}>{issue.id}</span>
                <span style={{ fontWeight: 500, fontSize: 13.5 }}>{issue.title}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
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

const primaryBtn = {
  display: "inline-flex", alignItems: "center", gap: 8,
  height: 42, padding: "0 20px", borderRadius: 12,
  background: "linear-gradient(135deg, #0ea5e9, #0284c7)",
  color: "white", fontSize: 13.5, fontWeight: 600, textDecoration: "none",
  boxShadow: "0 8px 22px rgba(14,165,233,0.3)",
};

const secondaryBtn = {
  display: "inline-flex", alignItems: "center", gap: 8,
  height: 42, padding: "0 18px", borderRadius: 12,
  background: "rgba(255,255,255,0.85)", border: "1px solid var(--line)",
  color: "var(--fg)", fontSize: 13.5, fontWeight: 600, textDecoration: "none",
};

export default StaffDashboard;