import { ISSUE_STATUSES, STATUS_LABEL, publicStatus } from "../../../constants/issueStatuses";
import { formatDateTime } from "../../../utils/formatDate";

const COPY = {
  submitted: "Report received by command",
  acknowledged: "Reviewed and queued",
  in_progress: "Crew is working the site",
  pending_review: "Field requested close. Waiting on Admin confirm",
  resolved: "Verified closed by command",
};

function IssueStatusTimeline({ current, events = [], citizen = false }) {
  const steps = citizen
    ? ISSUE_STATUSES.filter((step) => step !== "pending_review")
    : ISSUE_STATUSES;
  const visibleCurrent = citizen ? publicStatus(current) : current;
  const currentIndex = steps.indexOf(visibleCurrent);

  return (
    <ol className="timeline">
      {steps.map((step, index) => {
        const done = index <= currentIndex;
        const active = index === currentIndex;
        const event = [...events].reverse().find((item) => {
          if (citizen && item.status === "pending_review") return false;
          return item.status === step;
        });

        return (
          <li key={step} className="timeline-row">
            <div className="timeline-rail">
              <span className={`timeline-dot${done ? (active ? " current" : " done") : ""}`} />
              {index < steps.length - 1 ? <span className="timeline-line" /> : null}
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