import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { Bookmark, ChevronLeft, ChevronRight, LocateFixed, MapPin, X } from "lucide-react";
import IssuePriorityBadge from "../../components/issues/shared/IssuePriorityBadge";
import IssueStatusBadge from "../../components/issues/shared/IssueStatusBadge";
import IssueStatusTimeline from "../../components/issues/shared/IssueStatusTimeline";
import PageHeader from "../../components/layout/PageHeader";
import { CATEGORY_LABEL } from "../../constants/issueCategories";
import { publicStatus } from "../../constants/issueStatuses";
import { useAuth } from "../../store/authStore";
import { toggleSaved, useIssues } from "../../store/issueStore";
import { formatDate, formatDateTime } from "../../utils/formatDate";

const PER_PAGE = 6;

function MyReports() {
  const user = useAuth();
  const issues = useIssues();
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);
  const mine = issues.filter((issue) => issue.reporterId === user?.id || issue.reportedBy === user?.name);
  const totalPages = Math.ceil(mine.length / PER_PAGE) || 1;
  const safePage = Math.min(page, totalPages);
  const rows = useMemo(() => mine.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE), [mine, safePage]);
  const selected = mine.find((issue) => issue.id === selectedId) || null;

  return (
    <main className="page-wrap">
      <PageHeader eyebrow="Citizen Layer · Reports" title="My Reports" description="Your filed issues. Status follows the city update." />
      <div style={{ display: "grid", gap: 12, marginTop: 20 }}>
        {rows.length === 0 && <article style={card}><p style={{ color: "var(--subtle)" }}>No reports filed yet.</p></article>}
        {rows.map((issue) => (
          <article key={issue.id} onClick={() => setSelectedId(issue.id)} style={card} onMouseEnter={lift} onMouseLeave={drop}>
            <span style={hair} />
            <div>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--subtle)" }}>{issue.id} · {issue.ward}</p>
              <h3 style={{ margin: "6px 0", fontFamily: "var(--font-display)" }}>{issue.title}</h3>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <IssueStatusBadge status={publicStatus(issue.status)} />
                <IssuePriorityBadge priority={issue.priority} />
                <span style={{ fontSize: 12.5, color: "var(--primary-deep)" }}>{CATEGORY_LABEL[issue.category]}</span>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: 10.5, letterSpacing: "0.08em", color: "var(--subtle)" }}>REPORTED</p>
              <p style={{ fontFamily: "var(--font-mono)", fontWeight: 650 }}>{formatDate(issue.createdAt)}</p>
            </div>
          </article>
        ))}
      </div>
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, marginTop: 16 }}>
          <button type="button" disabled={safePage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))} style={pageBtn}><ChevronLeft size={16} /></button>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--subtle)" }}>{safePage} / {totalPages}</span>
          <button type="button" disabled={safePage === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} style={pageBtn}><ChevronRight size={16} /></button>
        </div>
      )}
      <CitizenReportDrawer issue={selected} onClose={() => setSelectedId(null)} />
    </main>
  );
}

