import { useMemo } from "react";
import {
  Activity, Layers, AlertTriangle, CheckCircle2,
  MapPin, Car, Lightbulb, Droplets, Trash2, Zap,
  ShieldAlert, MoreHorizontal
} from "lucide-react";
import PageHeader from "../../components/layout/PageHeader";
import { CATEGORY_LABEL } from "../../constants/issueCategories";
import { ISSUE_STATUSES, STATUS_LABEL } from "../../constants/issueStatuses";
import { useIssues } from "../../store/issueStore";

function pct(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

const CATEGORY_META = {
  roads: { icon: Car, color: "#0ea5e9" },
  lighting: { icon: Lightbulb, color: "#f59e0b" },
  water: { icon: Droplets, color: "#06b6d4" },
  waste: { icon: Trash2, color: "#10b981" },
  electricity: { icon: Zap, color: "#8b5cf6" },
  safety: { icon: ShieldAlert, color: "#ef4444" },
  other: { icon: MoreHorizontal, color: "#64748b" },
};

function IssueAnalytics() {
  const issues = useIssues();

  const stats = useMemo(() => {
    const total = issues.length;
    const open = issues.filter((i) => i.status !== "resolved").length;
    const inProgress = issues.filter((i) => i.status === "in_progress").length;
    const unassigned = issues.filter((i) => !i.assignedTo && i.status !== "resolved").length;
    const resolved = issues.filter((i) => i.status === "resolved").length;
    const assigned = issues.filter((i) => i.assignedTo).length;
    const critical = issues.filter((i) => i.priority === "critical" || i.priority === "high").length;

    return {
      total,
      open,
      inProgress,
      unassigned,
      resolved,
      assigned,
      critical,
      resolveRate: pct(resolved, total),
      coverage: pct(assigned, total),
      openPct: pct(open, total),
    };
  }, [issues]);

  const byStatus = ISSUE_STATUSES.map((status) => ({
    key: status,
    label: STATUS_LABEL[status],
    value: issues.filter((i) => i.status === status).length,
  }));

  const byCategory = Object.entries(CATEGORY_LABEL).map(([key, label]) => ({
    key,
    label,
    value: issues.filter((i) => i.category === key).length,
  }));

  const maxCat = Math.max(...byCategory.map((c) => c.value), 1);

  return (
    <main className="page-wrap">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <PageHeader
          eyebrow="Analytics · Neural Intel"
          title="Issue Intelligence"
          description="Live load, coverage, and category pressure across the city board."
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
          Command Intel · Live
        </div>
      </div>

      {/* Top stats */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 14,
        margin: "28px 0 24px",
      }}>
        <StatCard label="Open Board" value={stats.open} sub={`${stats.openPct}% of all reports`} icon={Layers} color="#0ea5e9" />
        <StatCard label="In Progress" value={stats.inProgress} sub="Active field work" icon={Activity} color="#f59e0b" />
        <StatCard label="Unassigned" value={stats.unassigned} sub="Waiting for dispatch" icon={MapPin} color="#ef4444" />
        <StatCard label="Resolved" value={stats.resolved} sub={`${stats.resolveRate}% close rate`} icon={CheckCircle2} color="#10b981" />
      </div>

      {/* Middle row */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.2fr) minmax(280px, 1fr)",
        gap: 16,
        marginBottom: 20,
      }}>
        <div style={{
          borderRadius: 20,
          padding: 22,
          background: "rgba(255,255,255,0.72)",
          backdropFilter: "blur(18px)",
          border: "1px solid rgba(14,165,233,0.14)",
          boxShadow: "0 10px 36px rgba(14,165,233,0.07)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--subtle)" }}>
                Status Mix
              </p>
              <h3 style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, marginTop: 4 }}>
                Pipeline Share
              </h3>
            </div>
            <span style={{ fontSize: 12, color: "var(--subtle)" }}>{stats.total} records</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {byStatus.map((item) => {
              const p = pct(item.value, stats.total);
              return (
                <div key={item.key}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
                    <span style={{ fontWeight: 500 }}>{item.label}</span>
                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--muted)" }}>
                      {item.value} · {p}%
                    </span>
                  </div>
                  <div style={{ height: 8, borderRadius: 999, background: "rgba(14,165,233,0.08)", overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: 999, width: `${p}%`,
                      background: "linear-gradient(90deg, #0ea5e9, #22d3ee)",
                      boxShadow: "0 0 12px rgba(14,165,233,0.4)",
                      transition: "width 0.8s cubic-bezier(0.22,1,0.36,1)",
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{
          borderRadius: 20,
          padding: 22,
          background: "rgba(255,255,255,0.72)",
          backdropFilter: "blur(18px)",
          border: "1px solid rgba(14,165,233,0.14)",
          boxShadow: "0 10px 36px rgba(14,165,233,0.07)",
          display: "flex",
          flexDirection: "column",
        }}>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--subtle)" }}>
            Resolution
          </p>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, marginTop: 4, marginBottom: 20 }}>
            Operational Health
          </h3>

          <div style={{ display: "flex", alignItems: "center", gap: 24, flex: 1 }}>
            <div style={{ position: "relative", width: 120, height: 120, flexShrink: 0 }}>
              <svg width="120" height="120" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(14,165,233,0.1)" strokeWidth="10" />
                <circle
                  cx="60" cy="60" r="52" fill="none"
                  stroke="url(#gaugeGrad)"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${(stats.resolveRate / 100) * 327} 327`}
                  transform="rotate(-90 60 60)"
                />
                <defs>
                  <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#0ea5e9" />
                    <stop offset="100%" stopColor="#22d3ee" />
                  </linearGradient>
                </defs>
              </svg>
              <div style={{
                position: "absolute", inset: 0, display: "grid", placeItems: "center",
                fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700,
              }}>
                {stats.resolveRate}%
              </div>
            </div>

            <div>
              <p style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>Close Rate</p>
              <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 4 }}>
                {stats.assigned} assigned · {stats.coverage}% coverage
              </p>
              <p style={{ fontSize: 13, color: "var(--muted)" }}>
                {stats.critical} high / critical still on board
              </p>
            </div>
          </div>

          <div style={{ marginTop: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
              <span>Assignment Coverage</span>
              <span style={{ fontFamily: "var(--font-mono)" }}>{stats.coverage}%</span>
            </div>
            <div style={{ height: 8, borderRadius: 999, background: "rgba(14,165,233,0.08)", overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 999, width: `${stats.coverage}%`,
                background: "linear-gradient(90deg, #0ea5e9, #22d3ee)",
                boxShadow: "0 0 12px rgba(14,165,233,0.35)",
              }} />
            </div>
          </div>
        </div>
      </div>

      {/* Category pressure with icons */}
      <div style={{
        borderRadius: 20,
        padding: 22,
        background: "rgba(255,255,255,0.72)",
        backdropFilter: "blur(18px)",
        border: "1px solid rgba(14,165,233,0.14)",
        boxShadow: "0 10px 36px rgba(14,165,233,0.07)",
      }}>
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--subtle)" }}>
          Category Pressure
        </p>
        <h3 style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, marginTop: 4, marginBottom: 20 }}>
          Where the city is reporting
        </h3>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 14,
        }}>
          {byCategory.map((item) => {
            const meta = CATEGORY_META[item.key] || CATEGORY_META.other;
            const Icon = meta.icon;
            const color = meta.color;
            const p = pct(item.value, stats.total);
            const heightPct = Math.max(8, (item.value / maxCat) * 100);

            return (
              <div
                key={item.key}
                style={{
                  background: "rgba(255,255,255,0.62)",
                  border: "1px solid rgba(14,165,233,0.12)",
                  borderRadius: 16,
                  padding: 16,
                  display: "flex",
                  flexDirection: "column",
                  position: "relative",
                  overflow: "hidden",
                  transform: "perspective(900px) rotateX(1.5deg)",
                  transition: "transform 200ms, box-shadow 200ms",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "perspective(900px) rotateX(0deg) translateY(-4px)";
                  e.currentTarget.style.boxShadow = `0 16px 36px ${color}22`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "perspective(900px) rotateX(1.5deg)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <div style={{
                  position: "absolute", top: 0, left: 0, right: 0, height: 2,
                  background: `linear-gradient(90deg, transparent, ${color}70, transparent)`,
                }} />

                <div style={{
                  width: 38, height: 38, borderRadius: 12, marginBottom: 12,
                  background: `${color}16`,
                  display: "grid", placeItems: "center",
                  boxShadow: `0 0 0 1px ${color}22`,
                }}>
                  <Icon size={18} color={color} strokeWidth={1.8} />
                </div>

                <p style={{ fontSize: 11, color: "var(--subtle)", marginBottom: 6 }}>{item.label}</p>
                <p style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700, marginBottom: 12 }}>
                  {item.value}
                </p>

                <div style={{ flex: 1, minHeight: 48, display: "flex", alignItems: "flex-end" }}>
                  <div style={{
                    width: "100%",
                    height: `${heightPct}%`,
                    borderRadius: "8px 8px 4px 4px",
                    background: `linear-gradient(180deg, ${color}cc, ${color})`,
                    boxShadow: `0 0 16px ${color}40`,
                  }} />
                </div>

                <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 10, fontFamily: "var(--font-mono)" }}>
                  {p}% of board
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes livePulse {
          0%, 100% { box-shadow: 0 0 0 3px rgba(16,185,129,0.25); }
          50% { box-shadow: 0 0 0 6px rgba(16,185,129,0.1); }
        }
      `}</style>
    </main>
  );
}

