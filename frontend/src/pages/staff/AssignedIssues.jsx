import { useEffect, useMemo, useState } from "react";
import { MapPin, Calendar, ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from "lucide-react";
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

const SORTS = [
  { id: "assigned_desc", label: "Latest assignment", icon: ArrowDown },
  { id: "assigned_asc", label: "Oldest assignment", icon: ArrowUp },
  { id: "priority_desc", label: "Priority high to low", icon: ArrowDown },
  { id: "priority_asc", label: "Priority low to high", icon: ArrowUp },
];

const PRIORITY_RANK = { critical: 4, high: 3, medium: 2, low: 1 };
const PER_PAGE = 6;

function AssignedIssues() {
  const user = useAuth();
  const issues = useIssues();
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("assigned_desc");
  const [sortOpen, setSortOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);

  const mine = issues.filter((issue) => issue.assignedTo === user.name);

  const filtered = useMemo(() => {
    const list = filter === "all" ? [...mine] : mine.filter((issue) => issue.status === filter);
    list.sort((a, b) => {
      const aAt = new Date(a.assignedAt || 0);
      const bAt = new Date(b.assignedAt || 0);
      if (sort === "assigned_desc") return bAt - aAt;
      if (sort === "assigned_asc") return aAt - bAt;
      if (sort === "priority_desc") return (PRIORITY_RANK[b.priority] || 0) - (PRIORITY_RANK[a.priority] || 0);
      if (sort === "priority_asc") return (PRIORITY_RANK[a.priority] || 0) - (PRIORITY_RANK[b.priority] || 0);
      return 0;
    });
    return list;
  }, [mine, filter, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const selected = issues.find((issue) => issue.id === selectedId) || null;

  useEffect(() => {
    setPage(1);
  }, [filter, sort]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <main className="page-wrap">
      <PageHeader
        eyebrow="Field Layer · Assigned"
        title="Assigned to Me"
        description="Set In Progress here. Choose Resolved to ask Admin to close. The issue file stays locked."
      />

      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        margin: "20px 0 16px",
        flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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

        <div style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setSortOpen((open) => !open)}
            style={{
              height: 34,
              padding: "0 2px",
              border: "none",
              background: "transparent",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              cursor: "pointer",
              color: sortOpen ? "var(--primary-deep)" : "var(--subtle)",
            }}
          >
            <span style={{ display: "inline-flex", flexDirection: "column", lineHeight: 0 }}>
              <ArrowUp size={11} />
              <ArrowDown size={11} style={{ marginTop: -2 }} />
            </span>
            <span style={{
              fontSize: 12,
              fontWeight: 650,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}>
              Sort
            </span>
          </button>

          {sortOpen && (
            <div style={{
              position: "absolute",
              top: 36,
              right: 0,
              zIndex: 20,
              width: 230,
              padding: 6,
              borderRadius: 14,
              background: "rgba(255,255,255,0.92)",
              backdropFilter: "blur(18px)",
              border: "1px solid rgba(14,165,233,0.16)",
              boxShadow: "0 18px 40px rgba(14,165,233,0.14)",
            }}>
              {SORTS.map((item) => {
                const Icon = item.icon;
                const active = sort === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => { setSort(item.id); setSortOpen(false); }}
                    style={{
                      width: "100%",
                      height: 36,
                      border: "none",
                      borderRadius: 10,
                      background: active ? "rgba(14,165,233,0.1)" : "transparent",
                      color: active ? "var(--primary-deep)" : "var(--fg)",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "0 10px",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: active ? 650 : 500,
                    }}
                  >
                    <Icon size={13} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {paginated.length === 0 && (
          <GlassCard>
            <p style={{ padding: 40, textAlign: "center", color: "var(--subtle)" }}>
              No tickets in this filter.
            </p>
          </GlassCard>
        )}

        {paginated.map((issue, idx) => (
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
                    <Calendar size={11} /> Assigned {formatDate(issue.assignedAt)}
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

      {totalPages > 1 && (
        <div style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: 10,
          marginTop: 18,
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

      <IssueDetailsDrawer issue={selected} onClose={() => setSelectedId(null)} />
    </main>
  );
}

export default AssignedIssues;