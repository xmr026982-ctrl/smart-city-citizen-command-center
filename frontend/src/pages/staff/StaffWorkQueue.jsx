import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ArrowDown, ArrowUp } from "lucide-react";
import IssueDetailsDrawer from "../../components/issues/shared/IssueDetailsDrawer";
import IssuePriorityBadge from "../../components/issues/shared/IssuePriorityBadge";
import IssueStatusBadge from "../../components/issues/shared/IssueStatusBadge";
import PageHeader from "../../components/layout/PageHeader";
import GlassCard from "../../components/ui/GlassCard";
import { CATEGORY_LABEL } from "../../constants/issueCategories";
import { useIssues } from "../../store/issueStore";
import { formatDate } from "../../utils/formatDate";

const PER_PAGE = 8;
const PRIORITY_RANK = { critical: 4, high: 3, medium: 2, low: 1 };

const SORTS = [
  { id: "updated_desc", label: "Latest update", icon: ArrowDown },
  { id: "updated_asc", label: "Oldest update", icon: ArrowUp },
  { id: "priority_desc", label: "Priority high to low", icon: ArrowDown },
  { id: "unassigned", label: "Unassigned first", icon: ArrowUp },
];

function StaffWorkQueue() {
  const issues = useIssues();
  const [selectedId, setSelectedId] = useState(null);
  const [sort, setSort] = useState("updated_desc");
  const [sortOpen, setSortOpen] = useState(false);
  const [page, setPage] = useState(1);

  const queue = useMemo(() => {
    const list = issues.filter((issue) => issue.status !== "resolved");
    list.sort((a, b) => {
      if (sort === "updated_desc") return new Date(b.updatedAt) - new Date(a.updatedAt);
      if (sort === "updated_asc") return new Date(a.updatedAt) - new Date(b.updatedAt);
      if (sort === "priority_desc") return (PRIORITY_RANK[b.priority] || 0) - (PRIORITY_RANK[a.priority] || 0);
      if (sort === "unassigned") return Number(Boolean(a.assignedTo)) - Number(Boolean(b.assignedTo));
      return 0;
    });
    return list;
  }, [issues, sort]);

  const totalPages = Math.max(1, Math.ceil(queue.length / PER_PAGE));
  const paginated = queue.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const selected = issues.find((issue) => issue.id === selectedId) || null;

  useEffect(() => {
    setPage(1);
  }, [sort]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <main className="page-wrap">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <PageHeader
          eyebrow="Field Layer · Intake"
          title="City Intake"
          description="Open city board. View a file here. Status updates belong on Assigned to Me."
        />
        <div style={{ position: "relative", marginBottom: 4 }}>
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
              width: 220,
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

      <div style={{ display: "grid", gap: 10, marginTop: 20 }}>
        {paginated.length === 0 && (
          <GlassCard>
            <p style={{ padding: 40, textAlign: "center", color: "var(--subtle)" }}>
              No open city tickets.
            </p>
          </GlassCard>
        )}

        {paginated.map((issue, idx) => (
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
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--subtle)" }}>
                    {issue.id}
                  </span>
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

export default StaffWorkQueue;