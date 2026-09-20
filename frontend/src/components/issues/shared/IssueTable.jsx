import { CATEGORY_LABEL } from "../../../constants/issueCategories";
import { formatDate } from "../../../utils/formatDate";
import IssuePriorityBadge from "./IssuePriorityBadge";
import IssueSLAIndicator from "./IssueSLAIndicator";
import IssueStatusBadge from "./IssueStatusBadge";

function IssueTable({ issues, onSelect }) {
  return (
    <div className="table-wrap">
      <table className="issue-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Title</th>
            <th>Ward</th>
            <th>Category</th>
            <th>Status</th>
            <th>Priority</th>
            <th>Assignee</th>
            <th>SLA</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          {issues.map((issue) => (
            <tr key={issue.id} onClick={() => onSelect(issue)}>
              <td className="mono">{issue.id}</td>
              <td>{issue.title}</td>
              <td>{issue.ward}</td>
              <td>{CATEGORY_LABEL[issue.category]}</td>
              <td>
                <IssueStatusBadge status={issue.status} />
              </td>
              <td>
                <IssuePriorityBadge priority={issue.priority} />
              </td>
              <td>{issue.assignedTo || "—"}</td>
              <td>
                <IssueSLAIndicator issue={issue} />
              </td>
              <td className="mono">{formatDate(issue.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default IssueTable;