import { createContext, useContext } from "react";
import { pushToast, useToasts } from "../../store/notificationStore";

const ToastContext = createContext({ toast: () => {} });

export function ToastProvider({ children }) {
  const items = useToasts();
  return (
    <ToastContext.Provider value={{ toast: pushToast }}>
      {children}
      <div className="toast-stack" style={{ position: "fixed", top: 72, left: 0, right: 0, display: "flex", justifyContent: "center", zIndex: 80, pointerEvents: "none" }}>
        {items[0] ? (
          <div className="success-box" style={{ pointerEvents: "auto" }}>
            {items[0].message}
          </div>
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}