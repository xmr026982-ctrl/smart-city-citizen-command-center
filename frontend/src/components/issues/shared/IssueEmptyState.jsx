function IssueEmptyState({ title = "No issues found", description = "Try another filter." }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p style={{ marginTop: 8 }}>{description}</p>
    </div>
  );
}

export default IssueEmptyState;