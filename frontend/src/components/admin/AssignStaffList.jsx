import { preferredFor, expertiseLabel, matchesExpertise } from "../../store/staffDeskStore";

function AssignStaffList({ category, value, onChange }) {
  const list = preferredFor(category);

  return (
    <div className="as-list">
      {list.map((p) => {
        const fit = matchesExpertise(p.expertise, category);
        return (
          <button
            key={p.id}
            type="button"
            className={`as-row ${value === p.id ? "on" : ""} ${fit ? "fit" : ""}`}
            onClick={() => onChange(p)}
          >
            <span>
              <strong>{p.name}</strong>
              <em>{expertiseLabel(p.expertise)} · {p.rank}</em>
            </span>
            <i>{fit ? "Preferred" : "Other skill"}</i>
          </button>
        );
      })}
    </div>
  );
}

export default AssignStaffList;