import { formatDateTime } from "../../../utils/formatDate";
import { useAudit } from "../../../store/issueStore";

function IssueAuditLog() {
  const audit = useAudit();

  return (
    <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 10 }}>
      {audit.map((event) => (
        <li key={event.id} className="panel" style={{ padding: 12 }}>
          <p style={{ fontWeight: 600 }}>{event.action}</p>
          <p className="mono" style={{ marginTop: 4 }}>
            {formatDateTime(event.at)} · {event.actor}
          </p>
        </li>
      ))}
    </ol>
  );
}

export default IssueAuditLog;