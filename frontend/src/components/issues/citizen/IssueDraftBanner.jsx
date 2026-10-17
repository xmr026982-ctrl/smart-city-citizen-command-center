function IssueDraftBanner({ visible, onRestore, onDiscard }) {
  if (!visible) return null;

  return (
    <div className="panel" style={{ padding: 16, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
      <div>
        <strong>Unfinished report found</strong>
        <p style={{ marginTop: 4, color: "var(--muted)", fontSize: 14 }}>
          Restore your last draft or start a new report.
        </p>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="btn btn-secondary" onClick={onDiscard}>
          Discard
        </button>
        <button type="button" className="btn btn-primary" onClick={onRestore}>
          Restore
        </button>
      </div>
    </div>
  );
}

export default IssueDraftBanner;