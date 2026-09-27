import { useMemo, useState } from "react";
import {
  Search, MapPin, Calendar, Tag, ArrowUpDown, ArrowUp, ArrowDown,
  ChevronLeft, ChevronRight, Layers, Activity, AlertTriangle
} from "lucide-react";
import IssueDetailsDrawer from "../../components/issues/shared/IssueDetailsDrawer";
import IssuePriorityBadge from "../../components/issues/shared/IssuePriorityBadge";
import IssueStatusBadge from "../../components/issues/shared/IssueStatusBadge";
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
  const [sortKey, setSortKey] = useState("createdAt");
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
          background: active ? "rgba(14,165,233,0.12)" : "rgba(255,255,255,0.88)",
          color: active ? "var(--primary-deep)" : "var(--fg)",
          display: "flex",
          alignItems: "center",
          gap: 6,
          cursor: "pointer",
          fontSize: 12.5,
          fontWeight: active ? 600 : 500,
        }}
      >
        {Icon && <Icon size={13} />}
        {label}
        {active ? (sortDir === "asc" ? <ArrowUp size={13} /> : <ArrowDown size={13} />) : (
          <ArrowUpDown size={12} style={{ opacity: 0.4 }} />
        )}
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

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: 12,
        margin: "24px 0 20px",
      }}>
        {[
          { label: "Total Issues", value: stats.total, icon: Layers, color: "#0ea5e9" },
          { label: "Open", value: stats.open, icon: Activity, color: "#f59e0b" },
          { label: "Unassigned", value: stats.unassigned, icon: MapPin, color: "#ef4444" },
          { label: "Critical", value: stats.critical, icon: AlertTriangle, color: "#dc2626" },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              borderRadius: 16,
              padding: "14px 16px",
              background: "rgba(255,255,255,0.75)",
              backdropFilter: "blur(16px)",
              border: "1px solid rgba(255,255,255,0.8)",
              boxShadow: "0 8px 28px rgba(14,165,233,0.07)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: `${s.color}18`, display: "grid", placeItems: "center",
              }}>
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

      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--subtle)" }} />
          <input
            type="text"
            placeholder="Search ID, title, location, zone, category…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            style={{
              width: "100%", height: 42, paddingLeft: 38, paddingRight: 14,
              borderRadius: 12, border: "1px solid var(--line)",
              background: "rgba(255,255,255,0.92)", fontSize: 13.5, outline: "none",
            }}
          />
        </div>
        <select
          value={wardFilter}
          onChange={(e) => { setWardFilter(e.target.value); setPage(1); }}
          style={{ height: 42, padding: "0 12px", borderRadius: 12, border: "1px solid var(--line)", background: "white", fontSize: 13 }}
        >
          <option value="all">All zones</option>
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

      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {["all", "submitted", "acknowledged", "in_progress", "resolved"].map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            style={{
              height: 34, padding: "0 14px", borderRadius: 999,
              border: statusFilter === s ? "none" : "1px solid var(--line)",
              background: statusFilter === s ? "linear-gradient(135deg, #0ea5e9, #0284c7)" : "rgba(255,255,255,0.9)",
              color: statusFilter === s ? "white" : "var(--muted)",
              fontSize: 12.5, fontWeight: 600, cursor: "pointer",
              boxShadow: statusFilter === s ? "0 6px 14px rgba(14,165,233,0.28)" : "none",
            }}
          >
            {s === "all" ? "All" : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <SortBtn label="Reported" k="createdAt" icon={Calendar} />
        <SortBtn label="Updated" k="updatedAt" icon={Calendar} />
        <SortBtn label="Priority" k="priority" icon={ArrowUpDown} />
        <SortBtn label="Category" k="category" icon={Tag} />
        <SortBtn label="Title" k="title" />
        <SortBtn label="Status" k="status" />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {paginated.length === 0 && (
          <div style={{
            borderRadius: 18, padding: 48, textAlign: "center", color: "var(--subtle)",
            background: "rgba(255,255,255,0.7)", border: "1px solid rgba(14,165,233,0.12)",
          }}>
            No issues match your filters
          </div>
        )}

        {paginated.map((issue) => (
          <article
            key={issue.id}
            onClick={() => setSelectedId(issue.id)}
            style={{
              borderRadius: 16,
              padding: "16px 18px",
              background: "rgba(255,255,255,0.78)",
              backdropFilter: "blur(16px)",
              border: "1px solid rgba(14,165,233,0.12)",
              boxShadow: "0 8px 28px rgba(14,165,233,0.06)",
              cursor: "pointer",
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: 16,
              alignItems: "center",
              transition: "transform 160ms, box-shadow 160ms",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 14px 36px rgba(14,165,233,0.12)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 8px 28px rgba(14,165,233,0.06)";
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--subtle)" }}>
                  {issue.id}
                </span>
                <span style={{ fontSize: 12, color: "var(--subtle)" }}>
                  {issue.ward}
                </span>
                <span style={{ fontSize: 12, color: "var(--primary-deep)", fontWeight: 500 }}>
                  {CATEGORY_LABEL[issue.category] || issue.category}
                </span>
              </div>

              <h3 style={{
                fontFamily: "var(--font-display)",
                fontSize: 16,
                fontWeight: 650,
                margin: 0,
                lineHeight: 1.3,
              }}>
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

            <div style={{ textAlign: "right", minWidth: 132 }}>
              <p style={{
                fontSize: 10.5,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--subtle)",
                marginBottom: 4,
              }}>
                Reported
              </p>
              <p style={{
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                fontWeight: 600,
                color: "var(--fg)",
                whiteSpace: "nowrap",
              }}>
                {formatDate(issue.createdAt)}
              </p>
              <p style={{
                fontSize: 11,
                color: "var(--subtle)",
                marginTop: 6,
                whiteSpace: "nowrap",
              }}>
                Updated {formatDate(issue.updatedAt)}
              </p>
            </div>
          </article>
        ))}
      </div>

      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 22 }}>
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