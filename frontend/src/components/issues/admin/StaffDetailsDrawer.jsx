import { useEffect } from "react";
import {
  X, User, Shield, Activity, CheckCircle2, AlertTriangle,
  MapPin, Clock
} from "lucide-react";
import IssueStatusBadge from "../shared/IssueStatusBadge";
import IssuePriorityBadge from "../shared/IssuePriorityBadge";
import { CATEGORY_LABEL } from "../../../constants/issueCategories";
import { formatDateTime } from "../../../utils/formatDate";
import { STAFF_TITLES, getStaffTitle, setStaffTitle } from "../../../store/staffTitleStore";

function suggestedTitle(perf) {
  if (perf.resolved >= 3 && perf.open === 0) return "Senior Specialist";
  if (perf.resolved >= 2 || perf.assigned >= 2) return "Specialist";
  if (perf.assigned >= 1) return "Field Operative";
  return "Field Operative";
}

function StaffDetailsDrawer({ staff, issues, audit, onClose }) {
  useEffect(() => {
    if (staff) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [staff]);

  if (!staff) return null;

  const assigned = issues.filter((i) => i.assignedTo === staff);
  const open = assigned.filter((i) => i.status !== "resolved");
  const resolved = assigned.filter((i) => i.status === "resolved");
  const critical = assigned.filter((i) => i.priority === "critical" || i.priority === "high");
  const events = (audit || []).filter((e) => e.actor === staff).slice(0, 8);
  const title = getStaffTitle(staff);
  const suggest = suggestedTitle({
    assigned: assigned.length,
    open: open.length,
    resolved: resolved.length,
  });

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(8,15,28,0.52)",
          backdropFilter: "blur(14px)",
          zIndex: 90,
          animation: "fadeIn 0.22s ease",
        }}
      />

      <aside
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          width: "min(540px, 100vw)",
          height: "100dvh",
          zIndex: 100,
          display: "flex",
          flexDirection: "column",
          background: "rgba(255,255,255,0.8)",
          backdropFilter: "blur(28px) saturate(1.6)",
          borderLeft: "1px solid rgba(14,165,233,0.25)",
          boxShadow: "-32px 0 90px rgba(14,165,233,0.14)",
          animation: "slideInCyborg 0.36s cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        <div style={{
          height: 3,
          background: "linear-gradient(90deg, transparent, #0ea5e9 20%, #22d3ee 50%, #0ea5e9 80%, transparent)",
        }} />

        <div style={{
          padding: "16px 22px",
          borderBottom: "1px solid rgba(14,165,233,0.1)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "rgba(14,165,233,0.04)",
        }}>
          <div>
            <p style={{
              fontSize: 10.5, fontWeight: 600, letterSpacing: "0.14em",
              textTransform: "uppercase", color: "var(--primary)", marginBottom: 4,
            }}>
              Personnel File · Neural Dossier
            </p>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, margin: 0 }}>
              {staff}
            </h2>
            <p style={{ marginTop: 4, fontSize: 13, color: "var(--muted)" }}>{title}</p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 38, height: 38, borderRadius: 11, border: "1px solid var(--line)",
              background: "white", display: "grid", placeItems: "center", cursor: "pointer",
            }}
          >
            <X size={17} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 22 }}>
          {/* Performance */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 22,
          }}>
            <Mini icon={Activity} label="Assigned" value={assigned.length} color="#0ea5e9" />
            <Mini icon={AlertTriangle} label="Open" value={open.length} color="#f59e0b" />
            <Mini icon={CheckCircle2} label="Resolved" value={resolved.length} color="#10b981" />
            <Mini icon={Shield} label="High / Critical" value={critical.length} color="#ef4444" />
          </div>

          {/* Promote */}
          <div style={{
            borderRadius: 16, padding: 16, marginBottom: 22,
            background: "rgba(255,255,255,0.6)",
            border: "1px solid rgba(14,165,233,0.16)",
          }}>
            <p style={{
              fontSize: 10.5, fontWeight: 600, letterSpacing: "0.1em",
              textTransform: "uppercase", color: "var(--subtle)", marginBottom: 8,
            }}>
              Rank Control
            </p>
            <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
              Suggested rank from live work: <strong>{suggest}</strong>
            </p>
            <select
              value={title}
              onChange={(e) => setStaffTitle(staff, e.target.value)}
              style={{
                width: "100%", height: 42, borderRadius: 11,
                border: "1px solid var(--line)", background: "white",
                padding: "0 12px", fontSize: 13.5,
              }}
            >
              {STAFF_TITLES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Current assignments */}
          <p style={{
            fontSize: 10.5, fontWeight: 600, letterSpacing: "0.1em",
            textTransform: "uppercase", color: "var(--subtle)", marginBottom: 10,
          }}>
            Current Assignments
          </p>

          {assigned.length === 0 ? (
            <p style={{ color: "var(--subtle)", fontSize: 13, marginBottom: 22 }}>No active file lock.</p>
          ) : (
            <div style={{ display: "grid", gap: 10, marginBottom: 22 }}>
              {assigned.map((issue) => (
                <div key={issue.id} style={{
                  borderRadius: 14, padding: 12,
                  background: "rgba(255,255,255,0.55)",
                  border: "1px solid rgba(14,165,233,0.12)",
                }}>
                  <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--subtle)" }}>{issue.id}</p>
                  <p style={{ fontWeight: 600, fontSize: 14, margin: "4px 0 8px" }}>{issue.title}</p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <IssueStatusBadge status={issue.status} />
                    <IssuePriorityBadge priority={issue.priority} />
                    <span style={{ fontSize: 12, color: "var(--muted)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <MapPin size={11} /> {issue.ward}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--subtle)" }}>
                      {CATEGORY_LABEL[issue.category]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Activity */}
          <p style={{
            fontSize: 10.5, fontWeight: 600, letterSpacing: "0.1em",
            textTransform: "uppercase", color: "var(--subtle)", marginBottom: 10,
          }}>
            Recent Activity
          </p>

          {events.length === 0 ? (
            <p style={{ color: "var(--subtle)", fontSize: 13 }}>No traced actions yet.</p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {events.map((event) => (
                <div key={event.id} style={{
                  display: "flex", gap: 10, alignItems: "flex-start",
                  padding: "10px 0",
                  borderBottom: "1px solid rgba(14,165,233,0.08)",
                }}>
                  <Clock size={14} color="var(--primary)" style={{ marginTop: 2 }} />
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 500 }}>{event.action}</p>
                    <p style={{ fontSize: 12, color: "var(--subtle)" }}>
                      {formatDateTime(event.at)} {event.issueId ? `· ${event.issueId}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideInCyborg {
          from { transform: translateX(110%); opacity: 0.4; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </>
  );
}

function Mini({ icon: Icon, label, value, color }) {
  return (
    <div style={{
      borderRadius: 14, padding: 12,
      background: "rgba(255,255,255,0.58)",
      border: "1px solid rgba(14,165,233,0.12)",
      display: "flex", gap: 10, alignItems: "center",
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 9,
        background: `${color}18`, display: "grid", placeItems: "center",
      }}>
        <Icon size={14} color={color} />
      </div>
      <div>
        <p style={{ fontSize: 11, color: "var(--subtle)" }}>{label}</p>
        <p style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--font-display)" }}>{value}</p>
      </div>
    </div>
  );
}

export default StaffDetailsDrawer;