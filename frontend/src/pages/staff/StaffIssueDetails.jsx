import { Navigate, useParams } from "react-router-dom";
import { useAuth } from "../../store/authStore";
import { useIssues } from "../../store/issueStore";

/* Old /staff/issues/:id links. The issue file is a drawer now: an issue on
   you opens locked on Assigned Work, anything else opens on City Intake. */
function StaffIssueDetails() {
  const { id } = useParams();
  const user = useAuth();
  const issue = useIssues().find((item) => item.id === id);
  const userIds = [user?.serverId, user?._id, user?.id]
  .filter(Boolean)
  .map(String);

const isAssigned =
  issue &&
  (
    (issue.assignedToId && userIds.includes(String(issue.assignedToId))) ||
    (
      !issue.assignedToId &&
      String(issue.assignedTo || "").trim().toLowerCase() ===
        String(user?.displayName || user?.name || "").trim().toLowerCase()
    )
  );

if (isAssigned) {
    return <Navigate to="/staff/assigned" replace state={{ target: issue.id }} />;
  }
  return <Navigate to="/staff/queue" replace state={issue ? { open: issue.id } : null} />;
}

export default StaffIssueDetails;