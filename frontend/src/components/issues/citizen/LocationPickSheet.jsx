import { createPortal } from "react-dom";
import { LocateFixed, MapPinned, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { WARDS } from "../../../constants/issueConstants";

function LocationPickSheet({ zone, onClose }) {
  const navigate = useNavigate();
  if (!zone) return null;

  const place = WARDS.find((item) => item.name === zone);
  const openMap = () => {
    const params = new URLSearchParams({
      zone,
      pick: "1",
      return: "/citizen/report",
    });
    if (place) {
      params.set("lat", String(place.lat));
      params.set("lng", String(place.lng));
    }
    navigate(`/map?${params.toString()}`);
  };

  return createPortal(
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(8, 15, 28, 0.52)",
          backdropFilter: "blur(14px)",
          zIndex: 90,
          animation: "fadeIn 0.22s ease",
        }}
      />
      <aside
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          width: "min(540px, 100vw)",
          height: "100dvh",
          zIndex: 100,
          display: "flex",
          flexDirection: "column",
          background: "rgba(255, 255, 255, 0.78)",
          backdropFilter: "blur(28px) saturate(1.7)",
          borderLeft: "1px solid rgba(14, 165, 233, 0.25)",
          boxShadow: "-32px 0 90px rgba(14, 165, 233, 0.14)",
          animation: "slideInCyborg 0.36s cubic-bezier(0.22, 1, 0.36, 1)",
          overflow: "hidden",
        }}
      >
        <div style={{
          height: 3,
          background: "linear-gradient(90deg, transparent, #0ea5e9 15%, #22d3ee 50%, #0ea5e9 85%, transparent)",
        }} />
        <div style={{
          padding: "15px 22px",
          borderBottom: "1px solid rgba(14,165,233,0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "rgba(14,165,233,0.04)",
        }}>
          <div>
            <p style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--primary)", marginBottom: 3 }}>
              Zone lock · Map pick
            </p>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 600 }}>{zone}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{
            width: 38, height: 38, borderRadius: 11,
            border: "1px solid var(--line)", background: "rgba(255,255,255,0.85)",
            display: "grid", placeItems: "center", cursor: "pointer",
          }}>
            <X size={17} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 22 }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 720, lineHeight: 1.2, margin: 0 }}>
            Drop the point inside {zone}
          </h2>
          <p style={{ marginTop: 10, color: "var(--muted)", lineHeight: 1.6 }}>
            Zoom and pan the city map. Search inside this zone, then click the exact point. The place name, latitude, and longitude return to this report.
          </p>
          <div style={{
            marginTop: 14, display: "inline-flex", alignItems: "center", gap: 8,
            padding: "7px 12px", borderRadius: 999, background: "rgba(14,165,233,0.1)",
            color: "var(--primary-deep)", fontSize: 12.5, fontWeight: 650,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#0ea5e9", boxShadow: "0 0 0 3px rgba(14,165,233,0.25)", animation: "livePulse 1.8s ease infinite" }} />
            Map pick armed
          </div>

          <div style={{
            marginTop: 22,
            borderRadius: 18,
            overflow: "hidden",
            background: "rgba(255,255,255,0.62)",
            border: "1px solid rgba(14,165,233,0.16)",
            boxShadow: "0 10px 28px rgba(14,165,233,0.08), inset 0 1px 0 rgba(255,255,255,0.85)",
          }}>
            <div style={{
              position: "relative",
              height: 210,
              background: "radial-gradient(circle at 30% 40%, rgba(14,165,233,0.15), transparent 50%), radial-gradient(circle at 70% 60%, rgba(34,211,238,0.1), transparent 45%), linear-gradient(180deg, #e0f2fe 0%, #f0f9ff 100%)",
              overflow: "hidden",
            }}>
              <div style={{
                position: "absolute", inset: 0,
                backgroundImage: "linear-gradient(rgba(14,165,233,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(14,165,233,0.08) 1px, transparent 1px)",
                backgroundSize: "28px 28px",
              }} />
              <div style={{ position: "absolute", left: "58%", top: "46%", width: 70, height: 70, border: "1.5px solid rgba(14,165,233,0.35)", borderRadius: "50%", transform: "translate(-50%, -50%)", animation: "pulseRing 2.8s ease-out infinite" }} />
              <div style={{ position: "absolute", left: "58%", top: "46%", width: 110, height: 110, border: "1px solid rgba(14,165,233,0.18)", borderRadius: "50%", transform: "translate(-50%, -50%)", animation: "pulseRing 2.8s ease-out infinite 0.6s" }} />
              <div style={{
                position: "absolute", left: "58%", top: "46%", transform: "translate(-50%, -50%)",
                width: 32, height: 32, borderRadius: "50%",
                background: "linear-gradient(135deg, #0ea5e9, #22d3ee)",
                display: "grid", placeItems: "center", color: "white",
                boxShadow: "0 4px 16px rgba(14,165,233,0.5)", zIndex: 2,
              }}>
                <LocateFixed size={15} />
              </div>
              <div style={{ position: "absolute", left: 0, right: 0, height: 2, background: "linear-gradient(90deg, transparent, rgba(34,211,238,0.6), transparent)", animation: "scanLine 3.5s linear infinite" }} />
            </div>
            <div style={{ padding: "14px 16px 16px" }}>
              <p style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 2 }}>{zone} zone frame</p>
              <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
                {place ? <span style={{ fontFamily: "var(--font-mono)" }}>{place.lat.toFixed(5)}, {place.lng.toFixed(5)}</span> : "Zone centre"}
              </p>
              <button type="button" onClick={openMap} style={{
                width: "100%", height: 42, border: "none", borderRadius: 11, cursor: "pointer",
                background: "linear-gradient(135deg, #0ea5e9, #0284c7)", color: "white",
                fontSize: 13.5, fontWeight: 650, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: "0 8px 20px rgba(14,165,233,0.3)",
              }}>
                <MapPinned size={15} /> Open {zone} map
              </button>
            </div>
          </div>
        </div>
      </aside>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideInCyborg { from { transform: translateX(110%); opacity: 0.4; } to { transform: none; opacity: 1; } }
        @keyframes pulseRing { 0% { transform: translate(-50%, -50%) scale(0.7); opacity: 0.8; } 100% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; } }
        @keyframes scanLine { 0% { top: 0; } 100% { top: 100%; } }
        @keyframes livePulse { 50% { box-shadow: 0 0 0 6px rgba(14,165,233,0.1); } }
      `}</style>
    </>,
    document.body
  );
}

export default LocationPickSheet;