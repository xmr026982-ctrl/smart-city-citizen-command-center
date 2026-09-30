import PageHeader from "../../components/layout/PageHeader";
import GlassCard from "../../components/ui/GlassCard";
import { Activity, CheckCircle2, FolderOpen, Timer } from "lucide-react";
import { useAuth } from "../../store/authStore";
import { useIssues } from "../../store/issueStore";

function StaffPerformance() {
  const user = useAuth();
  const mine = useIssues().filter((issue) => issue.assignedTo === user.name);
  const open = mine.filter((i) => i.status !== "resolved").length;
  const resolved = mine.filter((i) => i.status === "resolved").length;
  const inProgress = mine.filter((i) => i.status === "in_progress").length;

  const cards = [
    { label: "Load", value: mine.length, icon: FolderOpen, color: "#0ea5e9" },
    { label: "Open", value: open, icon: Timer, color: "#f59e0b" },
    { label: "On site", value: inProgress, icon: Activity, color: "#8b5cf6" },
    { label: "Closed", value: resolved, icon: CheckCircle2, color: "#10b981" },
  ];

  return (
    <main className="page-wrap">
      <PageHeader
        eyebrow="Field Layer · Load"
        title="Field Load"
        description="Your contribution snapshot. Same numbers Admin sees on the roster."
      />
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: 12,
        marginTop: 24,
      }}>
        {cards.map((s, i) => (
          <GlassCard key={s.label} delay={i * 50}>
            <div style={{ padding: 16, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: `${s.color}18`, display: "grid", placeItems: "center",
              }}>
                <s.icon size={16} color={s.color} />
              </div>
              <div>
                <p style={{ fontSize: 11, color: "var(--subtle)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</p>
                <p style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700 }}>{s.value}</p>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
    </main>
  );
}

export default StaffPerformance;