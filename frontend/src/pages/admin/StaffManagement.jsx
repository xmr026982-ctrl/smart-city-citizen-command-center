import { useMemo, useState } from "react";
import { Search, User, Activity, Shield } from "lucide-react";
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

  return (
    <main className="page-wrap">
      <PageHeader
        eyebrow="Personnel · Neural Roster"
        title="Staff Management"
        description="Open a specialist file. Review load, performance, and promote by contribution."
      />

      <div style={{ position: "relative", margin: "24px 0 16px", maxWidth: 420 }}>
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
        {rows.map((row) => (
          <button
            key={row.name}
            onClick={() => setSelected(row.name)}
            style={{
              textAlign: "left",
              borderRadius: 16,
              padding: "16px 18px",
              background: "rgba(255,255,255,0.78)",
              backdropFilter: "blur(14px)",
              border: "1px solid rgba(14,165,233,0.12)",
              boxShadow: "0 8px 28px rgba(14,165,233,0.06)",
              cursor: "pointer",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 42, height: 42, borderRadius: 12,
                background: "rgba(14,165,233,0.12)",
                display: "grid", placeItems: "center",
              }}>
                <User size={18} color="var(--primary)" />
              </div>
              <div>
                <p style={{ fontWeight: 650, fontSize: 15 }}>{row.name}</p>
                <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>{row.title}</p>
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
        ))}
      </div>

      <StaffDetailsDrawer
        staff={selected}
        issues={issues}
        audit={audit}
        onClose={() => setSelected(null)}
      />
    </main>
  );
}

export default StaffManagement;