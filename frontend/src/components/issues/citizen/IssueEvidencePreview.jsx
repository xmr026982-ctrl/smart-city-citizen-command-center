function IssueEvidencePreview({ files = [] }) {
  if (!files.length) {
    return <p style={{ color: "var(--muted)", fontSize: 14 }}>No evidence selected yet.</p>;
  }

  return (
    <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
      {files.map((file) => (
        <li key={file.id} className="mono">
          {file.name} · {file.sizeMb} MB
        </li>
      ))}
    </ul>
  );
}

export default IssueEvidencePreview;