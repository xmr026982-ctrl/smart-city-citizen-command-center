import { useState } from "react";
import { addComment } from "../../../store/issueStore";
import { useAuth } from "../../../store/authStore";
import { formatDateTime } from "../../../utils/formatDate";
import { ROLE_LABEL } from "../../../constants/userRoles";
import Button from "../../ui/Button";
import { Textarea } from "../../ui/Input";

function IssueComments({ issue }) {
  const user = useAuth();
  const [body, setBody] = useState("");
  const visible = issue.comments.filter(
    (comment) => !comment.internal || user.role !== "citizen"
  );

  return (
    <section>
      <h3 style={{ marginBottom: 12, fontSize: 15 }}>Activity</h3>
      <div style={{ display: "grid", gap: 10 }}>
        {visible.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 14 }}>No comments yet.</p>
        ) : (
          visible.map((comment) => (
            <div key={comment.id} className="panel" style={{ padding: 14, borderRadius: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <strong style={{ fontSize: 14 }}>
                  {comment.author}
                  <span className="mono" style={{ marginLeft: 8, fontWeight: 400 }}>
                    {ROLE_LABEL[comment.role]}
                    {comment.internal ? " · Internal" : ""}
                  </span>
                </strong>
                <span className="mono">{formatDateTime(comment.createdAt)}</span>
              </div>
              <p style={{ marginTop: 6, fontSize: 14, color: "var(--muted)" }}>{comment.body}</p>
            </div>
          ))
        )}
      </div>
      <div style={{ marginTop: 12 }}>
        <Textarea
          rows={3}
          value={body}
          placeholder={user.role === "citizen" ? "Add a public update" : "Add an internal note"}
          onChange={(e) => setBody(e.target.value)}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
          <Button
            type="button"
            disabled={!body.trim()}
            onClick={() => {
              addComment(issue.id, body.trim(), user.name, user.role, user.role !== "citizen");
              setBody("");
            }}
          >
            Post note
          </Button>
        </div>
      </div>
    </section>
  );
}

export default IssueComments;