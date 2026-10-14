function Modal({ open, title, children, onClose }) {
  if (!open) return null;

  return (
    <div className="drawer-overlay" style={{ display: "grid", placeItems: "center" }}>
      <div
        className="panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ width: "min(480px, calc(100% - 32px))", padding: 24 }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <h3>{title}</h3>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ width: 36, padding: 0 }}
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div style={{ marginTop: 16 }}>{children}</div>
      </div>
    </div>
  );
}

export default Modal;