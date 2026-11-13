import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft, FileSearch } from "lucide-react";
import { Command, CommandHead, Empty } from "../../components/issues/admin/CommandKit";
import { useIssues } from "../../store/issueStore";

/* /admin/issues/:id (old full-page link). Admin issue files live in the
   Command Console drawer, so a known ID opens All Issues with that file
   open; an unknown ID gets a clear not-found page. */
function AdminIssueDetails() {
  const { id } = useParams();
  const issue = useIssues().find((item) => item.id === id);

  if (issue) return <Navigate to="/admin/queue" replace state={{ open: issue.id }} />;

  return (
    <Command>
      <CommandHead crumb="ISSUE FILE" title="Issue not found" sub={`No issue on the board has the ID ${id}.`} />
      <Empty icon={FileSearch} title="Nothing to show" sub="It may have been mistyped or removed." />
      <div><Link to="/admin/queue" className="ac-btn"><ArrowLeft size={14} /> Back to All Issues</Link></div>
    </Command>
  );
}

export default AdminIssueDetails;