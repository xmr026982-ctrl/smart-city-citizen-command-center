function Skeleton({ height = 16, width = "100%" }) {
  return (
    <div
      style={{
        height,
        width,
        borderRadius: 8,
        background: "var(--bg)",
        border: "1px solid var(--border)",
      }}
    />
  );
}

export default Skeleton;