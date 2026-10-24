function StatCard({ label, value, hint }) {
  return (
    <article className="stat-card">
      <p className="eyebrow">{label}</p>
      <strong>{value}</strong>
      {hint ? <p style={{ marginTop: 8 }}>{hint}</p> : null}
    </article>
  );
}

export default StatCard;