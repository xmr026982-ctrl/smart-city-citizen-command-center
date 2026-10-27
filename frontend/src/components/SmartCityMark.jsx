import { Building2 } from "lucide-react";

function SmartCityMark() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 14,
          display: "grid",
          placeItems: "center",
          color: "white",
          background: "linear-gradient(145deg, #0ea5e9 0%, #0369a1 100%)",
          boxShadow: "0 10px 24px rgba(14,165,233,0.35)",
          position: "relative",
          flexShrink: 0,
        }}
      >
        <Building2 size={20} strokeWidth={1.8} />
      </div>
      <p
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 18,
          fontWeight: 750,
          letterSpacing: "-0.02em",
          lineHeight: 1,
          margin: 0,
        }}
      >
        Smart City
      </p>
    </div>
  );
}

export default SmartCityMark;  