export default function StaffPerformanceCard({ staff }) {
  const pct = Math.min(100, (staff.resolved / 220) * 100);

  return (
    <div className="holo-surface holo-border holo-glow" style={{ borderRadius: 18, padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <p style={{ fontWeight: 500, color: "var(--fg)" }}>{staff.name}</p>
          <p style={{ fontSize: 12, color: "var(--subtle)" }}>{staff.zone}</p>
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            padding: "3px 8px",
            borderRadius: 999,
            background: "var(--info-soft)",
            color: "var(--primary-deep)",
          }}
        >
          {staff.rating} ★
        </span>
      </div>

      <div style={{ height: 6, borderRadius: 999, background: "#e2e8f0", overflow: "hidden", marginBottom: 8 }}>
        <div
          style={{
            height: "100%",
            borderRadius: 999,
            background: "linear-gradient(90deg, #0ea5e9, #22d3ee)",
            width: `${pct}%`,
            transition: "width 700ms var(--ease)",
          }}
        />
      </div>
      <p style={{ fontSize: 12, color: "var(--subtle)" }}>
        {staff.resolved} resolved · {staff.avgTime} avg
      </p>
    </div>
  );
}