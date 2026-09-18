function IssueStatusTimeline({ currentStatus }) {
  const steps = [
    { key: "Submitted", label: "Submitted", description: "Your report was received" },
    { key: "Acknowledged", label: "Acknowledged", description: "Team has reviewed the issue" },
    { key: "In Progress", label: "In Progress", description: "Work has started on site" },
    { key: "Resolved", label: "Resolved", description: "Issue has been fixed" },
  ];

  const currentIndex = steps.findIndex((s) => s.key === currentStatus);

  return (
    <div className="issue-timeline">
      {steps.map((step, index) => {
        const isCompleted = index <= currentIndex;
        const isCurrent = index === currentIndex;

        return (
          <div
            key={step.key}
            className={`issue-timeline-step ${isCompleted ? "completed" : ""} ${isCurrent ? "current" : ""}`}
          >
            <div className="issue-timeline-marker">
              <div className="issue-timeline-dot"></div>
              {index < steps.length - 1 && <div className="issue-timeline-line"></div>}
            </div>

            <div className="issue-timeline-content">
              <h4>{step.label}</h4>
              <p>{step.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default IssueStatusTimeline;