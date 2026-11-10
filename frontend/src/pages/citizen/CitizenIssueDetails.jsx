import { Navigate, useParams } from "react-router-dom";
import { useAuth } from "../../store/authStore";
import { useIssues } from "../../store/issueStore";
import { isReporter, isFollowing, isSupporter } from "../../services/citizenService";

/* Old /citizen/issues/:id links. The report is a drawer now: your own
   report opens on My Reports, a followed or joined one on Saved. Anything else
   lands on My Reports and the drawer shows it isn't yours (no details). */
function CitizenIssueDetails() {
  const { id } = useParams();
  const user = useAuth();
  const issue = useIssues().find((item) => item.id === id);
  if (issue && !isReporter(issue, user) && (isFollowing(issue, user) || isSupporter(issue, user))) {
    return <Navigate to="/citizen/saved" replace state={{ open: issue.id }} />;
  }
  return <Navigate to="/citizen/my-reports" replace state={issue ? { open: issue.id } : null} />;
}

export default CitizenIssueDetails;