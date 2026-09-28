import { useMemo, useState } from "react";
import { Search, User, Activity, Shield, Layers, Zap } from "lucide-react";
import PageHeader from "../../components/layout/PageHeader";
import StaffDetailsDrawer from "../../components/issues/admin/StaffDetailsDrawer";
import { STAFF_ROSTER } from "../../constants/issueConstants";
import { useIssues, useAudit } from "../../store/issueStore";
import { useStaffTitles, getStaffTitle } from "../../store/staffTitleStore";

function StaffManagement() {
  const issues = useIssues();
  const audit = useAudit();
  const titles = useStaffTitles();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);

  const rows = useMemo(() => {
    return STAFF_ROSTER
      .filter((name) => name.toLowerCase().includes(query.toLowerCase()))
      .map((name) => {
        const assigned = issues.filter((i) => i.assignedTo === name);
        return {
          name,
          title: titles[name] || getStaffTitle(name),
          assigned: assigned.length,
          open: assigned.filter((i) => i.status !== "resolved").length,
          resolved: assigned.filter((i) => i.status === "resolved").length,
        };
      });
  }, [issues, titles, query]);

  const stats = {
    force: STAFF_ROSTER.length,
    active: rows.filter((r) => r.open > 0).length,
    resolved: rows.reduce((sum, r) => sum + r.resolved, 0),
    load: rows.reduce((sum, r) => sum + r.assigned, 0),
  };

  return (
    <main className="page-wrap">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <PageHeader
          eyebrow="Personnel · Neural Roster"
          title="Staff Management"
          description="Open a specialist file. Review load, performance, and promote by contribution."
        />
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "7px 14px", borderRadius: 999,
          background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)",
          fontSize: 12.5, fontWeight: 600, color: "#059669",
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%", background: "#10b981",
            boxShadow: "0 0 0 3px rgba(16,185,129,0.25)", animation: "livePulse 1.8s ease infinite",
          }} />
          Roster Live
        </div>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: 12,
        margin: "24px 0 20px",
      }}>
        <GlassStat icon={Layers} label="Force Size" value={stats.force} color="#0ea5e9" />
        <GlassStat icon={Zap} label="On Assignment" value={stats.active} color="#f59e0b" />
        <GlassStat icon={Activity} label="Active Load" value={stats.load} color="#8b5cf6" />
        <GlassStat icon={Shield} label="Resolved" value={stats.resolved} color="#10b981" />
      </div>

      <div style={{ position: "relative", marginBottom: 16, maxWidth: 420 }}>
        <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--subtle)" }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search staff…"
          style={{
            width: "100%", height: 42, paddingLeft: 38, paddingRight: 14,
            borderRadius: 12, border: "1px solid var(--line)",
            background: "rgba(255,255,255,0.92)", fontSize: 13.5, outline: "none",
          }}
        />
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {rows.map((row) => {
          const loadPct = Math.min(100, row.assigned * 34);
          return (
            <button
              key={row.name}
              onClick={() => setSelected(row.name)}
              style={{
                textAlign: "left",
                borderRadius: 18,
                padding: "16px 18px",
                background: "rgba(255,255,255,0.74)",
                backdropFilter: "blur(16px) saturate(1.4)",
                border: "1px solid rgba(255,255,255,0.75)",
                boxShadow: "0 8px 28px rgba(14,165,233,0.07), inset 0 1px 0 rgba(255,255,255,0.85)",
                cursor: "pointer",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 16,
                position: "relative",
                overflow: "hidden",
                transform: "perspective(900px) rotateX(2deg)",
                transition: "transform 220ms, box-shadow 220ms",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "perspective(900px) rotateX(0deg) translateY(-4px)";
                e.currentTarget.style.boxShadow = "0 18px 40px rgba(14,165,233,0.16), inset 0 1px 0 rgba(255,255,255,0.9)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "perspective(900px) rotateX(2deg)";
                e.currentTarget.style.boxShadow = "0 8px 28px rgba(14,165,233,0.07), inset 0 1px 0 rgba(255,255,255,0.85)";
              }}
            >
              <div style={{
                position: "absolute", top: 0, left: 0, right: 0, height: 2,
                background: "linear-gradient(90deg, transparent, rgba(14,165,233,0.55), transparent)",
              }} />
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: "rgba(14,165,233,0.12)",
                  display: "grid", placeItems: "center",
                  boxShadow: "0 0 0 1px rgba(14,165,233,0.16)",
                }}>
                  <User size={18} color="var(--primary)" />
                </div>
                <div>
                  <p style={{ fontWeight: 650, fontSize: 15 }}>{row.name}</p>
                  <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>{row.title}</p>
                  <div style={{
                    marginTop: 8, width: 160, height: 5, borderRadius: 999,
                    background: "rgba(14,165,233,0.1)", overflow: "hidden",
                  }}>
                    <div style={{
                      width: `${loadPct}%`, height: "100%",
                      background: "linear-gradient(90deg, #0ea5e9, #22d3ee)",
                    }} />
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 16, fontSize: 12.5, color: "var(--muted)" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <Activity size={13} /> {row.open} open
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <Shield size={13} /> {row.resolved} resolved
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <StaffDetailsDrawer
        staff={selected}
        issues={issues}
        audit={audit}
        onClose={() => setSelected(null)}
      />

      <style>{`
        @keyframes livePulse {
          0%, 100% { box-shadow: 0 0 0 3px rgba(16,185,129,0.25); }
          50% { box-shadow: 0 0 0 6px rgba(16,185,129,0.1); }
        }
      `}</style>
    </main>
  );
}

function GlassStat({ icon: Icon, label, value, color }) {
  return (
    <div
      style={{
        borderRadius: 16,
        padding: "14px 16px",
        background: "rgba(255,255,255,0.75)",
        backdropFilter: "blur(16px) saturate(1.4)",
        border: "1px solid rgba(255,255,255,0.8)",
        boxShadow: "0 8px 28px rgba(14,165,233,0.07), inset 0 1px 0 rgba(255,255,255,0.85)",
        transform: "perspective(900px) rotateX(2deg)",
        transition: "transform 220ms, box-shadow 220ms",
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "perspective(900px) rotateX(0deg) translateY(-4px)";
        e.currentTarget.style.boxShadow = `0 18px 40px ${color}25, inset 0 1px 0 rgba(255,255,255,0.9)`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "perspective(900px) rotateX(2deg)";
        e.currentTarget.style.boxShadow = "0 8px 28px rgba(14,165,233,0.07), inset 0 1px 0 rgba(255,255,255,0.85)";
      }}
    >
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, transparent, ${color}55, transparent)`,
      }} />
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `${color}18`, display: "grid", placeItems: "center",
        }}>
          <Icon size={16} color={color} />
        </div>
        <div>
          <p style={{ fontSize: 11, color: "var(--subtle)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
          <p style={{ fontSize: 20, fontWeight: 700, fontFamily: "var(--font-display)" }}>{value}</p>
        </div>
      </div>
    </div>
  );
}

export default StaffManagement;