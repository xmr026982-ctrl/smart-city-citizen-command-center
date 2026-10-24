import { useEffect, useMemo, useState } from "react";
import { Search, X, Flag, MapPin, Zap } from "lucide-react";
import { STAFF_ROSTER } from "../../../constants/issueConstants";
import { ISSUE_PRIORITIES, PRIORITY_LABEL } from "../../../constants/issuePriorities";
import { CATEGORY_LABEL } from "../../../constants/issueCategories";
import { useIssues } from "../../../store/issueStore";
import { getStaffTitle } from "../../../store/staffTitleStore";
import { getStaffExpertise, expertiseLabel, matchesExpertise } from "../../../store/staffExpertiseStore";

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
    if (!issue) return [];
    return STAFF_ROSTER
      .filter((name) => name.toLowerCase().includes(query.toLowerCase()))
      .map((name) => {
        const expertise = getStaffExpertise(name);
        const match = matchesExpertise(expertise, issue.category);
        return {
          name,
          title: getStaffTitle(name),
          expertise,
          expertiseLabel: expertiseLabel(expertise),
          match,
          active: issues.filter((i) => i.assignedTo === name && i.status !== "resolved").length,
        };
      })
      .sort((a, b) => {
        if (a.match !== b.match) return a.match ? -1 : 1;
        return a.active - b.active;
      });
  }, [issues, query, issue]);

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
          width: "min(540px, calc(100vw - 24px))",
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

        <div style={{ padding: "16px 18px 10px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <p style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--primary-deep)", fontWeight: 650 }}>
              Dispatch
            </p>
            <h3 style={{ margin: "4px 0 0", fontFamily: "var(--font-display)", fontSize: 20 }}>
              Assign specialist
            </h3>
            <p style={{ marginTop: 4, fontSize: 12.5, color: "var(--muted)" }}>
              {issue.title} · {CATEGORY_LABEL[issue.category] || issue.category}
            </p>
          </div>
          <button onClick={onClose} style={{
            width: 34, height: 34, borderRadius: 10, border: "1px solid var(--line)",
            background: "white", display: "grid", placeItems: "center", cursor: "pointer",
          }}>
            <X size={15} />
          </button>
        </div>

        <div style={{ padding: "0 18px 10px" }}>
          <div style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--subtle)" }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search staff"
              style={{
                width: "100%", height: 40, borderRadius: 12, border: "1px solid var(--line)",
                paddingLeft: 34, paddingRight: 12, fontSize: 13.5, background: "white",
              }}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "0 12px" }}>
          {rows.map((row) => {
            const selected = staff === row.name;
            return (
              <button
                key={row.name}
                onClick={() => setStaff(row.name)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 12px",
                  marginBottom: 6,
                  borderRadius: 14,
                  border: selected
                    ? "1px solid rgba(14,165,233,0.5)"
                    : row.match
                    ? "1px solid rgba(16,185,129,0.35)"
                    : "1px solid rgba(14,165,233,0.12)",
                  background: selected
                    ? "rgba(14,165,233,0.08)"
                    : row.match
                    ? "rgba(16,185,129,0.06)"
                    : "rgba(255,255,255,0.5)",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
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
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                      <Zap size={11} color={row.match ? "#059669" : "var(--subtle)"} />
                      <span style={{
                        fontSize: 11.5,
                        fontWeight: 650,
                        color: row.match ? "#059669" : "var(--subtle)",
                      }}>
                        {row.expertiseLabel}
                        {row.match ? " · Match" : " · Other"}
                      </span>
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: 12, color: "var(--subtle)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <MapPin size={11} /> {row.active} active
                </span>
              </button>
            );
          })}
        </div>

        <div style={{ padding: "10px 18px", borderTop: "1px solid rgba(14,165,233,0.1)" }}>
          <label style={labelStyle}>
            <Flag size={12} /> Priority
          </label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            style={selectStyle}
          >
            {ISSUE_PRIORITIES.map((p) => (
              <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
            ))}
          </select>
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