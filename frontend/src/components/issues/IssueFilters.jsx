function IssueFilters({ activeFilter, onFilterChange }) {
  const filters = ["All", "Submitted", "Acknowledged", "In Progress", "Resolved"];

  return (
    <div className="issue-filters">
      {filters.map((filter) => (
        <button
          key={filter}
          type="button"
          className={`issue-filter-btn ${activeFilter === filter ? "active" : ""}`}
          onClick={() => onFilterChange(filter)}
        >
          {filter}
        </button>
      ))}
    </div>
  );
}

export default IssueFilters;