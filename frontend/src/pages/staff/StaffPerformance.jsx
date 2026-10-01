import { useEffect, useState } from "react";
import { Activity, CheckCircle2, ChevronLeft, ChevronRight, FolderOpen, Timer, Zap } from "lucide-react";
import PageHeader from "../../components/layout/PageHeader";
import GlassCard from "../../components/ui/GlassCard";
import IssueStatusBadge from "../../components/issues/shared/IssueStatusBadge";
import IssuePriorityBadge from "../../components/issues/shared/IssuePriorityBadge";
import { CATEGORY_LABEL } from "../../constants/issueCategories";
import { useAuth } from "../../store/authStore";
import { useIssues } from "../../store/issueStore";
import { formatDate } from "../../utils/formatDate";

const PER_PAGE = 6;

function StaffPerformance() {
  const user = useAuth();
  const mine = useIssues().filter((issue) => issue.assignedTo === user.name);
  const [chip, setChip] = useState("all");
  const [page, setPage] = useState(1);

  const open = mine.filter((i) => i.status !== "resolved").length;
  const resolved = mine.filter((i) => i.status === "resolved").length;
  const inProgress = mine.filter((i) => i.status === "in_progress").length;
  const pending = mine.filter((i) => i.status === "pending_review").length;
  const critical = mine.filter((i) => i.priority === "critical" || i.priority === "high").length;
  const ratio = mine.length ? Math.round((resolved / mine.length) * 100) : 0;

  const cards = [
    { label: "Load", value: mine.length, icon: FolderOpen, color: "#0ea5e9" },
    { label: "Open", value: open, icon: Timer, color: "#f59e0b" },
    { label: "On site", value: inProgress, icon: Activity, color: "#8b5cf6" },
    { label: "Closed", value: resolved, icon: CheckCircle2, color: "#10b981" },
  ];

  const byCategory = Object.entries(
    mine.reduce((acc, issue) => {
      const key = issue.category || "other";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);
  const maxCat = Math.max(1, ...byCategory.map(([, n]) => n));

  const marks = [
    resolved > 0 && { id: "closed", label: "Closer", detail: `${resolved} verified close${resolved === 1 ? "" : "s"}` },
    inProgress > 0 && { id: "site", label: "On site", detail: `${inProgress} live crew job${inProgress === 1 ? "" : "s"}` },
    pending > 0 && { id: "gate", label: "Awaiting command", detail: `${pending} close request${pending === 1 ? "" : "s"}` },
    critical > 0 && { id: "pressure", label: "High pressure", detail: `${critical} high or critical` },
    mine.length > 0 && { id: "all", label: "Field load", detail: `${mine.length} tickets on you` },
  ].filter(Boolean);

  const traced = mine.filter((issue) => {
    if (chip === "closed") return issue.status === "resolved";
    if (chip === "site") return issue.status === "in_progress";
    if (chip === "gate") return issue.status === "pending_review";
    if (chip === "pressure") return issue.priority === "critical" || issue.priority === "high";
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(traced.length / PER_PAGE));
  const paginated = traced.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  useEffect(() => {
    setPage(1);
  }, [chip]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <main className="page-wrap">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <PageHeader
          eyebrow="Field Layer · Load"
          title="Field Load"
          description="Your contribution snapshot. Tap a mark to filter the trace."
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
          Live load
        </div>
      </div>

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

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: 14,
        marginTop: 18,
      }}>
        <GlassCard>
          <div style={{ padding: 18, display: "flex", gap: 18, alignItems: "center" }}>
            <div style={{
              width: 112, height: 112, borderRadius: "50%", flexShrink: 0,
              background: `conic-gradient(#0ea5e9 ${ratio * 3.6}deg, rgba(14,165,233,0.12) 0)`,
              display: "grid", placeItems: "center",
            }}>
              <div style={{
                width: 78, height: 78, borderRadius: "50%",
                background: "rgba(255,255,255,0.92)",
                display: "grid", placeItems: "center",
              }}>
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 750 }}>{ratio}%</p>
                  <p style={{ fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--subtle)" }}>Closed</p>
                </div>
              </div>
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 650, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--subtle)" }}>
                Closure signal
              </p>
              <p style={{ marginTop: 6, fontSize: 15, fontWeight: 650 }}>{resolved} closed of {mine.length}</p>
              <p style={{ marginTop: 6, fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
                {pending ? `${pending} waiting on Admin confirm.` : "No close requests in the gate."}
              </p>
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <div style={{ padding: 18 }}>
            <p style={{ fontSize: 11, fontWeight: 650, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--subtle)", marginBottom: 12 }}>
              Category pressure
            </p>
            {byCategory.length === 0 && (
              <p style={{ color: "var(--subtle)", fontSize: 13 }}>No assigned work yet.</p>
            )}
            {byCategory.map(([key, count]) => (
              <div key={key} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
                  <span>{CATEGORY_LABEL[key] || key}</span>
                  <span style={{ fontFamily: "var(--font-mono)" }}>{count}</span>
                </div>
                <div style={{ height: 7, borderRadius: 999, background: "rgba(14,165,233,0.1)", overflow: "hidden" }}>
                  <div style={{
                    width: `${(count / maxCat) * 100}%`,
                    height: "100%",
                    borderRadius: 999,
                    background: "linear-gradient(90deg, #0ea5e9, #22d3ee)",
                  }} />
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
        {marks.map((mark) => {
          const active = chip === mark.id;
          return (
            <button
              key={mark.id}
              type="button"
              onClick={() => setChip(active && mark.id !== "all" ? "all" : mark.id)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                borderRadius: 999,
                cursor: "pointer",
                border: active ? "none" : "1px solid rgba(14,165,233,0.16)",
                background: active
                  ? "linear-gradient(135deg, #0ea5e9, #0284c7)"
                  : "rgba(255,255,255,0.75)",
                color: active ? "white" : "var(--fg)",
                boxShadow: active ? "0 8px 18px rgba(14,165,233,0.28)" : "none",
                backdropFilter: "blur(10px)",
              }}
            >
              <Zap size={13} color={active ? "white" : "#0ea5e9"} />
              <span style={{ fontSize: 12.5, fontWeight: 650 }}>{mark.label}</span>
              <span style={{ fontSize: 12, color: active ? "rgba(255,255,255,0.85)" : "var(--muted)" }}>
                {mark.detail}
              </span>
            </button>
          );
        })}
      </div>

      <p style={{
        marginTop: 22, marginBottom: 10,
        fontSize: 11, fontWeight: 650, letterSpacing: "0.1em",
        textTransform: "uppercase", color: "var(--subtle)",
      }}>
        Field trace · {traced.length}
      </p>
      <div style={{ display: "grid", gap: 10 }}>
        {paginated.length === 0 && (
          <GlassCard>
            <p style={{ padding: 28, textAlign: "center", color: "var(--subtle)" }}>Nothing in this mark.</p>
          </GlassCard>
        )}
        {paginated.map((issue, idx) => (
          <GlassCard key={issue.id} delay={idx * 35}>
            <div style={{
              padding: "14px 16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}>
              <div>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--subtle)" }}>{issue.id}</p>
                <p style={{ fontWeight: 600, marginTop: 3 }}>{issue.title}</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
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

      {totalPages > 1 && (
        <div style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: 10,
          marginTop: 16,
        }}>
          <button
            type="button"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            style={{
              border: "none",
              background: "transparent",
              color: page === 1 ? "var(--subtle)" : "var(--primary-deep)",
              cursor: page === 1 ? "default" : "pointer",
              display: "grid",
              placeItems: "center",
            }}
          >
            <ChevronLeft size={16} />
          </button>
          <span style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            letterSpacing: "0.08em",
            color: "var(--subtle)",
          }}>
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page === totalPages}
            onClick={() => setPage((p) => p + 1)}
            style={{
              border: "none",
              background: "transparent",
              color: page === totalPages ? "var(--subtle)" : "var(--primary-deep)",
              cursor: page === totalPages ? "default" : "pointer",
              display: "grid",
              placeItems: "center",
            }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      <style>{`
        @keyframes livePulse {
          0%, 100% { box-shadow: 0 0 0 3px rgba(16,185,129,0.25); }
          50% { box-shadow: 0 0 0 6px rgba(16,185,129,0.1); }
        }
      `}</style>
    </main>
  );
}

export default StaffPerformance;