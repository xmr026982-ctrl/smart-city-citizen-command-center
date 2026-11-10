import { AlertTriangle, X } from "lucide-react";
import { useNotice, dismissNotice } from "../../services/notice";

/* The server's "no" to a change no page is waiting for (services/notice.js). */
function ServerNotice() {
  const n = useNotice();
  if (!n) return null;
  return (
    <div className="srv-note" role="alert" key={n.at}>
      <AlertTriangle size={15} aria-hidden />
      <span>{n.text}</span>
      <button type="button" onClick={dismissNotice} aria-label="Dismiss"><X size={14} /></button>
    </div>
  );
}

export default ServerNotice;
