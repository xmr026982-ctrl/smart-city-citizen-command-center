import { useState } from "react";
import { addComment } from "../../../store/issueStore";
import { useAuth } from "../../../store/authStore";

function StaffInternalNotes({ issue }) {
  const user = useAuth();
  const [body, setBody] = useState("");

  return (
    <div style={{
      borderRadius: 14,
      padding: 14,
      background: "rgba(255,255,255,0.55)",
      border: "1px solid rgba(14,165,233,0.16)",
    }}>
      <p style={{
        fontSize: 11,
        fontWeight: 650,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--subtle)",
        marginBottom: 8,
      }}>
        Internal note
      </p>
      <textarea
        rows={4}
        value={body}
        placeholder="Visible to staff and admin only"
        onChange={(e) => setBody(e.target.value)}
        style={{
          width: "100%",
          borderRadius: 10,
          border: "1px solid var(--line)",
          padding: 10,
          fontSize: 13,
          resize: "vertical",
          background: "rgba(255,255,255,0.9)",
        }}
      />
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
        <button
          type="button"
          disabled={!body.trim()}
          onClick={() => {
            addComment(issue.id, body.trim(), user.name, user.role, true);
            setBody("");
          }}
          style={{
            height: 36,
            padding: "0 14px",
            borderRadius: 10,
            border: "none",
            background: body.trim()
              ? "linear-gradient(135deg, #0ea5e9, #0284c7)"
              : "var(--line)",
            color: "white",
            fontSize: 12.5,
            fontWeight: 650,
            cursor: body.trim() ? "pointer" : "not-allowed",
          }}
        >
          Save note
        </button>
      </div>
    </div>
  );
}

export default StaffInternalNotes;