function StatCard({ label, value, sub, icon: Icon, color }) {
  return (
    <div
      style={{
        borderRadius: 18,
        padding: "18px 18px 16px",
        background: "rgba(255,255,255,0.72)",
        backdropFilter: "blur(16px)",
        border: "1px solid rgba(255,255,255,0.75)",
        boxShadow: "0 8px 28px rgba(14,165,233,0.07)",
        transform: "perspective(900px) rotateX(1.5deg)",
        transition: "transform 200ms, box-shadow 200ms",
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "perspective(900px) rotateX(0deg) translateY(-3px)";
        e.currentTarget.style.boxShadow = `0 16px 40px ${color}22`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "perspective(900px) rotateX(1.5deg)";
        e.currentTarget.style.boxShadow = "0 8px 28px rgba(14,165,233,0.07)";
      }}
    >
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, transparent, ${color}55, transparent)`,
      }} />
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: `${color}18`, display: "grid", placeItems: "center",
        }}>
          <Icon size={18} color={color} />
        </div>
        <p style={{
          fontSize: 11, fontWeight: 600, letterSpacing: "0.08em",
          textTransform: "uppercase", color: "var(--subtle)",
        }}>
          {label}
        </p>
      </div>
      <p style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 700, lineHeight: 1, marginBottom: 6 }}>
        {value}
      </p>
      <p style={{ fontSize: 12.5, color: "var(--muted)" }}>{sub}</p>
    </div>
  );
}

export default IssueAnalytics;