function CitizenReportDrawer({ issue, onClose, closeOnUnsave = false }) {
  if (!issue) return null;
  const status = publicStatus(issue.status);
  const hasCoords = Number.isFinite(issue.lat) && Number.isFinite(issue.lng);
  const mapTo = hasCoords ? `/map?lat=${issue.lat}&lng=${issue.lng}&zone=${encodeURIComponent(issue.ward)}` : "/map";

  const onSave = () => {
    toggleSaved(issue.id);
    if (closeOnUnsave && issue.saved) onClose();
  };

  return createPortal(
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(8,15,28,0.52)", backdropFilter: "blur(14px)", zIndex: 90 }} />
      <aside style={door}>
        <div style={{ height: 3, background: "linear-gradient(90deg, transparent, #0ea5e9 15%, #22d3ee 50%, #0ea5e9 85%, transparent)" }} />
        <div style={{ padding: "15px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, borderBottom: "1px solid rgba(14,165,233,0.1)" }}>
          <div>
            <p style={{ fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--primary)" }}>Your report</p>
            <p style={{ fontFamily: "var(--font-mono)", fontWeight: 650 }}>{issue.id}</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button type="button" onClick={onSave} style={saveChip}>
              <Bookmark size={14} fill={issue.saved ? "currentColor" : "none"} />
              {issue.saved ? "Unsave" : "Save"}
            </button>
            <button type="button" onClick={onClose} aria-label="Close" style={pageBtn}><X size={16} /></button>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 22 }}>
          <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 24 }}>{issue.title}</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12, alignItems: "center" }}>
            <IssueStatusBadge status={status} />
            <IssuePriorityBadge priority={issue.priority} />
            <span style={{ color: "var(--primary-deep)", fontSize: 13 }}>{CATEGORY_LABEL[issue.category]}</span>
          </div>
          <p style={{ marginTop: 14, lineHeight: 1.65 }}>{issue.description}</p>
          <p style={{ marginTop: 8, color: "var(--muted)", display: "flex", gap: 6 }}><MapPin size={14} /> {issue.location} · {issue.ward}</p>
          <p style={{ marginTop: 8, fontSize: 12.5, color: "var(--subtle)" }}>Reported {formatDateTime(issue.createdAt)} · Updated {formatDateTime(issue.updatedAt)}</p>
          <div style={{ marginTop: 16, borderRadius: 18, overflow: "hidden", border: "1px solid rgba(14,165,233,0.16)", background: "rgba(255,255,255,0.62)" }}>
            <div style={{ position: "relative", height: 160, background: "linear-gradient(180deg, #e0f2fe, #f0f9ff)", overflow: "hidden" }}>
              <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(14,165,233,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(14,165,233,0.08) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
              <div style={{ position: "absolute", left: "58%", top: "46%", width: 32, height: 32, borderRadius: "50%", transform: "translate(-50%, -50%)", background: "linear-gradient(135deg, #0ea5e9, #22d3ee)", display: "grid", placeItems: "center", color: "white" }}><LocateFixed size={15} /></div>
              <div style={{ position: "absolute", left: 0, right: 0, height: 2, background: "linear-gradient(90deg, transparent, rgba(34,211,238,0.6), transparent)", animation: "scanLine 3.5s linear infinite" }} />
            </div>
            <div style={{ padding: 14 }}>
              <p style={{ fontWeight: 650 }}>{issue.location}</p>
              <p style={{ fontSize: 12, color: "var(--muted)", margin: "4px 0 12px" }}>{issue.ward}{hasCoords ? ` · ${issue.lat.toFixed(5)}, ${issue.lng.toFixed(5)}` : ""}</p>
              <Link to={mapTo} style={mapBtn}>Open this point on the map</Link>
            </div>
          </div>
          <p style={{ margin: "20px 0 8px", fontSize: 10.5, fontWeight: 650, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--subtle)" }}>Status timeline</p>
          <IssueStatusTimeline citizen current={issue.status} events={issue.timeline || []} />
        </div>
      </aside>
      <style>{`
        @keyframes slideInCyborg { from { transform: translateX(110%); opacity: 0.4; } to { transform: none; opacity: 1; } }
        @keyframes scanLine { 0% { top: 0; } 100% { top: 100%; } }
      `}</style>
    </>,
    document.body
  );
}

const door = { position: "fixed", top: 0, right: 0, width: "min(540px, 100vw)", height: "100dvh", zIndex: 100, display: "flex", flexDirection: "column", background: "rgba(255,255,255,0.78)", backdropFilter: "blur(28px) saturate(1.7)", borderLeft: "1px solid rgba(14,165,233,0.25)", boxShadow: "-32px 0 90px rgba(14,165,233,0.14)", animation: "slideInCyborg 0.36s cubic-bezier(0.22, 1, 0.36, 1)" };
const card = { position: "relative", overflow: "hidden", display: "grid", gridTemplateColumns: "1fr auto", gap: 16, alignItems: "center", padding: "16px 18px", borderRadius: 18, cursor: "pointer", background: "rgba(255,255,255,0.74)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.8)", boxShadow: "0 8px 28px rgba(14,165,233,0.07)", transition: "transform 220ms, box-shadow 220ms" };
const hair = { position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, transparent, rgba(14,165,233,0.55), transparent)" };
const pageBtn = { width: 36, height: 36, borderRadius: 10, border: "1px solid var(--line)", background: "white", display: "grid", placeItems: "center", cursor: "pointer" };
const saveChip = { height: 36, padding: "0 12px", borderRadius: 999, border: "1px solid rgba(14,165,233,0.25)", background: "rgba(14,165,233,0.08)", color: "var(--primary-deep)", display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 650, cursor: "pointer" };
const mapBtn = { display: "flex", alignItems: "center", justifyContent: "center", height: 40, borderRadius: 11, background: "linear-gradient(135deg, #0ea5e9, #0284c7)", color: "white", textDecoration: "none", fontWeight: 650 };
function lift(e) { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 18px 40px rgba(14,165,233,0.16)"; }
function drop(e) { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 8px 28px rgba(14,165,233,0.07)"; }

export default MyReports;