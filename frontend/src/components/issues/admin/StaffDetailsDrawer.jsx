import { useEffect } from "react";
import {
  X, Shield, Activity, CheckCircle2, AlertTriangle,
  Lock, Zap
} from "lucide-react";
import IssueStatusBadge from "../shared/IssueStatusBadge";
import IssuePriorityBadge from "../shared/IssuePriorityBadge";
import { CATEGORY_LABEL } from "../../../constants/issueCategories";
import { getStaffTitle } from "../../../store/staffTitleStore";
import { getStaffExpertise, expertiseLabel } from "../../../store/staffExpertiseStore";

function StaffDetailsDrawer({ staff, issues, audit, onClose }) {
  useEffect(() => {
    if (staff) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [staff]);

  if (!staff) return null;

  const title = getStaffTitle(staff);
  const expertise = getStaffExpertise(staff);
  const expertiseLabelText = expertiseLabel(expertise);

  const assigned = issues.filter((i) => i.assignedTo === staff);
  const open = assigned.filter((i) => i.status !== "resolved");
  const resolved = assigned.filter((i) => i.status === "resolved");
  const critical = assigned.filter((i) => i.priority === "critical" || i.priority === "high");

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
          padding: "18px 20px",
          borderBottom: "1px solid rgba(14,165,233,0.12)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <div>
            <p style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--primary-deep)", fontWeight: 650 }}>
              Personnel File
            </p>
            <h2 style={{ margin: "4px 0 0", fontFamily: "var(--font-display)", fontSize: 22 }}>{staff}</h2>
            <p style={{ marginTop: 4, fontSize: 13, color: "var(--muted)" }}>{title}</p>
          </div>
          <button type="button" onClick={onClose} style={{
            width: 36, height: 36, borderRadius: 10, border: "1px solid var(--line)",
            background: "white", display: "grid", placeItems: "center", cursor: "pointer",
          }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
            <GlassStat icon={Activity} label="Open" value={open.length} />
            <GlassStat icon={CheckCircle2} label="Resolved" value={resolved.length} />
            <GlassStat icon={AlertTriangle} label="High/Critical" value={critical.length} />
            <GlassStat icon={Shield} label="Total assigned" value={assigned.length} />
          </div>

          <div style={{
            borderRadius: 16, padding: 16, marginBottom: 12,
            background: "rgba(255,255,255,0.55)",
            border: "1px solid rgba(14,165,233,0.14)",
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "rgba(14,165,233,0.12)",
              display: "grid", placeItems: "center",
            }}>
              <Lock size={16} color="var(--primary)" />
            </div>
            <div>
              <p style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--subtle)", fontWeight: 650 }}>
                Rank (locked)
              </p>
              <p style={{ fontSize: 15, fontWeight: 650, marginTop: 2 }}>{title}</p>
              <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                Controlled from Staff Desk
              </p>
            </div>
          </div>

          <div style={{
            borderRadius: 16, padding: 16, marginBottom: 20,
            background: "rgba(255,255,255,0.55)",
            border: "1px solid rgba(16,185,129,0.2)",
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "rgba(16,185,129,0.12)",
              display: "grid", placeItems: "center",
            }}>
              <Zap size={16} color="#059669" />
            </div>
            <div>
              <p style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--subtle)", fontWeight: 650 }}>
                Expertise (locked)
              </p>
              <p style={{ fontSize: 15, fontWeight: 650, marginTop: 2 }}>{expertiseLabelText}</p>
              <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                Set at clearance. Cannot be changed.
              </p>
            </div>
          </div>

          <p style={{
            fontSize: 10.5, fontWeight: 600, letterSpacing: "0.1em",
            textTransform: "uppercase", color: "var(--subtle)", marginBottom: 10,
          }}>
            Current Assignments
          </p>

          {assigned.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--muted)" }}>No current assignments.</p>
          ) : (
            assigned.map((issue) => (
              <div
                key={issue.id}
                style={{
                  padding: "12px 14px",
                  borderRadius: 12,
                  marginBottom: 8,
                  background: "rgba(255,255,255,0.5)",
                  border: "1px solid rgba(14,165,233,0.1)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <p style={{ fontWeight: 600, fontSize: 13.5 }}>{issue.title}</p>
                  <IssueStatusBadge status={issue.status} />
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center" }}>
                  <IssuePriorityBadge priority={issue.priority} />
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>
                    {CATEGORY_LABEL[issue.category] || issue.category}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideInCyborg {
          from { transform: translateX(110%); opacity: 0.4; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </>
  );
}

function GlassStat({ icon: Icon, label, value }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.55)",
      border: "1px solid rgba(14,165,233,0.14)",
      borderRadius: 12,
      padding: "12px 14px",
      display: "flex",
      gap: 10,
      alignItems: "center",
    }}>
      <Icon size={16} color="var(--primary)" />
      <div>
        <p style={{ fontSize: 11, color: "var(--subtle)" }}>{label}</p>
        <p style={{ fontSize: 16, fontWeight: 650 }}>{value}</p>
      </div>
    </div>
  );
}

export default StaffDetailsDrawer;