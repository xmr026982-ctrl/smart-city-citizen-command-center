function IssueSLAIndicator({ issue }) {
  if (issue.status === "resolved") {
    return <span style={{ color: "var(--success)", fontSize: 12 }}>Closed</span>;
  }

  const used = Math.round((Date.now() - new Date(issue.createdAt).getTime()) / 36e5);
  const remaining = issue.slaHours - used;

  if (remaining < 0) {
    return (
      <span style={{ color: "var(--danger)", fontSize: 12 }}>
        {Math.abs(remaining)}h over SLA
      </span>
    );
  }

  return (
    <span style={{ color: remaining < issue.slaHours * 0.3 ? "var(--warning)" : "var(--muted)", fontSize: 12 }}>
      {remaining}h SLA left
    </span>
  );
}

export default IssueSLAIndicator;