import { useMemo, useState } from "react";
import {
  Search, MapPin, Calendar, Tag, ArrowUpDown, ArrowUp, ArrowDown,
  ChevronLeft, ChevronRight, Layers, Activity, AlertTriangle
} from "lucide-react";
import IssueDetailsDrawer from "../../components/issues/shared/IssueDetailsDrawer";
import IssuePriorityBadge from "../../components/issues/shared/IssuePriorityBadge";
import IssueStatusBadge from "../../components/issues/shared/IssueStatusBadge";
import IssueSLAIndicator from "../../components/issues/shared/IssueSLAIndicator";
import PageHeader from "../../components/layout/PageHeader";
import { CATEGORY_LABEL } from "../../constants/issueCategories";
import { STATUS_LABEL } from "../../constants/issueStatuses";
import { useIssues } from "../../store/issueStore";
import { formatDate } from "../../utils/formatDate";

function AllIssues() {
  const issues = useIssues();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [wardFilter, setWardFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortKey, setSortKey] = useState("updatedAt");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);
  const perPage = 8;

  const wards = [...new Set(issues.map((i) => i.ward))];

  const filtered = useMemo(() => {
    let list = issues.filter((issue) => {
      const haystack = `${issue.id} ${issue.title} ${issue.location} ${issue.ward} ${CATEGORY_LABEL[issue.category] || ""} ${issue.assignedTo || ""}`.toLowerCase();
      if (query && !haystack.includes(query.toLowerCase())) return false;
      if (statusFilter !== "all" && issue.status !== statusFilter) return false;
      if (wardFilter !== "all" && issue.ward !== wardFilter) return false;
      if (categoryFilter !== "all" && issue.category !== categoryFilter) return false;
      return true;
    });

    list.sort((a, b) => {
      let valA = a[sortKey];
      let valB = b[sortKey];

      if (sortKey === "createdAt" || sortKey === "updatedAt") {
        valA = new Date(valA).getTime();
        valB = new Date(valB).getTime();
      }
      if (sortKey === "category") {
        valA = CATEGORY_LABEL[a.category] || "";
        valB = CATEGORY_LABEL[b.category] || "";
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
  }, [issues, query, statusFilter, wardFilter, categoryFilter, sortKey, sortDir]);

  const totalPages = Math.ceil(filtered.length / perPage) || 1;
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);
  const selected = issues.find((i) => i.id === selectedId) || null;

  const stats = {
    total: issues.length,
    open: issues.filter((i) => i.status !== "resolved").length,
    unassigned: issues.filter((i) => !i.assignedTo && i.status !== "resolved").length,
    critical: issues.filter((i) => i.priority === "critical").length,
  };

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(1);
  };

  const SortBtn = ({ label, k, icon: Icon }) => {
    const active = sortKey === k;
    return (
      <button
        onClick={() => toggleSort(k)}
        style={{
          height: 36,
          padding: "0 12px",
          borderRadius: 10,
          border: active ? "1.5px solid var(--primary)" : "1px solid var(--line)",
          background: active ? "rgba(14,165,233,0.1)" : "white",
          color: active ? "var(--primary-deep)" : "var(--fg)",
          display: "flex",
          alignItems: "center",
          gap: 5,
          cursor: "pointer",
          fontSize: 12.5,
          fontWeight: active ? 600 : 500,
        }}
      >
        {Icon && <Icon size={13} />}
        {label}
        {active && (sortDir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
      </button>
    );
  };

  return (
    <main className="page-wrap">
      <PageHeader
        eyebrow="Work Queue · Neural Ledger"
        title="City Ledger"
        description="Every civic issue currently on the board. Real-time command view."
      />

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, margin: "24px 0 20px" }}>
        {[
          { label: "Total Issues", value: stats.total, icon: Layers, color: "#0ea5e9" },
          { label: "Open", value: stats.open, icon: Activity, color: "#f59e0b" },
          { label: "Unassigned", value: stats.unassigned, icon: MapPin, color: "#ef4444" },
          { label: "Critical", value: stats.critical, icon: AlertTriangle, color: "#dc2626" },
        ].map((s) => (
          <div key={s.label} className="holo-surface holo-border" style={{ borderRadius: 14, padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `${s.color}18`, display: "grid", placeItems: "center" }}>
                <s.icon size={16} color={s.color} />
              </div>
              <div>
                <p style={{ fontSize: 11, color: "var(--subtle)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</p>
                <p style={{ fontSize: 20, fontWeight: 700, fontFamily: "var(--font-display)" }}>{s.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Search + Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--subtle)" }} />
          <input
            type="text"
            placeholder="Search ID, title, location, ward, category…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            style={{
              width: "100%", height: 42, paddingLeft: 38, paddingRight: 14,
              borderRadius: 12, border: "1px solid var(--line)", background: "rgba(255,255,255,0.9)",
              fontSize: 13.5, outline: "none",
            }}
          />
        </div>

        <select
          value={wardFilter}
          onChange={(e) => { setWardFilter(e.target.value); setPage(1); }}
          style={{ height: 42, padding: "0 12px", borderRadius: 12, border: "1px solid var(--line)", background: "white", fontSize: 13 }}
        >
          <option value="all">All wards</option>
          {wards.map((w) => <option key={w} value={w}>{w}</option>)}
        </select>

        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
          style={{ height: 42, padding: "0 12px", borderRadius: 12, border: "1px solid var(--line)", background: "white", fontSize: 13 }}
        >
          <option value="all">All Categories</option>
          {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Status pills */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {["all", "submitted", "acknowledged", "in_progress", "resolved"].map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            style={{
              height: 34,
              padding: "0 14px",
              borderRadius: 999,
              border: statusFilter === s ? "none" : "1px solid var(--line)",
              background: statusFilter === s ? "linear-gradient(135deg, #0ea5e9, #0284c7)" : "white",
              color: statusFilter === s ? "white" : "var(--muted)",
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: statusFilter === s ? "0 6px 14px rgba(14,165,233,0.3)" : "none",
            }}
          >
            {s === "all" ? "All" : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {/* Sort bar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <SortBtn label="Updated" k="updatedAt" icon={Calendar} />
        <SortBtn label="Reported" k="createdAt" icon={Calendar} />
        <SortBtn label="Priority" k="priority" icon={ArrowUpDown} />
        <SortBtn label="Category" k="category" icon={Tag} />
        <SortBtn label="Title" k="title" />
        <SortBtn label="Status" k="status" />
      </div>

      {/* Ultra-clean futuristic table */}
      <div className="holo-surface holo-border" style={{ borderRadius: 18, overflow: "hidden" }}>
        {/* Header – properly spaced */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "100px minmax(180px, 1.8fr) 110px 130px 120px 100px 130px 100px 110px",
            gap: 12,
            padding: "13px 20px",
            background: "linear-gradient(90deg, rgba(14,165,233,0.06), rgba(14,165,233,0.02))",
            borderBottom: "1px solid var(--line)",
            fontSize: 11,
            fontWeight: 600,
            color: "var(--subtle)",
            textTransform: "uppercase",
            letterSpacing: "0.07em",
            alignItems: "center",
          }}
        >
          <div>ID</div>
          <div>Title</div>
          <div>Ward</div>
          <div>Category</div>
          <div>Status</div>
          <div>Priority</div>
          <div>Assignee</div>
          <div>SLA</div>
          <div>Updated</div>
        </div>

        {/* Rows */}
        {paginated.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: "var(--subtle)" }}>
            No issues match your filters
          </div>
        ) : (
          paginated.map((issue, idx) => (
            <div
              key={issue.id}
              onClick={() => setSelectedId(issue.id)}
              style={{
                display: "grid",
                gridTemplateColumns: "100px minmax(180px, 1.8fr) 110px 130px 120px 100px 130px 100px 110px",
                gap: 12,
                padding: "15px 20px",
                borderBottom: idx === paginated.length - 1 ? "none" : "1px solid var(--line)",
                cursor: "pointer",
                transition: "background 150ms ease",
                alignItems: "center",
                fontSize: 13,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(14,165,233,0.045)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {/* ID */}
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--subtle)" }}>
                {issue.id}
              </div>

              {/* Title */}
              <div style={{ fontWeight: 500, lineHeight: 1.35 }}>
                {issue.title}
              </div>

              {/* Ward */}
              <div style={{ color: "var(--muted)", fontSize: 12.5 }}>
                {issue.ward}
              </div>

              {/* Category */}
              <div style={{ fontSize: 12.5, color: "var(--primary-deep)", fontWeight: 500 }}>
                {CATEGORY_LABEL[issue.category] || issue.category}
              </div>

              {/* Status */}
              <div>
                <IssueStatusBadge status={issue.status} />
              </div>

              {/* Priority */}
              <div>
                <IssuePriorityBadge priority={issue.priority} />
              </div>

              {/* Assignee */}
              <div style={{ fontSize: 12.5, color: issue.assignedTo ? "var(--fg)" : "var(--subtle)" }}>
                {issue.assignedTo || "—"}
              </div>

              {/* SLA */}
              <div>
                <IssueSLAIndicator issue={issue} />
              </div>

              {/* Updated */}
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--subtle)" }}>
                {formatDate(issue.updatedAt)}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 20 }}>
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

      <IssueDetailsDrawer issue={selected} onClose={() => setSelectedId(null)} />
    </main>
  );
}

export default AllIssues;