import { MoreHorizontal, Clock } from "lucide-react";

const statusMap = {
  online: { color: "#34d399", label: "Online", pulse: true },
  busy: { color: "#fbbf24", label: "Busy", pulse: false },
  offline: { color: "#cbd5e1", label: "Offline", pulse: false },
};

export default function StaffDirectory({ staff = [] }) {
  return (
    <div className="holo-surface holo-border" style={{ borderRadius: 18, overflow: "hidden" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 17 }}>Staff Directory</h3>
        <span style={{ fontSize: 11, color: "var(--subtle)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {staff.length} agents
        </span>
      </div>

      <div>
        {staff.map((s) => {
          const st = statusMap[s.status] || statusMap.offline;
          return (
            <div
              key={s.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "14px 20px",
                borderBottom: "1px solid var(--line)",
                transition: "background 180ms var(--ease)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(14,165,233,0.04)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <div style={{ position: "relative" }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #0ea5e9, #22d3ee)",
                    display: "grid",
                    placeItems: "center",
                    color: "white",
                    fontWeight: 600,
                    fontSize: 14,
                  }}
                >
                  {s.name.split(" ").map((n) => n[0]).join("")}
                </div>
                <span
                  style={{
                    position: "absolute",
                    bottom: 0,
                    right: 0,
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    background: st.color,
                    border: "2px solid white",
                    animation: st.pulse ? "neural-pulse 2s ease-in-out infinite" : "none",
                  }}
                />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 500, color: "var(--fg)" }}>{s.name}</p>
                <p style={{ fontSize: 12, color: "var(--subtle)" }}>{s.role} · {s.zone}</p>
              </div>

              <div style={{ display: "flex", gap: 24, fontSize: 13 }}>
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontWeight: 500 }}>{s.resolved}</p>
                  <p style={{ fontSize: 11, color: "var(--subtle)" }}>Resolved</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontWeight: 500, display: "flex", alignItems: "center", gap: 4 }}>
                    <Clock size={12} /> {s.avgTime}
                  </p>
                  <p style={{ fontSize: 11, color: "var(--subtle)" }}>Avg time</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontWeight: 500, color: "var(--primary)" }}>{s.rating}</p>
                  <p style={{ fontSize: 11, color: "var(--subtle)" }}>Rating</p>
                </div>
              </div>

              <button
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: "none",
                  background: "transparent",
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                  opacity: 0.5,
                }}
              >
                <MoreHorizontal size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}