import { useState } from "react";
import { addComment, updateStatus } from "../../../store/issueStore";
import { useAuth } from "../../../store/authStore";
import Button from "../../ui/Button";
import { Textarea } from "../../ui/Input";

function StaffResolutionForm({ issue }) {
  const user = useAuth();
  const [note, setNote] = useState("");

  return (
    <div className="panel" style={{ padding: 16 }}>
      <h3 style={{ fontSize: 15 }}>Close issue</h3>
      <p style={{ margin: "8px 0 12px", color: "var(--muted)", fontSize: 14 }}>
        Add a short resolution note, then mark resolved.
      </p>
      <Textarea
        rows={4}
        value={note}
        placeholder="What was done on site?"
        onChange={(e) => setNote(e.target.value)}
      />
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
        <Button
          type="button"
          disabled={issue.status === "resolved"}
          onClick={() => {
            if (note.trim()) addComment(issue.id, note.trim(), user.name, user.role, true);
            updateStatus(issue.id, "resolved", user.name);
            setNote("");
          }}
        >
          Mark resolved
        </Button>
      </div>
    </div>
  );
}

export default StaffResolutionForm;