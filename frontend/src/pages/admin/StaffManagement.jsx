import { useState, useMemo } from "react";
import {
  Users, UserPlus, Activity, ShieldCheck, Search,
  ArrowUpDown, ChevronLeft, ChevronRight, Zap, MapPin
} from "lucide-react";
import PageHeader from "../../components/layout/PageHeader";
import { STAFF_ROSTER } from "../../constants/issueConstants";

// Real staff with rich meta
const STAFF_DATA = STAFF_ROSTER.map((name, i) => {
  const meta = [
    { role: "Field Specialist", zone: "Sector 7",  status: "online",  resolved: 142, avgTime: "1.8h", rating: 4.9, load: 3 },
    { role: "Senior Resolver",  zone: "Sector 3",  status: "busy",    resolved: 98,  avgTime: "2.4h", rating: 4.7, load: 7 },
    { role: "Field Specialist", zone: "Sector 12", status: "online",  resolved: 67,  avgTime: "3.1h", rating: 4.5, load: 2 },
    { role: "Rapid Response",   zone: "Sector 1",  status: "online",  resolved: 211, avgTime: "1.2h", rating: 4.95,load: 4 },
    { role: "Moderator",        zone: "City-wide", status: "offline", resolved: 89,  avgTime: "2.0h", rating: 4.6, load: 1 },
  ][i];
  return { id: `s${i+1}`, name, ...meta };
});

const statusColor = {
  online: "#34d399",
  busy: "#fbbf24",
  offline: "#94a3b8",
};

export default function StaffManagement() {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("resolved");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);
  const perPage = 5;

  const filtered = useMemo(() => {
    let list = STAFF_DATA.filter(
      (s) =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.zone.toLowerCase().includes(search.toLowerCase()) ||
        s.role.toLowerCase().includes(search.toLowerCase())
    );
    list.sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];
      if (typeof valA === "string") {
        return sortDir === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortDir === "asc" ? valA - valB : valB - valA;
    });
    return list;
  }, [search, sortKey, sortDir]);

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  return (
    <div className="page-wrap">
      <PageHeader
        eyebrow="Command Layer · Neural Workforce"
        title="Staff Management"
        description="Real-time specialist matrix · load balancing · performance telemetry"
      />

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, margin: "28px 0 24px" }}>
        {[
          { label: "Active Staff", value: STAFF_DATA.length, icon: Users, color: "#0ea5e9" },
          { label: "Online Now", value: STAFF_DATA.filter(s => s.status === "online").length, icon: Activity, color: "#10b981" },
          { label: "Avg Resolution", value: "2.1h", icon: Zap, color: "#f59e0b" },
          { label: "Open Capacity", value: "3 slots", icon: UserPlus, color: "#8b5cf6" },
        ].map((stat) => (
          <div key={stat.label} className="holo-surface holo-border neural-pulse" style={{ borderRadius: 16, padding: "16px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: `${stat.color}18`, display: "grid", placeItems: "center" }}>
                <stat.icon size={18} color={stat.color} />
              </div>
              <div>
                <p style={{ fontSize: 11, color: "var(--subtle)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{stat.label}</p>
                <p style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--font-display)", marginTop: 2 }}>{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Search + Sort */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 240 }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--subtle)" }} />
          <input
            type="text"
            placeholder="Search staff, zone or role…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{
              width: "100%", height: 42, paddingLeft: 38, paddingRight: 14,
              borderRadius: 12, border: "1px solid var(--line)", background: "rgba(255,255,255,0.9)",
              fontSize: 13.5, outline: "none",
            }}
          />
        </div>
        <button
          onClick={() => toggleSort("resolved")}
          style={{
            height: 42, padding: "0 16px", borderRadius: 12, border: "1px solid var(--line)",
            background: "white", display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13,
          }}
        >
          <ArrowUpDown size={14} />
          Sort: {sortKey} ({sortDir})
        </button>
      </div>

      {/* Directory */}
      <div className="holo-surface holo-border" style={{ borderRadius: 18, overflow: "hidden", marginBottom: 20 }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16 }}>Staff Directory</h3>
          <span style={{ fontSize: 11, color: "var(--subtle)", letterSpacing: "0.1em" }}>{filtered.length} AGENTS</span>
        </div>

        {paginated.map((s) => (
          <div
            key={s.id}
            style={{
              display: "flex", alignItems: "center", gap: 16, padding: "14px 20px",
              borderBottom: "1px solid var(--line)", transition: "background 180ms",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(14,165,233,0.04)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <div style={{ position: "relative" }}>
              <div style={{
                width: 44, height: 44, borderRadius: "50%",
                background: "linear-gradient(135deg, #0ea5e9, #22d3ee)",
                display: "grid", placeItems: "center", color: "white", fontWeight: 600, fontSize: 14,
              }}>
                {s.name.split(" ").map(n => n[0]).join("")}
              </div>
              <span style={{
                position: "absolute", bottom: 0, right: 0, width: 12, height: 12,
                borderRadius: "50%", background: statusColor[s.status], border: "2px solid white",
              }} />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</p>
              <p style={{ fontSize: 12, color: "var(--subtle)", marginTop: 2 }}>
                {s.role} · <MapPin size={11} style={{ display: "inline", verticalAlign: "-1px" }} /> {s.zone}
              </p>
            </div>

            <div style={{ display: "flex", gap: 28, fontSize: 13, textAlign: "right" }}>
              <div>
                <p style={{ fontWeight: 600 }}>{s.resolved}</p>
                <p style={{ fontSize: 11, color: "var(--subtle)" }}>Resolved</p>
              </div>
              <div>
                <p style={{ fontWeight: 600 }}>{s.avgTime}</p>
                <p style={{ fontSize: 11, color: "var(--subtle)" }}>Avg time</p>
              </div>
              <div>
                <p style={{ fontWeight: 600, color: "var(--primary)" }}>{s.rating}</p>
                <p style={{ fontSize: 11, color: "var(--subtle)" }}>Rating</p>
              </div>
              <div>
                <p style={{ fontWeight: 600 }}>{s.load}</p>
                <p style={{ fontSize: 11, color: "var(--subtle)" }}>Load</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12 }}>
          <button
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
            style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid var(--line)", background: "white", display: "grid", placeItems: "center", cursor: page === 1 ? "not-allowed" : "pointer", opacity: page === 1 ? 0.4 : 1 }}
          >
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>Page {page} / {totalPages}</span>
          <button
            disabled={page === totalPages}
            onClick={() => setPage(p => p + 1)}
            style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid var(--line)", background: "white", display: "grid", placeItems: "center", cursor: page === totalPages ? "not-allowed" : "pointer", opacity: page === totalPages ? 0.4 : 1 }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}