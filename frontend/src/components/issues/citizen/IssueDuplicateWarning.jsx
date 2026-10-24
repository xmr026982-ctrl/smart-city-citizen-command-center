function IssueDuplicateWarning({ matches = [] }) {
  if (!matches.length) return null;

  return (
    <div className="field-error">
      Similar reports already exist in this ward. Review them before filing a duplicate.
      <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
        {matches.map((issue) => (
          <li key={issue.id}>
            {issue.id} — {issue.title}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default IssueDuplicateWarning;