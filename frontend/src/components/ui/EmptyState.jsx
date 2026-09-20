function EmptyState({ title = "Nothing here yet", description, action }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      {description ? <p style={{ marginTop: 8 }}>{description}</p> : null}
      {action ? <div style={{ marginTop: 16 }}>{action}</div> : null}
    </div>
  );
}

export default EmptyState;