import { useState } from "react";
import { addComment, updateStatus } from "../../../store/issueStore";
import { useAuth } from "../../../store/authStore";

function StaffResolutionForm({ issue }) {
  const user = useAuth();
  const [note, setNote] = useState("");

  return (
    <div style={{
      borderRadius: 14,
      padding: 14,
      background: "rgba(255,255,255,0.55)",
      border: "1px solid rgba(245,158,11,0.28)",
    }}>
      <p style={{ fontSize: 13, fontWeight: 650, marginBottom: 8 }}>Request close</p>
      <p style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 8 }}>
        Citizen still sees In Progress until Admin confirms Resolved.
      </p>
      <textarea
        rows={3}
        value={note}
        placeholder="What was done on site?"
        onChange={(e) => setNote(e.target.value)}
        style={{
          width: "100%",
          borderRadius: 10,
          border: "1px solid var(--line)",
          padding: 10,
          fontSize: 13,
          resize: "vertical",
        }}
      />
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
        <button
          type="button"
          disabled={issue.status === "resolved" || issue.status === "submitted"}
          onClick={() => {
            if (note.trim()) addComment(issue.id, note.trim(), user.name, user.role, true);
            updateStatus(issue.id, "pending_review", user.name, user.role);
            setNote("");
          }}
          style={{
            height: 36, padding: "0 14px", borderRadius: 10, border: "none",
            background: "linear-gradient(135deg, #f59e0b, #d97706)",
            color: "white", fontSize: 12.5, fontWeight: 650, cursor: "pointer",
          }}
        >
          Send for Admin confirm
        </button>
      </div>
    </div>
  );
}

export default StaffResolutionForm;