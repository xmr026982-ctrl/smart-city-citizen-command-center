function ProgressBar({ value = 0, max = 100 }) {
  const width = max ? Math.min(100, Math.round((value / max) * 100)) : 0;

  return (
    <div style={{ height: 10, background: "var(--bg)", borderRadius: 999, overflow: "hidden" }}>
      <div
        style={{
          width: `${width}%`,
          height: "100%",
          background: "var(--primary)",
          transition: "width 200ms var(--ease)",
        }}
      />
    </div>
  );
}

export default ProgressBar;