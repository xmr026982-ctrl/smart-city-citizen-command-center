import { useEffect, useRef, useState } from "react";

function Dropdown({ label, children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const close = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" className="btn btn-secondary" onClick={() => setOpen((value) => !value)}>
        {label}
      </button>
      {open ? (
        <div
          className="panel"
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 8px)",
            minWidth: 180,
            padding: 8,
            zIndex: 30,
          }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

export default Dropdown;