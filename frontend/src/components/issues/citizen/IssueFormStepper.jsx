const STEPS = ["Describe", "Locate", "Evidence"];

function IssueFormStepper({ step = 0 }) {
  return (
    <ol style={{ display: "flex", gap: 12, padding: 0, margin: 0, listStyle: "none" }}>
      {STEPS.map((label, index) => (
        <li
          key={label}
          className="badge"
          style={{
            background: index <= step ? "var(--primary)" : "var(--bg)",
            color: index <= step ? "var(--primary-fg)" : "var(--muted)",
          }}
        >
          {index + 1}. {label}
        </li>
      ))}
    </ol>
  );
}

export default IssueFormStepper;