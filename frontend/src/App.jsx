import { useEffect, useSyncExternalStore } from "react";
import { BrowserRouter } from "react-router-dom";
import AppRoutes from "./routes/AppRoutes";
import Sidebar from "./components/layout/Sidebar";
import TopBar from "./components/layout/TopBar";
import { ToastProvider } from "./components/ui/Toast";
import { UndoBar } from "./components/issues/shared/RemovalKit";
import FieldAlerts from "./components/layout/FieldAlerts";
import ServerNotice from "./components/layout/ServerNotice";
import "./services/issueSync"; // issues with the server, when one is set
import { LogoMark } from "./components/brand/Logo";
import { getRole, subscribeRole, verifySession, usePendingSession, retryVerify, logout } from "./store/authStore";
import { applySettingsEffects } from "./store/settingsStore";
import { startRealtime } from "./services/realtime";
import { startIdleGuard } from "./services/idleGuard";
import "./styles/settings.css";
import "./styles/shell-hud.css";
import "./styles/fit.css"; // every screen size, loaded last

function App() {
  const role = useSyncExternalStore(subscribeRole, getRole);

  const pending = usePendingSession(); // "" | "checking" | "error"

  // the server confirms a saved session before any desk opens; then the live connection follows it
  useEffect(() => {
    verifySession();
    startRealtime();
    startIdleGuard(); // Settings · "Sign out when I'm away"
  }, []);

  // re-apply saved settings (reduce motion, contrast, refresh rate) whenever the role changes
  useEffect(() => {
    if (role) applySettingsEffects();
  }, [role]);

  if (pending) return <SessionGate state={pending} />;

  return (
    <BrowserRouter>
      <ToastProvider>
        <div className={role ? `app-shell tone-${role}` : "app-public"}>
          {role ? <Sidebar /> : null}
          {role ? (
            /* the frame: one top bar for every page, the page below it */
            <div className="shell-main">
              <TopBar />
              <div className="shell-view"><AppRoutes /></div>
            </div>
          ) : (
            <AppRoutes />
          )}
          {role ? <UndoBar /> : null}
          {role ? <FieldAlerts /> : null}
          {role ? <ServerNotice /> : null}
        </div>
      </ToastProvider>
    </BrowserRouter>
  );
}

/* A saved session waits here for the server's answer: no desk, no data until then. */
function SessionGate({ state }) {
  return (
    <div className="session-gate" role="status" aria-live="polite">
      <div className="session-gate-card">
        <span className={`session-gate-plate${state === "error" ? " bad" : ""}`}>
          <LogoMark width={176} />
          <i className="session-gate-scan" aria-hidden />
        </span>
        <b>{state === "error" ? "Can't reach the server" : "Confirming your session"}</b>
        <small>{state === "error" ? "Your desk opens once the server answers." : "Checking your sign-in with the server."}</small>
        {state === "error" ? (
          <div className="session-gate-act">
            <button type="button" onClick={() => retryVerify()}>Try again</button>
            <button type="button" className="ghost" onClick={() => { logout(); window.location.assign("/login"); }}>Sign out</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default App;
