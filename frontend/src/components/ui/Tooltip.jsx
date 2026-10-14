function Tooltip({ text, children }) {
  return (
    <span title={text} style={{ display: "inline-flex" }}>
      {children}
    </span>
  );
}

export default Tooltip;