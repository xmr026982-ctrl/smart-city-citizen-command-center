import { updateStatus } from "../../../store/issueStore";
import { useAuth } from "../../../store/authStore";

function AdminConfirmClose({ issue }) {
  const user = useAuth();

  if (user?.role !== "admin") return null;
  if (issue.status !== "pending_review") return null;

  return (
    <div style={{
      borderRadius: 14,
      padding: 14,
      marginBottom: 18,
      background: "rgba(245,158,11,0.08)",
      border: "1px solid rgba(245,158,11,0.28)",
    }}>
      <p style={{ fontSize: 13, fontWeight: 650, marginBottom: 6 }}>Awaiting command confirm</p>
      <p style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 12 }}>
        Field requested close. Citizen still sees In Progress until you confirm.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => updateStatus(issue.id, "resolved", user.name, user.role)}
          style={{
            height: 38, padding: "0 14px", borderRadius: 10, border: "none",
            background: "linear-gradient(135deg, #10b981, #059669)",
            color: "white", fontWeight: 650, fontSize: 13, cursor: "pointer",
          }}
        >
          Confirm resolved
        </button>
        <button
          type="button"
          onClick={() => updateStatus(issue.id, "in_progress", user.name, user.role)}
          style={{
            height: 38, padding: "0 14px", borderRadius: 10,
            border: "1px solid var(--line)", background: "white",
            fontWeight: 650, fontSize: 13, cursor: "pointer",
          }}
        >
          Send back to field
        </button>
      </div>
    </div>
  );
}

export default AdminConfirmClose;