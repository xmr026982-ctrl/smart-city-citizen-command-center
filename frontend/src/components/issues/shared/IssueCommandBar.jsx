import IssueFilters from "./IssueFilters";
import IssueSearch from "./IssueSearch";

function IssueCommandBar({ query, onQuery, status, onStatus, actions }) {
  return (
    <div className="page-stack">
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <IssueSearch value={query} onChange={onQuery} />
        </div>
        {actions}
      </div>
      <IssueFilters value={status} onChange={onStatus} />
    </div>
  );
}

export default IssueCommandBar;