function Loader({ label = "Loading" }) {
  return (
    <div className="empty-state">
      <p className="mono">{label}…</p>
    </div>
  );
}

export default Loader;