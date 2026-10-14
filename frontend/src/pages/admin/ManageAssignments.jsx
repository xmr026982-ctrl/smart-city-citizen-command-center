import { useState, useMemo } from "react";
import {
  UserPlus, MapPin, UserMinus, RefreshCw, Search,
  ArrowUpDown, ChevronLeft, ChevronRight, Calendar, Tag, ArrowUp, ArrowDown
} from "lucide-react";
import IssuePriorityBadge from "../../components/issues/shared/IssuePriorityBadge";
import IssueStatusBadge from "../../components/issues/shared/IssueStatusBadge";
import PageHeader from "../../components/layout/PageHeader";
import StaffAssignModal from "../../components/issues/admin/StaffAssignModal";
import { CATEGORY_LABEL } from "../../constants/issueCategories";
import { useAuth } from "../../store/authStore";
import { assignIssue, setPriority, useIssues } from "../../store/issueStore";
import { formatDateTime } from "../../utils/formatDate";

function ManageAssignments() {
  const user = useAuth();
  const allIssues = useIssues().filter((i) => i.status !== "resolved");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortKey, setSortKey] = useState("createdAt");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const perPage = 6;

  const filtered = useMemo(() => {
    let list = allIssues.filter((issue) => {
      const matchSearch =
        issue.title.toLowerCase().includes(search.toLowerCase()) ||
        issue.id.toLowerCase().includes(search.toLowerCase()) ||
        (issue.assignedTo || "").toLowerCase().includes(search.toLowerCase()) ||
        issue.ward.toLowerCase().includes(search.toLowerCase()) ||
        (CATEGORY_LABEL[issue.category] || "").toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || issue.status === statusFilter;
      const matchCategory = categoryFilter === "all" || issue.category === categoryFilter;
      return matchSearch && matchStatus && matchCategory;
    });

    list.sort((a, b) => {
      let valA = a[sortKey];
      let valB = b[sortKey];
      if (sortKey === "createdAt" || sortKey === "updatedAt") {
        valA = new Date(valA).getTime();
        valB = new Date(valB).getTime();
      }
      if (sortKey === "category") {
        valA = CATEGORY_LABEL[a.category] || a.category;
        valB = CATEGORY_LABEL[b.category] || b.category;
      }
      if (sortKey === "priority") {
        const order = { critical: 4, high: 3, medium: 2, low: 1 };
        valA = order[a.priority] || 0;
        valB = order[b.priority] || 0;
      }
      if (typeof valA === "string") {
        return sortDir === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortDir === "asc" ? valA - valB : valB - valA;
    });

    return list;
  }, [allIssues, search, statusFilter, categoryFilter, sortKey, sortDir]);

  const totalPages = Math.ceil(filtered.length / perPage) || 1;
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const openAssign = (issue) => {
    setSelectedIssue(issue);
    setModalOpen(true);
  };

  const handleAssign = ({ staffName, priority }) => {
    assignIssue(selectedIssue.id, staffName || null, user.name, user.role);
    if (priority) setPriority(selectedIssue.id, priority, user.name, user.role);
  };

  const handleUnassign = (issue) => {
    assignIssue(issue.id, null, user.name, user.role);
  };

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(1);
  };

  const SortButton = ({ label, sortKeyName, icon: Icon }) => {
    const active = sortKey === sortKeyName;
    return (
      <button
        onClick={() => toggleSort(sortKeyName)}
        style={{
          height: 40, padding: "0 14px", borderRadius: 11,
          border: active ? "1.5px solid var(--primary)" : "1px solid var(--line)",
          background: active ? "rgba(14,165,233,0.08)" : "white",
          color: active ? "var(--primary-deep)" : "var(--fg)",
          display: "flex", alignItems: "center", gap: 6, cursor: "pointer",
          fontSize: 13, fontWeight: active ? 600 : 500,
        }}
      >
        {Icon && <Icon size={14} />}
        {label}
        {active && (sortDir === "asc" ? <ArrowUp size={13} /> : <ArrowDown size={13} />)}
      </button>
    );
  };

  return (
    <main className="page-wrap">
      <PageHeader
        eyebrow="Command Layer · Dispatch"
        title="Dispatch Board"
        description="Acknowledge + assign on first dispatch. Field owns In Progress. Confirm close from the issue file."
      />

      <div style={{ display: "flex", gap: 10, margin: "24px 0 16px", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--subtle)" }} />
          <input
            type="text"
            placeholder="Search ID, title, zone, category or assignee…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{
              width: "100%", height: 42, paddingLeft: 38, paddingRight: 14,
              borderRadius: 12, border: "1px solid var(--line)", background: "rgba(255,255,255,0.9)",
              fontSize: 13.5, outline: "none",
            }}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          style={{ height: 42, padding: "0 12px", borderRadius: 12, border: "1px solid var(--line)", background: "white", fontSize: 13 }}
        >
          <option value="all">All Status</option>
          <option value="submitted">Submitted</option>
          <option value="acknowledged">Acknowledged</option>
          <option value="in_progress">In Progress</option>
          <option value="pending_review">Pending confirmation</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
          style={{ height: 42, padding: "0 12px", borderRadius: 12, border: "1px solid var(--line)", background: "white", fontSize: 13 }}
        >
          <option value="all">All Categories</option>
          {Object.entries(CATEGORY_LABEL).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        <SortButton label="Date" sortKeyName="createdAt" icon={Calendar} />
        <SortButton label="Priority" sortKeyName="priority" icon={ArrowUpDown} />
        <SortButton label="Category" sortKeyName="category" icon={Tag} />
        <SortButton label="Title" sortKeyName="title" />
        <SortButton label="Status" sortKeyName="status" />
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {paginated.length === 0 && (
          <div style={{ borderRadius: 18, padding: 48, textAlign: "center", color: "var(--subtle)" }}>
            No issues match your filters
          </div>
        )}

        {paginated.map((issue) => (
          <article
            key={issue.id}
            style={{
              borderRadius: 18,
              padding: "16px 18px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
              background: "rgba(255,255,255,0.74)",
              backdropFilter: "blur(16px) saturate(1.4)",
              border: "1px solid rgba(255,255,255,0.75)",
              boxShadow: "0 8px 28px rgba(14,165,233,0.07), inset 0 1px 0 rgba(255,255,255,0.85)",
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
            <div style={{ flex: 1, minWidth: 260 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--subtle)" }}>{issue.id}</span>
                <span style={{ fontSize: 11, color: "var(--subtle)", display: "flex", alignItems: "center", gap: 4 }}>
                  <Calendar size={11} />
                  {formatDateTime(issue.createdAt)}
                </span>
              </div>
              <h3 style={{ fontSize: 15, fontFamily: "var(--font-display)", fontWeight: 600 }}>{issue.title}</h3>
              <p style={{ marginTop: 4, color: "var(--muted)", fontSize: 12.5, display: "flex", alignItems: "center", gap: 5 }}>
                <MapPin size={12} />
                {issue.ward} · {issue.location}
              </p>
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                <IssueStatusBadge status={issue.status} />
                <IssuePriorityBadge priority={issue.priority} />
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  fontSize: 11.5, fontWeight: 500, padding: "3px 10px", borderRadius: 999,
                  background: "rgba(14,165,233,0.08)", color: "var(--primary-deep)",
                  border: "1px solid rgba(14,165,233,0.2)",
                }}>
                  <Tag size={11} />
                  {CATEGORY_LABEL[issue.category] || issue.category}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              {issue.assignedTo ? (
                <span style={{
                  fontSize: 13, fontWeight: 500, color: "var(--primary-deep)",
                  background: "var(--info-soft)", padding: "6px 14px", borderRadius: 999,
                }}>
                  {issue.assignedTo}
                </span>
              ) : (
                <span style={{
                  fontSize: 13, color: "var(--subtle)", padding: "6px 14px",
                  border: "1px dashed var(--line)", borderRadius: 999,
                }}>
                  Unassigned
                </span>
              )}
              <button
                onClick={() => openAssign(issue)}
                style={{
                  height: 38, padding: "0 14px", borderRadius: 11, border: "none",
                  background: "linear-gradient(135deg, #0ea5e9, #0284c7)", color: "white",
                  fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 6,
                  cursor: "pointer", boxShadow: "0 6px 16px rgba(14,165,233,0.25)",
                }}
              >
                {issue.assignedTo ? <><RefreshCw size={13} /> Re-assign</> : <><UserPlus size={14} /> Assign</>}
              </button>
              {issue.assignedTo && (
                <button
                  onClick={() => handleUnassign(issue)}
                  title="Remove specialist"
                  style={{
                    height: 38, width: 38, borderRadius: 11, border: "1px solid #fecaca",
                    background: "#fef2f2", color: "#dc2626", display: "grid", placeItems: "center", cursor: "pointer",
                  }}
                >
                  <UserMinus size={15} />
                </button>
              )}
            </div>
          </article>
        ))}
      </div>

      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 24 }}>
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            style={{
              width: 36, height: 36, borderRadius: 10, border: "1px solid var(--line)",
              background: "white", display: "grid", placeItems: "center",
              cursor: page === 1 ? "not-allowed" : "pointer", opacity: page === 1 ? 0.4 : 1,
            }}
          >
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>
            Page {page} of {totalPages} · {filtered.length} issues
          </span>
          <button
            disabled={page === totalPages}
            onClick={() => setPage((p) => p + 1)}
            style={{
              width: 36, height: 36, borderRadius: 10, border: "1px solid var(--line)",
              background: "white", display: "grid", placeItems: "center",
              cursor: page === totalPages ? "not-allowed" : "pointer", opacity: page === totalPages ? 0.4 : 1,
            }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      <StaffAssignModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        issue={selectedIssue}
        onAssign={handleAssign}
      />
    </main>
  );
}

export default ManageAssignments;