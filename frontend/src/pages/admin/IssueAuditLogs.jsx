import { useMemo, useState } from "react";
import {
  Search, Shield, User, Clock, FileText, Activity,
  ChevronLeft, ChevronRight
} from "lucide-react";
import PageHeader from "../../components/layout/PageHeader";
import IssueDetailsDrawer from "../../components/issues/shared/IssueDetailsDrawer";
import { ROLE_LABEL } from "../../constants/userRoles";
import { ADMIN_ROSTER, STAFF_ROSTER } from "../../constants/issueConstants";
import { formatDateTime } from "../../utils/formatDate";
import { useAudit, useIssues } from "../../store/issueStore";

function resolveRole(event) {
  if (ADMIN_ROSTER.includes(event.actor)) return "admin";
  if (STAFF_ROSTER.includes(event.actor)) return "staff";
  return event.role || "staff";
}

function IssueAuditLogs() {
  const audit = useAudit() || [];
  const issues = useIssues();
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);
  const perPage = 8;

  const selected = issues.find((issue) => issue.id === selectedId) || null;

  const normalized = useMemo(
    () => audit.map((event) => ({ ...event, role: resolveRole(event) })),
    [audit]
  );

  const filtered = useMemo(() => {
    return normalized.filter((event) => {
      const haystack = `${event.action} ${event.actor} ${event.issueId || ""} ${ROLE_LABEL[event.role] || ""}`.toLowerCase();
      if (query && !haystack.includes(query.toLowerCase())) return false;
      if (roleFilter !== "all" && event.role !== roleFilter) return false;
      return true;
    });
  }, [normalized, query, roleFilter]);

  const totalPages = Math.ceil(filtered.length / perPage) || 1;
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const stats = {
    total: normalized.length,
    admin: normalized.filter((e) => e.role === "admin").length,
    staff: normalized.filter((e) => e.role === "staff").length,
  };

  return (
    <main className="page-wrap">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <PageHeader
          eyebrow="Audit Log · Neural Trace"
          title="Command History"
          description="Click a row to open the issue file. Status stays locked here."
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
          Live Trace
        </div>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: 12,
        margin: "24px 0 20px",
      }}>
        <GlassStat icon={FileText} label="Total Events" value={stats.total} color="#0ea5e9" />
        <GlassStat icon={Shield} label="Admin Actions" value={stats.admin} color="#8b5cf6" />
        <GlassStat icon={User} label="Staff Actions" value={stats.staff} color="#10b981" />
        <GlassStat icon={Activity} label="Showing" value={filtered.length} color="#f59e0b" />
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--subtle)" }} />
          <input
            type="text"
            placeholder="Search action, actor or issue ID…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            style={{
              width: "100%", height: 42, paddingLeft: 38, paddingRight: 14,
              borderRadius: 12, border: "1px solid var(--line)",
              background: "rgba(255,255,255,0.9)", fontSize: 13.5, outline: "none",
            }}
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          style={{ height: 42, padding: "0 12px", borderRadius: 12, border: "1px solid var(--line)", background: "white", fontSize: 13 }}
        >
          <option value="all">All Roles</option>
          <option value="admin">Admin</option>
          <option value="staff">Staff</option>
          <option value="citizen">Citizen</option>
        </select>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {paginated.length === 0 && (
          <div style={{ borderRadius: 16, padding: 48, textAlign: "center", color: "var(--subtle)" }}>
            No audit events match your filters
          </div>
        )}

        {paginated.map((event, idx) => {
          const color = event.role === "admin" ? "#8b5cf6" : event.role === "staff" ? "#10b981" : "#0ea5e9";
          const canOpen = Boolean(event.issueId);
          return (
            <div
              key={event.id || idx}
              onClick={() => canOpen && setSelectedId(event.issueId)}
              style={{
                borderRadius: 18,
                padding: "16px 18px",
                display: "flex",
                gap: 16,
                alignItems: "flex-start",
                background: "rgba(255,255,255,0.74)",
                backdropFilter: "blur(16px) saturate(1.4)",
                border: "1px solid rgba(255,255,255,0.75)",
                boxShadow: "0 8px 28px rgba(14,165,233,0.07), inset 0 1px 0 rgba(255,255,255,0.85)",
                position: "relative",
                overflow: "hidden",
                transform: "perspective(900px) rotateX(2deg)",
                transition: "transform 220ms, box-shadow 220ms",
                cursor: canOpen ? "pointer" : "default",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "perspective(900px) rotateX(0deg) translateY(-4px)";
                e.currentTarget.style.boxShadow = `0 18px 40px ${color}25, inset 0 1px 0 rgba(255,255,255,0.9)`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "perspective(900px) rotateX(2deg)";
                e.currentTarget.style.boxShadow = "0 8px 28px rgba(14,165,233,0.07), inset 0 1px 0 rgba(255,255,255,0.85)";
              }}
            >
              <div style={{
                position: "absolute", top: 0, left: 0, right: 0, height: 2,
                background: `linear-gradient(90deg, transparent, ${color}70, transparent)`,
              }} />
              <div style={{
                width: 36, height: 36, borderRadius: 11, flexShrink: 0,
                background: `${color}18`, display: "grid", placeItems: "center",
              }}>
                {event.role === "admin" ? (
                  <Shield size={16} color={color} />
                ) : event.role === "staff" ? (
                  <User size={16} color={color} />
                ) : (
                  <Activity size={16} color={color} />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 600, fontSize: 14.5, marginBottom: 4 }}>{event.action}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", fontSize: 12.5, color: "var(--muted)" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <Clock size={12} />
                    {formatDateTime(event.at)}
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <User size={12} />
                    {event.actor}
                  </span>
                  <span style={{
                    padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600,
                    background: `${color}18`, color,
                  }}>
                    {ROLE_LABEL[event.role] || event.role}
                  </span>
                  {event.issueId && (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--primary-deep)" }}>
                      {event.issueId}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
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
            Page {page} of {totalPages} · {filtered.length} events
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

      <style>{`
        @keyframes livePulse {
          0%, 100% { box-shadow: 0 0 0 3px rgba(16,185,129,0.25); }
          50% { box-shadow: 0 0 0 6px rgba(16,185,129,0.1); }
        }
      `}</style>
    </main>
  );
}

function GlassStat({ icon: Icon, label, value, color }) {
  return (
    <div
      style={{
        borderRadius: 16,
        padding: "14px 16px",
        background: "rgba(255,255,255,0.75)",
        backdropFilter: "blur(16px) saturate(1.4)",
        border: "1px solid rgba(255,255,255,0.8)",
        boxShadow: "0 8px 28px rgba(14,165,233,0.07), inset 0 1px 0 rgba(255,255,255,0.85)",
        transform: "perspective(900px) rotateX(2deg)",
        transition: "transform 220ms, box-shadow 220ms",
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "perspective(900px) rotateX(0deg) translateY(-4px)";
        e.currentTarget.style.boxShadow = `0 18px 40px ${color}25, inset 0 1px 0 rgba(255,255,255,0.9)`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "perspective(900px) rotateX(2deg)";
        e.currentTarget.style.boxShadow = "0 8px 28px rgba(14,165,233,0.07), inset 0 1px 0 rgba(255,255,255,0.85)";
      }}
    >
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, transparent, ${color}55, transparent)`,
      }} />
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10,
          background: `${color}18`, display: "grid", placeItems: "center",
        }}>
          <Icon size={15} color={color} />
        </div>
        <div>
          <p style={{ fontSize: 11, color: "var(--subtle)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
          <p style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700 }}>{value}</p>
        </div>
      </div>
    </div>
  );
}

export default IssueAuditLogs;