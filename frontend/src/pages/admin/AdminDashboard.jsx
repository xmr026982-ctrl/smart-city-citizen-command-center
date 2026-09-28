import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Layers, Activity, MapPin, CheckCircle2,
  ArrowRight, Zap, Shield, BarChart3,
  Car, Lightbulb, Droplets, Trash2,
  ShieldAlert, MoreHorizontal
} from "lucide-react";
import IssueDetailsDrawer from "../../components/issues/shared/IssueDetailsDrawer";
import IssueStatusBadge from "../../components/issues/shared/IssueStatusBadge";
import IssuePriorityBadge from "../../components/issues/shared/IssuePriorityBadge";
import PageHeader from "../../components/layout/PageHeader";
import { CATEGORY_LABEL } from "../../constants/issueCategories";
import { useIssues } from "../../store/issueStore";
import { formatDate } from "../../utils/formatDate";

const CATEGORY_ICONS = {
  roads: Car,
  lighting: Lightbulb,
  water: Droplets,
  waste: Trash2,
  electricity: Zap,
  safety: ShieldAlert,
  other: MoreHorizontal,
};

const CATEGORY_COLORS = {
  roads: "#0ea5e9",
  lighting: "#f59e0b",
  water: "#06b6d4",
  waste: "#10b981",
  electricity: "#8b5cf6",
  safety: "#ef4444",
  other: "#64748b",
};

function AdminDashboard() {
  const issues = useIssues();
  const [selectedId, setSelectedId] = useState(null);
  const selected = issues.find((i) => i.id === selectedId) || null;

  const stats = useMemo(() => {
    const open = issues.filter((i) => i.status !== "resolved").length;
    const inProgress = issues.filter((i) => i.status === "in_progress").length;
    const unassigned = issues.filter((i) => !i.assignedTo && i.status !== "resolved").length;
    const resolved = issues.filter((i) => i.status === "resolved").length;
    return { open, inProgress, unassigned, resolved, total: issues.length };
  }, [issues]);

  const byCategory = Object.entries(CATEGORY_LABEL).map(([key, label]) => ({
    key,
    label,
    count: issues.filter((i) => i.category === key).length,
  }));

  const recent = issues.slice(0, 5);

  return (
    <main className="page-wrap">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <PageHeader
          eyebrow="Command · Neural Hub"
          title="Admin Control"
          description="City-wide issue load, assignment gaps, and category mix."
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
          Systems Online
        </div>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
        gap: 14,
        margin: "28px 0 24px",
      }}>
        <GlassStat
          label="Open"
          value={stats.open}
          icon={Layers}
          color="#0ea5e9"
          sub={`${stats.total ? Math.round((stats.open / stats.total) * 100) : 0}% of board`}
        />
        <GlassStat label="In Progress" value={stats.inProgress} icon={Activity} color="#f59e0b" sub="Active field work" />
        <GlassStat label="Unassigned" value={stats.unassigned} icon={MapPin} color="#ef4444" sub="Awaiting dispatch" />
        <GlassStat label="Resolved" value={stats.resolved} icon={CheckCircle2} color="#10b981" sub="Closed tickets" />
      </div>

      <div style={{ marginBottom: 24 }}>
        <p style={{
          fontSize: 11, fontWeight: 600, letterSpacing: "0.1em",
          textTransform: "uppercase", color: "var(--subtle)", marginBottom: 14,
        }}>
          Category Pressure
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
          {byCategory.map((item) => {
            const Icon = CATEGORY_ICONS[item.key] || MoreHorizontal;
            const color = CATEGORY_COLORS[item.key] || "#64748b";
            return (
              <div
                key={item.key}
                style={{
                  borderRadius: 18,
                  padding: "18px 16px 16px",
                  background: "rgba(255,255,255,0.7)",
                  backdropFilter: "blur(16px) saturate(1.4)",
                  border: "1px solid rgba(255,255,255,0.7)",
                  boxShadow: "0 4px 24px rgba(14,165,233,0.06), inset 0 1px 0 rgba(255,255,255,0.8)",
                  transform: "perspective(900px) rotateX(2.5deg)",
                  transition: "transform 220ms, box-shadow 220ms",
                  position: "relative",
                  overflow: "hidden",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "perspective(900px) rotateX(0deg) translateY(-5px)";
                  e.currentTarget.style.boxShadow = `0 20px 40px ${color}22, inset 0 1px 0 rgba(255,255,255,0.9)`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "perspective(900px) rotateX(2.5deg)";
                  e.currentTarget.style.boxShadow = "0 4px 24px rgba(14,165,233,0.06), inset 0 1px 0 rgba(255,255,255,0.8)";
                }}
              >
                <div style={{
                  position: "absolute", top: 0, left: 0, right: 0, height: 2,
                  background: `linear-gradient(90deg, transparent, ${color}55, transparent)`,
                }} />
                <div style={{
                  width: 40, height: 40, borderRadius: 12, marginBottom: 14,
                  background: `${color}16`, display: "grid", placeItems: "center",
                }}>
                  <Icon size={18} color={color} strokeWidth={1.8} />
                </div>
                <p style={{
                  fontSize: 11, fontWeight: 600, letterSpacing: "0.07em",
                  textTransform: "uppercase", color: "var(--subtle)", marginBottom: 8,
                }}>
                  {item.label}
                </p>
                <p style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 700, lineHeight: 1 }}>
                  {item.count}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", gap: 11, flexWrap: "wrap", marginBottom: 28 }}>
        <Link to="/admin/queue" style={primaryBtn}>Open all issues <ArrowRight size={15} /></Link>
        <Link to="/admin/assignments" style={secondaryBtn}><Zap size={15} /> Assignment board</Link>
        <Link to="/admin/analytics" style={secondaryBtn}><BarChart3 size={15} /> Analytics</Link>
        <Link to="/admin/staff" style={secondaryBtn}><Shield size={15} /> Staff Management</Link>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 4px" }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--subtle)" }}>
              Live Feed
            </p>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, marginTop: 2 }}>
              Recent Issues
            </h3>
          </div>
          <Link to="/admin/queue" style={{ fontSize: 13, fontWeight: 500, color: "var(--primary)" }}>
            View all →
          </Link>
        </div>

        {recent.map((issue) => (
          <div
            key={issue.id}
            onClick={() => setSelectedId(issue.id)}
            style={{
              borderRadius: 18,
              padding: "14px 18px",
              background: "rgba(255,255,255,0.74)",
              backdropFilter: "blur(16px) saturate(1.4)",
              border: "1px solid rgba(255,255,255,0.75)",
              boxShadow: "0 8px 28px rgba(14,165,233,0.07), inset 0 1px 0 rgba(255,255,255,0.85)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 14,
              flexWrap: "wrap",
              position: "relative",
              overflow: "hidden",
              transform: "perspective(900px) rotateX(2deg)",
              transition: "transform 220ms, box-shadow 220ms",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "perspective(900px) rotateX(0deg) translateY(-4px)";
              e.currentTarget.style.boxShadow = "0 18px 40px rgba(14,165,233,0.16), inset 0 1px 0 rgba(255,255,255,0.9)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "perspective(900px) rotateX(2deg)";
              e.currentTarget.style.boxShadow = "0 8px 28px rgba(14,165,233,0.07), inset 0 1px 0 rgba(255,255,255,0.85)";
            }}
          >
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, height: 2,
              background: "linear-gradient(90deg, transparent, rgba(14,165,233,0.55), transparent)",
            }} />

            <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1, minWidth: 240 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--subtle)" }}>
                {issue.id}
              </span>
              <span style={{ fontWeight: 500, fontSize: 13.5 }}>
                {issue.title}
              </span>
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

