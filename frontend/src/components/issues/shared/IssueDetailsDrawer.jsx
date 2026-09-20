import { X } from "lucide-react";
import IssueDetails from "./IssueDetails";

function IssueDetailsDrawer({ issue, onClose }) {
  if (!issue) return null;

  return (
    <>
      <button type="button" className="drawer-overlay" aria-label="Close details" onClick={onClose} />
      <aside className="issue-drawer">
        <div className="issue-drawer-header">
          <p className="mono">Issue record</p>
          <button type="button" className="btn btn-secondary" style={{ width: 36, padding: 0 }} onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="issue-drawer-body">
          <IssueDetails issue={issue} />
        </div>
      </aside>
    </>
  );
}

export default IssueDetailsDrawer;