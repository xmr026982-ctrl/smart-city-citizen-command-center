import IssuePriorityBadge from "../../components/issues/shared/IssuePriorityBadge";
import IssueStatusBadge from "../../components/issues/shared/IssueStatusBadge";
import PageHeader from "../../components/layout/PageHeader";
import { Select } from "../../components/ui/Input";
import { STAFF_ROSTER } from "../../constants/issueConstants";
import { useAuth } from "../../store/authStore";
import { assignIssue, useIssues } from "../../store/issueStore";

function ManageAssignments() {
  const user = useAuth();
  const issues = useIssues().filter((issue) => issue.status !== "resolved");

  return (
    <main className="page-stack">
      <PageHeader
        eyebrow="Assign issues"
        title="Dispatch board"
        description="Only command admin can route tickets to field staff. First assignment also acknowledges the report."
      />
      <div style={{ display: "grid", gap: 12 }}>
        {issues.map((issue) => (
          <article
            key={issue.id}
            className="panel"
            style={{
              padding: 16,
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div>
              <p className="mono">{issue.id}</p>
              <h3 style={{ marginTop: 4, fontSize: 16 }}>{issue.title}</h3>
              <p style={{ marginTop: 4, color: "var(--muted)", fontSize: 14 }}>
                {issue.ward} · {issue.location}
              </p>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <IssueStatusBadge status={issue.status} />
                <IssuePriorityBadge priority={issue.priority} />
              </div>
            </div>
            <Select
              value={issue.assignedTo || ""}
              onChange={(e) => assignIssue(issue.id, e.target.value, user.name, user.role)}
              style={{ maxWidth: 240 }}
            >
              <option value="">Unassigned</option>
              {STAFF_ROSTER.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Select>
          </article>
        ))}
      </div>
    </main>
  );
}

export default ManageAssignments;