function GlassStat({ label, value, icon: Icon, color, sub }) {
  return (
    <div
      style={{
        borderRadius: 18,
        padding: "18px 16px 16px",
        background: "rgba(255,255,255,0.72)",
        backdropFilter: "blur(16px) saturate(1.4)",
        border: "1px solid rgba(255,255,255,0.75)",
        boxShadow: "0 4px 24px rgba(14,165,233,0.06), inset 0 1px 0 rgba(255,255,255,0.85)",
        transform: "perspective(900px) rotateX(2.5deg)",
        transition: "transform 220ms, box-shadow 220ms",
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "perspective(900px) rotateX(0deg) translateY(-4px)";
        e.currentTarget.style.boxShadow = `0 18px 40px ${color}25, inset 0 1px 0 rgba(255,255,255,0.9)`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "perspective(900px) rotateX(2.5deg)";
        e.currentTarget.style.boxShadow = "0 4px 24px rgba(14,165,233,0.06), inset 0 1px 0 rgba(255,255,255,0.85)";
      }}
    >
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, transparent, ${color}50, transparent)`,
      }} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 11,
          background: `${color}16`, display: "grid", placeItems: "center",
        }}>
          <Icon size={17} color={color} strokeWidth={1.8} />
        </div>
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--subtle)" }}>
          {label}
        </p>
      </div>
      <p style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 700, lineHeight: 1, marginBottom: 6 }}>
        {value}
      </p>
      <p style={{ fontSize: 12, color: "var(--muted)" }}>{sub}</p>
    </div>
  );
}

const primaryBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  height: 42,
  padding: "0 20px",
  borderRadius: 12,
  background: "linear-gradient(135deg, #0ea5e9, #0284c7)",
  color: "white",
  fontSize: 13.5,
  fontWeight: 600,
  textDecoration: "none",
  boxShadow: "0 8px 22px rgba(14,165,233,0.3)",
};

const secondaryBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  height: 42,
  padding: "0 18px",
  borderRadius: 12,
  background: "rgba(255,255,255,0.85)",
  border: "1px solid var(--line)",
  color: "var(--fg)",
  fontSize: 13.5,
  fontWeight: 600,
  textDecoration: "none",
};

export default AdminDashboard;