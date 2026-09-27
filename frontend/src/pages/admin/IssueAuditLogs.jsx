import { useMemo, useState } from "react";
import {
  Search, Shield, User, Clock, FileText, Activity,
  ChevronLeft, ChevronRight, Filter
} from "lucide-react";
import PageHeader from "../../components/layout/PageHeader";
import { ROLE_LABEL } from "../../constants/userRoles";
import { formatDateTime } from "../../utils/formatDate";
import { useAudit } from "../../store/issueStore";

function IssueAuditLogs() {
  const audit = useAudit() || [];
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [page, setPage] = useState(1);
  const perPage = 8;

  const filtered = useMemo(() => {
    return audit.filter((event) => {
      const haystack = `${event.action} ${event.actor} ${event.issueId || ""} ${ROLE_LABEL[event.role] || ""}`.toLowerCase();
      if (query && !haystack.includes(query.toLowerCase())) return false;
      if (roleFilter !== "all" && event.role !== roleFilter) return false;
      return true;
    });
  }, [audit, query, roleFilter]);

  const totalPages = Math.ceil(filtered.length / perPage) || 1;
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const stats = {
    total: audit.length,
    admin: audit.filter((e) => e.role === "admin").length,
    staff: audit.filter((e) => e.role === "staff").length,
  };

  return (
    <main className="page-wrap">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <PageHeader
          eyebrow="Audit Log · Neural Trace"
          title="Command History"
          description="Status moves, assignments and system actions. Ready for Person 6 real-time feed."
        />
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "7px 14px", borderRadius: 999,
          background: "rgba(14,165,233,0.1)", border: "1px solid rgba(14,165,233,0.25)",
          fontSize: 12.5, fontWeight: 600, color: "var(--primary-deep)",
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%", background: "#0ea5e9",
            boxShadow: "0 0 0 3px rgba(14,165,233,0.25)", animation: "livePulse 1.8s ease infinite",
          }} />
          Live Trace
        </div>
      </div>

      {/* Stats */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: 12,
        margin: "24px 0 20px",
      }}>
        <MiniStat icon={FileText} label="Total Events" value={stats.total} color="#0ea5e9" />
        <MiniStat icon={Shield} label="Admin Actions" value={stats.admin} color="#8b5cf6" />
        <MiniStat icon={User} label="Staff Actions" value={stats.staff} color="#10b981" />
        <MiniStat icon={Activity} label="Showing" value={filtered.length} color="#f59e0b" />
      </div>

      {/* Filters */}
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
              borderRadius: 12, border: "1px solid var(--line)", background: "rgba(255,255,255,0.9)",
              fontSize: 13.5, outline: "none",
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

      {/* Timeline / Event list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {paginated.length === 0 && (
          <div className="holo-surface holo-border" style={{
            borderRadius: 16, padding: 48, textAlign: "center", color: "var(--subtle)",
          }}>
            No audit events match your filters
          </div>
        )}

        {paginated.map((event, idx) => (
          <div
            key={event.id || idx}
            className="holo-surface holo-border"
            style={{
              borderRadius: 16,
              padding: "16px 18px",
              display: "flex",
              gap: 16,
              alignItems: "flex-start",
              background: "rgba(255,255,255,0.7)",
              backdropFilter: "blur(12px)",
              transition: "transform 180ms, box-shadow 180ms",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 12px 32px rgba(14,165,233,0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            {/* Timeline dot */}
            <div style={{
              width: 36, height: 36, borderRadius: 11, flexShrink: 0,
              background: event.role === "admin"
                ? "rgba(139,92,246,0.12)"
                : event.role === "staff"
                  ? "rgba(16,185,129,0.12)"
                  : "rgba(14,165,233,0.12)",
              display: "grid", placeItems: "center",
            }}>
              {event.role === "admin" ? (
                <Shield size={16} color="#8b5cf6" />
              ) : event.role === "staff" ? (
                <User size={16} color="#10b981" />
              ) : (
                <Activity size={16} color="#0ea5e9" />
              )}
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 600, fontSize: 14.5, marginBottom: 4 }}>
                {event.action}
              </p>
              <div style={{
                display: "flex", flexWrap: "wrap", gap: "6px 14px",
                fontSize: 12.5, color: "var(--muted)",
              }}>
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
                  background: event.role === "admin"
                    ? "rgba(139,92,246,0.1)"
                    : event.role === "staff"
                      ? "rgba(16,185,129,0.1)"
                      : "rgba(14,165,233,0.1)",
                  color: event.role === "admin"
                    ? "#7c3aed"
                    : event.role === "staff"
                      ? "#059669"
                      : "var(--primary-deep)",
                }}>
                  {ROLE_LABEL[event.role] || event.role}
                </span>
                {event.issueId && (
                  <span style={{
                    fontFamily: "var(--font-mono)", fontSize: 12,
                    color: "var(--primary-deep)",
                  }}>
                    {event.issueId}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
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

      <style>{`
        @keyframes livePulse {
          0%, 100% { box-shadow: 0 0 0 3px rgba(14,165,233,0.25); }
          50% { box-shadow: 0 0 0 6px rgba(14,165,233,0.1); }
        }
      `}</style>
    </main>
  );
}

function MiniStat({ icon: Icon, label, value, color }) {
  return (
    <div className="holo-surface holo-border" style={{
      borderRadius: 14, padding: "14px 16px",
      background: "rgba(255,255,255,0.7)", backdropFilter: "blur(12px)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10,
          background: `${color}18`, display: "grid", placeItems: "center",
        }}>
          <Icon size={15} color={color} />
        </div>
        <div>
          <p style={{ fontSize: 11, color: "var(--subtle)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {label}
          </p>
          <p style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700 }}>
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

export default IssueAuditLogs;