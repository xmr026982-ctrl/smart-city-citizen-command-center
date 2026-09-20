import PageHeader from "../../components/layout/PageHeader";
import { ROLE_LABEL } from "../../constants/userRoles";
import { formatDateTime } from "../../utils/formatDate";
import { useAudit } from "../../store/issueStore";

function IssueAuditLogs() {
  const audit = useAudit();

  return (
    <main className="page-stack">
      <PageHeader
        eyebrow="Audit log"
        title="Command history"
        description="Status moves and assignments. Ready for Person 6 real-time feed later."
      />
      <ol style={{ display: "grid", gap: 12, padding: 0, margin: 0, listStyle: "none" }}>
        {audit.map((event) => (
          <li key={event.id} className="panel" style={{ padding: 16 }}>
            <p style={{ fontWeight: 600 }}>{event.action}</p>
            <p className="mono" style={{ marginTop: 6 }}>
              {formatDateTime(event.at)} · {event.actor} · {ROLE_LABEL[event.role]}
              {event.issueId ? ` · ${event.issueId}` : ""}
            </p>
          </li>
        ))}
      </ol>
    </main>
  );
}

export default IssueAuditLogs;