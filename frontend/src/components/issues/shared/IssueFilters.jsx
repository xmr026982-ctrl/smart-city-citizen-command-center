import { ISSUE_STATUSES, STATUS_LABEL } from "../../../constants/issueStatuses";

function IssueFilters({ value, onChange }) {
  const items = ["all", ...ISSUE_STATUSES];

  return (
    <div className="filter-row">
      {items.map((item) => (
        <button
          key={item}
          type="button"
          className={`filter-pill${value === item ? " active" : ""}`}
          onClick={() => onChange(item)}
        >
          {item === "all" ? "All" : STATUS_LABEL[item]}
        </button>
      ))}
    </div>
  );
}

export default IssueFilters;