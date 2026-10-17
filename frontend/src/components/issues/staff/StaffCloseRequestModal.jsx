import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ShieldCheck, X } from "lucide-react";
import { addComment, updateStatus } from "../../../store/issueStore";
import { useAuth } from "../../../store/authStore";

function StaffCloseRequestModal({ issue, onClose }) {
  const user = useAuth();
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!issue) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [issue]);

  if (!issue) return null;

  const send = () => {
    if (note.trim()) addComment(issue.id, note.trim(), user.name, user.role, true);
    updateStatus(issue.id, "pending_review", user.name, user.role);
    onClose();
  };

  return createPortal(
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 200,
          background: "rgba(8,15,28,0.5)",
          backdropFilter: "blur(14px)",
        }}
      />

      <aside
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          width: "min(440px, 100vw)",
          height: "100dvh",
          zIndex: 210,
          display: "flex",
          flexDirection: "column",
          background: "rgba(255,255,255,0.86)",
          backdropFilter: "blur(28px) saturate(1.6)",
          borderLeft: "1px solid rgba(245,158,11,0.28)",
          boxShadow: "-28px 0 80px rgba(245,158,11,0.14)",
          animation: "slideInClose 0.34s cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <div style={{
          height: 3,
          background: "linear-gradient(90deg, transparent, #f59e0b 20%, #22d3ee 80%, transparent)",
        }} />

        <div style={{
          padding: "18px 22px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          borderBottom: "1px solid rgba(245,158,11,0.12)",
        }}>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 14, flexShrink: 0,
              background: "linear-gradient(135deg, #f59e0b, #d97706)",
              display: "grid", placeItems: "center", color: "white",
              boxShadow: "0 10px 22px rgba(245,158,11,0.28)",
            }}>
              <ShieldCheck size={18} />
            </div>
            <div>
              <p style={{
                fontSize: 10.5, fontWeight: 650, letterSpacing: "0.14em",
                textTransform: "uppercase", color: "#b45309",
              }}>
                Close request · Command gate
              </p>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 650, marginTop: 4 }}>
                {issue.id}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 38, height: 38, borderRadius: 11, border: "1px solid var(--line)",
              background: "rgba(255,255,255,0.9)", display: "grid", placeItems: "center", cursor: "pointer",
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 22 }}>
          <h2 style={{
            fontFamily: "var(--font-display)",
            fontSize: 22,
            fontWeight: 700,
            lineHeight: 1.25,
            marginBottom: 10,
          }}>
            Ask Admin to close this ticket
          </h2>
          <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.65, marginBottom: 18 }}>
            Field cannot mark Resolved. This sends a close request. The citizen keeps seeing
            In Progress until Admin confirms from the issue file.
          </p>

          <div style={{
            borderRadius: 14,
            padding: "12px 14px",
            marginBottom: 18,
            background: "rgba(245,158,11,0.08)",
            border: "1px solid rgba(245,158,11,0.22)",
          }}>
            <p style={{ fontSize: 12, color: "var(--subtle)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Ticket
            </p>
            <p style={{ fontSize: 14, fontWeight: 650, marginTop: 4 }}>{issue.title}</p>
          </div>

          <p style={{
            fontSize: 11, fontWeight: 650, letterSpacing: "0.08em",
            textTransform: "uppercase", color: "var(--subtle)", marginBottom: 8,
          }}>
            Site note
          </p>
          <textarea
            rows={6}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What was completed on site?"
            style={{
              width: "100%",
              borderRadius: 14,
              border: "1px solid var(--line)",
              padding: 14,
              fontSize: 14,
              lineHeight: 1.5,
              resize: "vertical",
              minHeight: 140,
              background: "rgba(255,255,255,0.95)",
            }}
          />
        </div>

        <div style={{
          padding: 18,
          display: "flex",
          gap: 10,
          borderTop: "1px solid rgba(245,158,11,0.12)",
          background: "rgba(255,255,255,0.55)",
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1, height: 44, borderRadius: 12,
              border: "1px solid var(--line)", background: "white",
              fontWeight: 600, cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={send}
            style={{
              flex: 1.4, height: 44, borderRadius: 12, border: "none",
              background: "linear-gradient(135deg, #f59e0b, #d97706)",
              color: "white", fontWeight: 650, cursor: "pointer",
              boxShadow: "0 10px 22px rgba(245,158,11,0.28)",
            }}
          >
            Send to Admin
          </button>
        </div>
      </aside>

      <style>{`
        @keyframes slideInClose {
          from { transform: translateX(110%); opacity: 0.45; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </>,
    document.body
  );
}

export default StaffCloseRequestModal;