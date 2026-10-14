import { formatDateTime } from "../../../utils/formatDate";
import { ROLE_LABEL } from "../../../constants/userRoles";
import { useAudit } from "../../../store/issueStore";

function IssueActivityFeed({ issueId, limit = 8 }) {
  const events = useAudit()
    .filter((event) => !issueId || event.issueId === issueId)
    .slice(0, limit);

  if (!events.length) {
    return <p style={{ color: "var(--muted)", fontSize: 14 }}>No activity yet.</p>;
  }

  return (
    <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 10 }}>
      {events.map((event) => (
        <li key={event.id} className="panel" style={{ padding: 12 }}>
          <p style={{ fontSize: 14, fontWeight: 600 }}>{event.action}</p>
          <p className="mono" style={{ marginTop: 4 }}>
            {formatDateTime(event.at)} · {event.actor} · {ROLE_LABEL[event.role]}
          </p>
        </li>
      ))}
    </ol>
  );
}

export default IssueActivityFeed;