function IssueStatsCards({ issues }) {
  const cards = [
    { label: "Open", value: issues.filter((i) => i.status !== "resolved").length },
    { label: "In progress", value: issues.filter((i) => i.status === "in_progress").length },
    { label: "Unassigned", value: issues.filter((i) => !i.assignedTo).length },
    { label: "Resolved", value: issues.filter((i) => i.status === "resolved").length },
  ];

  return (
    <div className="stats-grid">
      {cards.map((card) => (
        <article key={card.label} className="stat-card">
          <p className="eyebrow">{card.label}</p>
          <strong>{card.value}</strong>
        </article>
      ))}
    </div>
  );
}

export default IssueStatsCards;