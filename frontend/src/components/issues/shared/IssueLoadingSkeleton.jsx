function IssueLoadingSkeleton() {
  return (
    <div className="page-stack">
      {[1, 2, 3].map((item) => (
        <div
          key={item}
          className="panel"
          style={{ height: 120, background: "var(--bg)", borderColor: "var(--border)" }}
        />
      ))}
    </div>
  );
}

export default IssueLoadingSkeleton;