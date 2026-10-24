import { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  X, MapPin, Calendar, Tag, User, Clock, LocateFixed, ArrowUpRight
} from "lucide-react";
import IssueStatusBadge from "./IssueStatusBadge";
import IssuePriorityBadge from "./IssuePriorityBadge";
import IssueSLAIndicator from "./IssueSLAIndicator";
import IssueStatusTimeline from "./IssueStatusTimeline";
import IssueComments from "./IssueComments";
import AdminConfirmClose from "../admin/AdminConfirmClose";
import { CATEGORY_LABEL } from "../../../constants/issueCategories";
import { PRIORITY_LABEL } from "../../../constants/issuePriorities";
import { STATUS_LABEL, publicStatus } from "../../../constants/issueStatuses";
import { formatDateTime } from "../../../utils/formatDate";
import { useAuth } from "../../../store/authStore";

function IssueDetailsDrawer({ issue, onClose }) {
  const user = useAuth();
  const isCitizen = user?.role === "citizen";
  const shownStatus = isCitizen ? publicStatus(issue?.status) : issue?.status;

  useEffect(() => {
    if (issue) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [issue]);

  if (!issue) return null;

  const hasCoords = Number.isFinite(issue.lat) && Number.isFinite(issue.lng);
  const mapTo = hasCoords
    ? `/map?lat=${issue.lat}&lng=${issue.lng}&issueId=${issue.id}`
    : "/map";

  const pinX = hasCoords ? 28 + (Math.abs(issue.lng * 100) % 44) : 50;
  const pinY = hasCoords ? 24 + (Math.abs(issue.lat * 100) % 40) : 46;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(8, 15, 28, 0.52)",
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
          background: "rgba(255, 255, 255, 0.78)",
          backdropFilter: "blur(28px) saturate(1.7)",
          borderLeft: "1px solid rgba(14, 165, 233, 0.25)",
          boxShadow: "-32px 0 90px rgba(14, 165, 233, 0.14)",
          animation: "slideInCyborg 0.36s cubic-bezier(0.22, 1, 0.36, 1)",
          overflow: "hidden",
        }}
      >
        <div style={{
          height: 3,
          background: "linear-gradient(90deg, transparent, #0ea5e9 15%, #22d3ee 50%, #0ea5e9 85%, transparent)",
        }} />

        <div style={{
          padding: "15px 22px",
          borderBottom: "1px solid rgba(14,165,233,0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "rgba(14,165,233,0.04)",
        }}>
          <div>
            <p style={{
              fontSize: 10.5,
              fontWeight: 600,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--primary)",
              marginBottom: 3,
            }}>
              Issue Record · Neural File
            </p>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 600 }}>
              {issue.id}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 38, height: 38, borderRadius: 11,
              border: "1px solid var(--line)", background: "rgba(255,255,255,0.85)",
              display: "grid", placeItems: "center", cursor: "pointer",
            }}
          >
            <X size={17} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "22px" }}>
          <h2 style={{
            fontFamily: "var(--font-display)",
            fontSize: 21,
            fontWeight: 700,
            lineHeight: 1.3,
            marginBottom: 12,
          }}>
            {issue.title}
          </h2>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
            <IssueStatusBadge status={issue.status} citizen={isCitizen} />
            {!isCitizen && <IssuePriorityBadge priority={issue.priority} />}
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              fontSize: 12, fontWeight: 500, padding: "4px 11px", borderRadius: 999,
              background: "rgba(14,165,233,0.1)", color: "var(--primary-deep)",
              border: "1px solid rgba(14,165,233,0.18)",
            }}>
              <Tag size={12} />
              {CATEGORY_LABEL[issue.category] || issue.category}
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
            {!isCitizen && (
              <GlassMeta icon={User} label="Assignee" value={issue.assignedTo || "Unassigned"} />
            )}
            <GlassMeta icon={MapPin} label="Zone" value={issue.ward} />
            <GlassMeta icon={Calendar} label="Reported" value={formatDateTime(issue.createdAt)} />
            <GlassMeta icon={Clock} label="Updated" value={formatDateTime(issue.updatedAt)} />
          </div>

          <div style={{
            position: "relative",
            borderRadius: 18,
            overflow: "hidden",
            marginBottom: 18,
            background: "linear-gradient(145deg, rgba(14,165,233,0.08), rgba(34,211,238,0.04))",
            border: "1px solid rgba(14,165,233,0.22)",
            boxShadow: "0 12px 40px rgba(14,165,233,0.12), inset 0 1px 0 rgba(255,255,255,0.6)",
            transform: "perspective(800px) rotateX(2deg)",
            transformStyle: "preserve-3d",
          }}>
            <div style={{
              position: "relative",
              height: 160,
              background: `
                radial-gradient(circle at 30% 40%, rgba(14,165,233,0.15), transparent 50%),
                radial-gradient(circle at 70% 60%, rgba(34,211,238,0.1), transparent 45%),
                linear-gradient(180deg, #e0f2fe 0%, #f0f9ff 100%)
              `,
              overflow: "hidden",
            }}>
              <div style={{
                position: "absolute", inset: 0,
                backgroundImage: `
                  linear-gradient(rgba(14,165,233,0.08) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(14,165,233,0.08) 1px, transparent 1px)
                `,
                backgroundSize: "28px 28px",
              }} />
              <div style={{
                position: "absolute",
                left: `${pinX}%`, top: `${pinY}%`,
                width: 70, height: 70,
                border: "1.5px solid rgba(14,165,233,0.35)",
                borderRadius: "50%",
                transform: "translate(-50%, -50%)",
                animation: "pulseRing 2.8s ease-out infinite",
              }} />
              <div style={{
                position: "absolute",
                left: `${pinX}%`, top: `${pinY}%`,
                width: 110, height: 110,
                border: "1px solid rgba(14,165,233,0.18)",
                borderRadius: "50%",
                transform: "translate(-50%, -50%)",
                animation: "pulseRing 2.8s ease-out infinite 0.6s",
              }} />
              <div style={{
                position: "absolute",
                left: `${pinX}%`, top: `${pinY}%`,
                transform: "translate(-50%, -50%)",
                width: 32, height: 32,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #0ea5e9, #22d3ee)",
                display: "grid", placeItems: "center",
                color: "white",
                boxShadow: "0 4px 16px rgba(14,165,233,0.5)",
                zIndex: 2,
              }}>
                <LocateFixed size={15} />
              </div>
              <div style={{
                position: "absolute", left: 0, right: 0, height: 2,
                background: "linear-gradient(90deg, transparent, rgba(34,211,238,0.6), transparent)",
                animation: "scanLine 3.5s linear infinite",
              }} />
            </div>

            <div style={{ padding: "14px 16px 16px" }}>
              <p style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 2 }}>{issue.location}</p>
              <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
                {issue.ward}
                {hasCoords && (
                  <span style={{ fontFamily: "var(--font-mono)", marginLeft: 8 }}>
                    {issue.lat.toFixed(5)}, {issue.lng.toFixed(5)}
                  </span>
                )}
              </p>
              <Link
                to={mapTo}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  height: 40,
                  borderRadius: 11,
                  background: "linear-gradient(135deg, #0ea5e9, #0284c7)",
                  color: "white",
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: "none",
                  boxShadow: "0 8px 20px rgba(14,165,233,0.3)",
                }}
              >
                Open exact site on city map
                <ArrowUpRight size={15} />
              </Link>
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <p style={{
              fontSize: 10.5, fontWeight: 600, letterSpacing: "0.1em",
              textTransform: "uppercase", color: "var(--subtle)", marginBottom: 6,
            }}>
              Description
            </p>
            <p style={{ fontSize: 14, lineHeight: 1.65, color: "var(--muted)" }}>
              {issue.description}
            </p>
          </div>

          {!isCitizen && (
            <div style={{
              background: "rgba(255,255,255,0.55)",
              border: "1px solid rgba(14,165,233,0.15)",
              borderRadius: 12,
              padding: "11px 16px",
              marginBottom: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              backdropFilter: "blur(8px)",
            }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>Service Window (SLA)</span>
              <IssueSLAIndicator issue={issue} />
            </div>
          )}

          <AdminConfirmClose issue={issue} />

          {!isCitizen && (
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              marginBottom: 22,
            }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--subtle)" }}>Status</span>
                <div style={{
                  height: 42, display: "flex", alignItems: "center",
                  padding: "0 12px", borderRadius: 12, border: "1px solid var(--line)",
                  background: "rgba(255,255,255,0.7)", fontSize: 13.5, fontWeight: 600,
                }}>
                  {STATUS_LABEL[issue.status]}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--subtle)" }}>Priority</span>
                <div style={{
                  height: 42, display: "flex", alignItems: "center",
                  padding: "0 12px", borderRadius: 12, border: "1px solid var(--line)",
                  background: "rgba(255,255,255,0.7)", fontSize: 13.5, fontWeight: 600,
                }}>
                  {PRIORITY_LABEL[issue.priority]}
                </div>
              </div>
            </div>
          )}

          {isCitizen && (
            <div style={{
              borderRadius: 14,
              padding: 14,
              marginBottom: 22,
              background: "rgba(255,255,255,0.55)",
              border: "1px solid rgba(14,165,233,0.14)",
            }}>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--subtle)" }}>
                Official update
              </p>
              <p style={{ marginTop: 8, fontSize: 14 }}>
                Current status: <strong>{STATUS_LABEL[shownStatus]}</strong>
              </p>
              <p style={{ marginTop: 6, fontSize: 12.5, color: "var(--muted)" }}>
                City operations is handling this report.
              </p>
            </div>
          )}

          <div style={{ marginBottom: 22 }}>
            <p style={{
              fontSize: 10.5, fontWeight: 600, letterSpacing: "0.1em",
              textTransform: "uppercase", color: "var(--subtle)", marginBottom: 12,
            }}>
              Status Timeline
            </p>
            <IssueStatusTimeline
              current={issue.status}
              events={issue.timeline}
              citizen={isCitizen}
            />
          </div>

          <IssueComments issue={issue} />
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
        @keyframes pulseRing {
          0% { transform: translate(-50%, -50%) scale(0.7); opacity: 0.8; }
          100% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; }
        }
        @keyframes scanLine {
          0% { top: 0; }
          100% { top: 100%; }
        }
      `}</style>
    </>
  );
}

function GlassMeta({ icon: Icon, label, value }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.55)",
      border: "1px solid rgba(14,165,233,0.14)",
      borderRadius: 12,
      padding: "11px 13px",
      display: "flex",
      gap: 10,
      alignItems: "flex-start",
      backdropFilter: "blur(8px)",
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: 8,
        background: "rgba(14,165,233,0.12)",
        display: "grid", placeItems: "center", flexShrink: 0,
      }}>
        <Icon size={13} color="var(--primary)" />
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 10.5, color: "var(--subtle)", marginBottom: 2 }}>{label}</p>
        <p style={{
          fontSize: 13, fontWeight: 500,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {value}
        </p>
      </div>
    </div>
  );
}

export default IssueDetailsDrawer;