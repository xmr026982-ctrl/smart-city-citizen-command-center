import { createContext, useContext, useMemo, useState } from "react";

const ToastContext = createContext(null);

const stackStyle = {
  position: "fixed",
  top: 24,
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 9999,
  display: "grid",
  gap: 8,
  width: "min(420px, calc(100% - 32px))",
};

const itemStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "14px 18px",
  borderRadius: 999,
  border: "1px solid #abefc6",
  background: "#ecfdf3",
  color: "#067647",
  fontSize: 14,
  fontWeight: 650,
  boxShadow: "0 16px 40px rgba(6, 118, 71, 0.16)",
};

const closeStyle = {
  border: 0,
  background: "transparent",
  color: "#067647",
  fontSize: 20,
  lineHeight: 1,
  cursor: "pointer",
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const api = useMemo(
    () => ({
      toast(title) {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        setToasts((items) => [...items, { id, title }]);
        window.setTimeout(() => {
          setToasts((items) => items.filter((item) => item.id !== id));
        }, 3200);
      },
    }),
    []
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div style={stackStyle}>
        {toasts.map((item) => (
          <div key={item.id} style={itemStyle}>
            <span>{item.title}</span>
            <button
              type="button"
              style={closeStyle}
              onClick={() =>
                setToasts((items) => items.filter((toast) => toast.id !== item.id))
              }
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) {
    return { toast: (title) => window.alert(title) };
  }
  return value;
}