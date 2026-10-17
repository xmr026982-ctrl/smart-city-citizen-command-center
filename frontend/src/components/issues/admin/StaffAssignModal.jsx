import { useEffect, useMemo, useState } from "react";
import { Search, X, UserPlus, Shield, Flag, MapPin } from "lucide-react";
import { STAFF_ROSTER } from "../../../constants/issueConstants";
import { STATUS_LABEL } from "../../../constants/issueStatuses";
import { ISSUE_PRIORITIES, PRIORITY_LABEL } from "../../../constants/issuePriorities";
import { useIssues } from "../../../store/issueStore";
import { getStaffTitle } from "../../../store/staffTitleStore";

function StaffAssignModal({ isOpen, onClose, issue, onAssign }) {
  const issues = useIssues();
  const [query, setQuery] = useState("");
  const [staff, setStaff] = useState("");
  const [priority, setPriority] = useState("medium");

  useEffect(() => {
    if (!isOpen || !issue) return;
    setQuery("");
    setStaff(issue.assignedTo || "");
    setPriority(issue.priority || "medium");
  }, [isOpen, issue]);

  const rows = useMemo(() => {
    return STAFF_ROSTER
      .filter((name) => name.toLowerCase().includes(query.toLowerCase()))
      .map((name) => ({
        name,
        title: getStaffTitle(name),
        active: issues.filter((i) => i.assignedTo === name && i.status !== "resolved").length,
      }));
  }, [issues, query]);

  if (!isOpen || !issue) return null;

  const dispatchStatus = issue.status === "submitted" ? "acknowledged" : issue.status;

  const confirm = () => {
    onAssign({
      staffName: staff || null,
      status: dispatchStatus,
      priority,
    });
    onClose();
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 80,
          background: "rgba(8,15,28,0.45)",
          backdropFilter: "blur(10px)",
        }}
      />
      <div
        style={{
          position: "fixed",
          zIndex: 90,
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(520px, calc(100vw - 24px))",
          maxHeight: "86dvh",
          display: "flex",
          flexDirection: "column",
          borderRadius: 22,
          background: "rgba(255,255,255,0.86)",
          backdropFilter: "blur(22px) saturate(1.5)",
          border: "1px solid rgba(255,255,255,0.8)",
          boxShadow: "0 30px 80px rgba(14,165,233,0.18)",
          overflow: "hidden",
        }}
      >
        <div style={{
          height: 3,
          background: "linear-gradient(90deg, transparent, #0ea5e9, #22d3ee, transparent)",
        }} />

        <div style={{
          padding: "16px 18px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid rgba(14,165,233,0.1)",
        }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: "linear-gradient(135deg, #0ea5e9, #0284c7)",
              display: "grid", placeItems: "center", color: "white",
            }}>
              <UserPlus size={18} />
            </div>
            <div>
              <p style={{ fontWeight: 700, fontSize: 16 }}>Assign Specialist</p>
              <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                Issue #{issue.id} · Acknowledge + dispatch
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 36, height: 36, borderRadius: 10, border: "1px solid var(--line)",
              background: "white", display: "grid", placeItems: "center", cursor: "pointer",
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: 16, display: "grid", gap: 12, borderBottom: "1px solid rgba(14,165,233,0.08)" }}>
          <div>
            <span style={labelStyle}><Shield size={12} /> Status</span>
            <div style={{ ...selectStyle, display: "flex", alignItems: "center", fontWeight: 650 }}>
              {STATUS_LABEL[dispatchStatus]}
            </div>
            <p style={{ fontSize: 12, color: "var(--subtle)", marginTop: 6 }}>
              {issue.status === "submitted"
                ? "First dispatch acknowledges the ticket. Admin cannot set In Progress or Resolved here."
                : "Field owns In Progress. Admin only confirms close from the issue file."}
            </p>
          </div>
          <label>
            <span style={labelStyle}><Flag size={12} /> Priority</span>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} style={selectStyle}>
              {ISSUE_PRIORITIES.map((p) => (
                <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
              ))}
            </select>
          </label>
        </div>

        <div style={{ padding: "12px 16px 8px", position: "relative" }}>
          <Search size={14} style={{ position: "absolute", left: 28, top: 24, color: "var(--subtle)" }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name…"
            style={{
              width: "100%", height: 40, paddingLeft: 36, paddingRight: 12,
              borderRadius: 12, border: "1px solid var(--line)",
              background: "rgba(255,255,255,0.95)", outline: "none", fontSize: 13.5,
            }}
          />
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "4px 12px 12px" }}>
          {rows.map((row) => {
            const active = staff === row.name;
            return (
              <button
                key={row.name}
                onClick={() => setStaff(row.name)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  border: active ? "1.5px solid var(--primary)" : "1px solid transparent",
                  background: active ? "rgba(14,165,233,0.08)" : "transparent",
                  borderRadius: 14,
                  padding: "10px 10px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  cursor: "pointer",
                  marginBottom: 4,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 12,
                    background: "linear-gradient(135deg, #0ea5e9, #22d3ee)",
                    color: "white", display: "grid", placeItems: "center",
                    fontSize: 11, fontWeight: 700,
                  }}>
                    {row.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}
                  </div>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: 13.5 }}>{row.name}</p>
                    <p style={{ fontSize: 12, color: "var(--muted)" }}>{row.title}</p>
                  </div>
                </div>
                <span style={{ fontSize: 12, color: "var(--subtle)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <MapPin size={11} /> {row.active} active
                </span>
              </button>
            );
          })}
        </div>

        <div style={{
          padding: 14,
          display: "flex",
          justifyContent: "flex-end",
          gap: 8,
          borderTop: "1px solid rgba(14,165,233,0.1)",
        }}>
          <button
            onClick={onClose}
            style={{
              height: 40, padding: "0 16px", borderRadius: 11,
              border: "1px solid var(--line)", background: "white", cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={confirm}
            disabled={!staff}
            style={{
              height: 40, padding: "0 16px", borderRadius: 11, border: "none",
              background: "linear-gradient(135deg, #0ea5e9, #0284c7)",
              color: "white", fontWeight: 650,
              cursor: staff ? "pointer" : "not-allowed",
              opacity: staff ? 1 : 0.5,
              boxShadow: "0 8px 18px rgba(14,165,233,0.28)",
            }}
          >
            Confirm dispatch
          </button>
        </div>
      </div>
    </>
  );
}

const labelStyle = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontSize: 11,
  fontWeight: 650,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--subtle)",
  marginBottom: 6,
};

const selectStyle = {
  width: "100%",
  height: 42,
  borderRadius: 12,
  border: "1px solid var(--line)",
  background: "white",
  padding: "0 12px",
  fontSize: 13.5,
};

export default StaffAssignModal;