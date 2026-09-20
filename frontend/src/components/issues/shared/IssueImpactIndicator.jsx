const RANK = { low: 1, medium: 2, high: 3, critical: 4 };

function IssueImpactIndicator({ issue }) {
  const rank = RANK[issue?.priority] || 1;

  return (
    <div>
      <p className="eyebrow">Impact</p>
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        {[1, 2, 3, 4].map((level) => (
          <span
            key={level}
            style={{
              width: 28,
              height: 8,
              borderRadius: 999,
              background: level <= rank ? "var(--primary)" : "var(--border)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default IssueImpactIndicator;