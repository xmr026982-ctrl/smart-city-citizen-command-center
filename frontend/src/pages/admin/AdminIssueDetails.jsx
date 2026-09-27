import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import IssueDetails from "../../components/issues/shared/IssueDetails";
import { useIssues } from "../../store/issueStore";

function AdminIssueDetails() {
  const { id } = useParams();
  const issue = useIssues().find((item) => item.id === id);

  if (!issue) {
    return (
      <div className="page-wrap">
        <div
          className="holo-surface holo-border"
          style={{ borderRadius: 18, padding: 48, textAlign: "center" }}
        >
          <h2 style={{ fontFamily: "var(--font-display)" }}>Issue not found</h2>
          <Link
            to="/admin/queue"
            style={{
              display: "inline-block",
              marginTop: 16,
              color: "var(--primary)",
              fontWeight: 500,
            }}
          >
            ← Back to ledger
          </Link>
        </div>
      </div>
    );
  }

  return (
    <main className="page-wrap">
      <div style={{ marginBottom: 24 }}>
        <Link
          to="/admin/queue"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontSize: 13,
            color: "var(--muted)",
            fontWeight: 500,
          }}
        >
          <ArrowLeft size={15} />
          Back to ledger
        </Link>
      </div>

      <div className="holo-surface holo-border" style={{ borderRadius: 20, padding: 28 }}>
        <IssueDetails issue={issue} />
      </div>
    </main>
  );
}

export default AdminIssueDetails;