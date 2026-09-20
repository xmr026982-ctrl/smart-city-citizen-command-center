import { ISSUE_STATUSES, STATUS_LABEL } from "../../../constants/issueStatuses";
import { formatDateTime } from "../../../utils/formatDate";

const COPY = {
  submitted: "Report received by command",
  acknowledged: "Reviewed and queued",
  in_progress: "Crew is working the site",
  resolved: "Verified closed",
};

function IssueStatusTimeline({ current, events = [] }) {
  const currentIndex = ISSUE_STATUSES.indexOf(current);

  return (
    <ol className="timeline">
      {ISSUE_STATUSES.map((step, index) => {
        const done = index <= currentIndex;
        const active = index === currentIndex;
        const event = [...events].reverse().find((item) => item.status === step);

        return (
          <li key={step} className="timeline-row">
            <div className="timeline-rail">
              <span className={`timeline-dot${done ? (active ? " current" : " done") : ""}`} />
              {index < ISSUE_STATUSES.length - 1 ? <span className="timeline-line" /> : null}
            </div>
            <div style={{ paddingBottom: 24 }}>
              <strong style={{ color: active ? "var(--info)" : done ? "var(--fg)" : "var(--subtle)" }}>
                {STATUS_LABEL[step]}
              </strong>
              <p style={{ marginTop: 4, fontSize: 13, color: "var(--muted)" }}>
                {event?.note || COPY[step]}
              </p>
              {event ? (
                <p className="mono" style={{ marginTop: 4 }}>
                  {formatDateTime(event.at)} · {event.by}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default IssueStatusTimeline;