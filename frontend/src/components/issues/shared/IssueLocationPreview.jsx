function IssueLocationPreview({ issue }) {
  if (!issue) return null;

  return (
    <div className="panel" style={{ padding: 16 }}>
      <p className="eyebrow">Location</p>
      <h3 style={{ marginTop: 8, fontSize: 16 }}>{issue.ward}</h3>
      <p style={{ marginTop: 6, color: "var(--muted)", fontSize: 14 }}>{issue.location}</p>
      {issue.lat && issue.lng ? (
        <p className="mono" style={{ marginTop: 10 }}>
          {issue.lat.toFixed(4)}, {issue.lng.toFixed(4)}
        </p>
      ) : (
        <p className="mono" style={{ marginTop: 10 }}>
          Coordinates pending Person 3 map module
        </p>
      )}
    </div>
  );
}

export default IssueLocationPreview;