import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../store/authStore";
import { toggleSaved } from "../../../store/issueStore";

function IssueActionMenu({ issue }) {
  const user = useAuth();
  const navigate = useNavigate();

  const detailsPath =
    user.role === "admin"
      ? `/admin/issues/${issue.id}`
      : user.role === "staff"
        ? `/staff/issues/${issue.id}`
        : `/citizen/issues/${issue.id}`;

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <button type="button" className="btn btn-secondary" onClick={() => navigate(detailsPath)}>
        Open page
      </button>
      {user.role === "citizen" ? (
        <button type="button" className="btn btn-secondary" onClick={() => toggleSaved(issue.id)}>
          {issue.saved ? "Unsave" : "Save"}
        </button>
      ) : null}
    </div>
  );
}

export default IssueActionMenu;