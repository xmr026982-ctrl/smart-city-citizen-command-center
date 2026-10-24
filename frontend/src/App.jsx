import { useEffect, useSyncExternalStore } from "react";
import { BrowserRouter } from "react-router-dom";
import AppRoutes from "./routes/AppRoutes";
import Sidebar from "./components/layout/Sidebar";
import { getRole, subscribeRole } from "./store/authStore";
import { applySettingsEffects } from "./store/settingsStore";
import "./styles/settings.css";

function App() {
  const role = useSyncExternalStore(subscribeRole, getRole);

  // re-apply saved settings (reduce motion, contrast, refresh rate) whenever the role changes
  useEffect(() => {
    if (role) applySettingsEffects();
  }, [role]);

  return (
    <BrowserRouter>
      <div className={role ? "app-shell" : "app-gate"}>
        {role ? <Sidebar /> : null}
        <AppRoutes />
      </div>
    </BrowserRouter>
  );
}

export default App;