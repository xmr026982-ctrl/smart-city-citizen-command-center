import { useState } from "react";
import { addComment } from "../../../store/issueStore";
import { useAuth } from "../../../store/authStore";
import Button from "../../ui/Button";
import { Textarea } from "../../ui/Input";

function StaffInternalNotes({ issue }) {
  const user = useAuth();
  const [body, setBody] = useState("");

  return (
    <div>
      <h3 style={{ fontSize: 15, marginBottom: 8 }}>Internal note</h3>
      <Textarea
        rows={4}
        value={body}
        placeholder="Visible to staff and admin only"
        onChange={(e) => setBody(e.target.value)}
      />
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
        <Button
          type="button"
          disabled={!body.trim()}
          onClick={() => {
            addComment(issue.id, body.trim(), user.name, user.role, true);
            setBody("");
          }}
        >
          Save note
        </Button>
      </div>
    </div>
  );
}

export default StaffInternalNotes;