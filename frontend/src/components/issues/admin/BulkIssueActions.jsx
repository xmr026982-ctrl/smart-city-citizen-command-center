function BulkIssueActions({ selectedCount = 0 }) {
  return (
    <div className="panel" style={{ padding: 12, display: "flex", justifyContent: "space-between" }}>
      <span className="mono">{selectedCount} selected</span>
      <span style={{ color: "var(--muted)", fontSize: 13 }}>
        Bulk assign/status will connect with Person 6 APIs later.
      </span>
    </div>
  );
}

export default BulkIssueActions;