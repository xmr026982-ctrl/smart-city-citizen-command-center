import PageHeader from "../../components/layout/PageHeader";
import GlassCard from "../../components/ui/GlassCard";

function StaffNotifications() {
  return (
    <main className="page-wrap">
      <PageHeader
        eyebrow="Field Layer · Trace"
        title="Notifications"
        description="Owned by Person 5. This issue module only shows a placeholder."
      />
      <GlassCard>
        <p style={{ padding: 36, textAlign: "center", color: "var(--muted)", fontSize: 14 }}>
          Field alerts will land here when Person 5 wires the inbox.
        </p>
      </GlassCard>
    </main>
  );
}

export default StaffNotifications;