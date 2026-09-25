import { ArrowUpRight, LocateFixed } from "lucide-react";
import { Link } from "react-router-dom";

function IssueLocationPreview({ issue }) {
  if (!issue) return null;

  const hasCoords = Number.isFinite(issue.lat) && Number.isFinite(issue.lng);
  const mapTo = hasCoords
    ? `/map?lat=${issue.lat}&lng=${issue.lng}&issueId=${issue.id}`
    : "/map";

  const pinX = hasCoords ? 28 + (Math.abs(issue.lng * 100) % 44) : 50;
  const pinY = hasCoords ? 24 + (Math.abs(issue.lat * 100) % 40) : 46;

  return (
    <section className="panel geo-card">
      <div className="section-head">
        <div>
          <p className="eyebrow">Geo lock</p>
          <h3 style={{ marginTop: 8, fontSize: 18 }}>{issue.ward || "Ward pending"}</h3>
          <p style={{ marginTop: 6, color: "var(--muted)", fontSize: 14 }}>
            {issue.location || "Exact street location was not provided."}
          </p>
        </div>
        <span className="citizen-chip">
          <span className="live-dot" />
          Site fix
        </span>
      </div>

      <div className="geo-stage" aria-hidden="true">
        <span className="geo-ring" />
        <span className="geo-ring geo-ring-2" />
        <span className="geo-cross-x" />
        <span className="geo-cross-y" />
        <span className="geo-pin" style={{ left: `${pinX}%`, top: `${pinY}%` }}>
          <LocateFixed size={14} />
        </span>
        <span className="geo-scan" />
      </div>

      <div className="geo-meta">
        <div>
          <p className="eyebrow">Latitude</p>
          <p className="mono">{hasCoords ? issue.lat.toFixed(5) : "—"}</p>
        </div>
        <div>
          <p className="eyebrow">Longitude</p>
          <p className="mono">{hasCoords ? issue.lng.toFixed(5) : "—"}</p>
        </div>
        <div>
          <p className="eyebrow">Record</p>
          <p className="mono">{issue.id}</p>
        </div>
      </div>

      <Link to={mapTo} className="btn btn-primary geo-open">
        Open exact site on city map
        <ArrowUpRight size={16} />
      </Link>
      <p className="mono" style={{ marginTop: 10 }}>
        Preview only. Full map belongs to Person 3.
      </p>
    </section>
  );
}

export default IssueLocationPreview;