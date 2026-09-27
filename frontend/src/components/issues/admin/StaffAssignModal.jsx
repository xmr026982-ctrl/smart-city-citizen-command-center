import { useState } from "react";
import { X, UserCheck, Search, MapPin, Zap, CheckCircle2 } from "lucide-react";
import { STAFF_ROSTER } from "../../../constants/issueConstants";

// Extra visual data for the futuristic UI (does not change the real names)
const STAFF_META = {
  "Koushik Bhowmik": { role: "Field Specialist", zone: "Sector 7", load: 3, status: "online" },
  "Subhomoy Ghosh":  { role: "Senior Resolver", zone: "Sector 3", load: 7, status: "busy" },
  "Taras Hembram":   { role: "Field Specialist", zone: "Sector 12", load: 2, status: "online" },
  "Sayan Majumder":  { role: "Rapid Response", zone: "Sector 1", load: 4, status: "online" },
  "Swarup Sutradhar":{ role: "Moderator", zone: "City-wide", load: 1, status: "offline" },
};

const statusColor = {
  online: "#34d399",
  busy: "#fbbf24",
  offline: "#94a3b8",
};

export default function StaffAssignModal({
  isOpen,
  onClose,
  issue = null,
  onAssign = () => {},
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [isAssigning, setIsAssigning] = useState(false);

  if (!isOpen) return null;

  const filtered = STAFF_ROSTER.filter((name) =>
    name.toLowerCase().includes(search.toLowerCase())
  );

  const handleAssign = async () => {
    if (!selected) return;
    setIsAssigning(true);
    await new Promise((r) => setTimeout(r, 700));
    onAssign(selected);          // sends the REAL name
    setIsAssigning(false);
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "grid",
        placeItems: "center",
        background: "rgba(11, 18, 32, 0.45)",
        backdropFilter: "blur(8px)",
      }}
      onClick={onClose}
    >
      <div
        className="holo-surface holo-border"
        style={{
          width: "min(520px, 94vw)",
          maxHeight: "86vh",
          borderRadius: 24,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 32px 80px rgba(14, 165, 233, 0.18)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--line)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: "linear-gradient(135deg, #0ea5e9, #22d3ee)",
                display: "grid",
                placeItems: "center",
                color: "white",
              }}
            >
              <UserCheck size={18} />
            </div>
            <div>
              <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 18 }}>
                Assign Specialist
              </h3>
              <p style={{ fontSize: 12, color: "var(--subtle)", marginTop: 2 }}>
                {issue ? `Issue #${issue.id} · Neural match` : "Select field agent"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              border: "1px solid var(--line)",
              background: "white",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: "16px 24px 8px" }}>
          <div style={{ position: "relative" }}>
            <Search
              size={15}
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--subtle)",
              }}
            />
            <input
              type="text"
              placeholder="Search by name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%",
                height: 42,
                paddingLeft: 38,
                paddingRight: 14,
                borderRadius: 12,
                border: "1px solid var(--line)",
                background: "rgba(255,255,255,0.85)",
                fontSize: 13.5,
                outline: "none",
              }}
            />
          </div>
        </div>

        {/* Staff list – REAL names only */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 16px 16px" }}>
          {filtered.map((name) => {
            const meta = STAFF_META[name] || { role: "Staff", zone: "—", load: 0, status: "offline" };
            const isSelected = selected === name;

            return (
              <button
                key={name}
                onClick={() => setSelected(name)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "12px 14px",
                  borderRadius: 14,
                  border: isSelected ? "1.5px solid var(--primary)" : "1px solid transparent",
                  background: isSelected ? "rgba(14, 165, 233, 0.08)" : "transparent",
                  cursor: "pointer",
                  transition: "all 180ms var(--ease)",
                  marginBottom: 4,
                  textAlign: "left",
                }}
              >
                <div style={{ position: "relative" }}>
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, #0ea5e9, #22d3ee)",
                      display: "grid",
                      placeItems: "center",
                      color: "white",
                      fontWeight: 600,
                      fontSize: 13,
                    }}
                  >
                    {name.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <span
                    style={{
                      position: "absolute",
                      bottom: 0,
                      right: 0,
                      width: 11,
                      height: 11,
                      borderRadius: "50%",
                      background: statusColor[meta.status],
                      border: "2px solid white",
                    }}
                  />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 500, fontSize: 14 }}>{name}</p>
                  <p style={{ fontSize: 12, color: "var(--subtle)", marginTop: 1 }}>
                    {meta.role} · {meta.zone}
                  </p>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 12,
                      color: "var(--muted)",
                    }}
                  >
                    <Zap size={12} />
                    {meta.load} active
                  </div>
                  {isSelected && (
                    <CheckCircle2
                      size={16}
                      color="var(--primary)"
                      style={{ marginTop: 4, marginLeft: "auto" }}
                    />
                  )}
                </div>
              </button>
            );
          })}

          {filtered.length === 0 && (
            <p style={{ textAlign: "center", padding: "32px 0", color: "var(--subtle)", fontSize: 13 }}>
              No specialists match your search
            </p>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid var(--line)",
            display: "flex",
            gap: 12,
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={onClose}
            style={{
              height: 42,
              padding: "0 18px",
              borderRadius: 12,
              border: "1px solid var(--line)",
              background: "white",
              fontSize: 13.5,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={!selected || isAssigning}
            style={{
              height: 42,
              padding: "0 22px",
              borderRadius: 12,
              border: "none",
              background: selected
                ? "linear-gradient(135deg, #0ea5e9, #0284c7)"
                : "#e2e8f0",
              color: selected ? "white" : "var(--subtle)",
              fontSize: 13.5,
              fontWeight: 600,
              cursor: selected ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              gap: 8,
              boxShadow: selected ? "0 8px 20px rgba(14, 165, 233, 0.3)" : "none",
            }}
          >
            {isAssigning ? (
              "Assigning…"
            ) : (
              <>
                <MapPin size={15} />
                Assign Specialist
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}