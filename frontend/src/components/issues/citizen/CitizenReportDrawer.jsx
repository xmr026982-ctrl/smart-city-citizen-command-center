import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
  Bookmark, X, MapPin, Calendar, Clock, Hash, LocateFixed, ArrowUpRight, FileText, Radar, ShieldCheck, Check,
  Hourglass, Users, Siren, CheckCircle2, Camera, Plus, Lock,
} from "lucide-react";
import IssueStatusBadge from "../shared/IssueStatusBadge";
import IssuePriorityBadge from "../shared/IssuePriorityBadge";
import { CATEGORY_LABEL } from "../../../constants/issueCategories";
import { STATUS_LABEL, publicStatus } from "../../../constants/issueStatuses";
import { expertiseForCategory, expertiseLabel } from "../../../config/expertise";
import { useAuth } from "../../../store/authStore";
import { formatDateTime } from "../../../utils/formatDate";
import { slaOf, span, resolveHours } from "../../../utils/sla";
import { canView, isFollowing, isReporter, isSupporter, toggleFollow, meToo, affected } from "../../../services/citizenService";
import { CitizenRemoval } from "../shared/RemovalKit";
import { useSeenFile } from "../../../store/notifyStore";
import "../../../styles/citizen-drawer.css";

/* ------------------------------------------------------------------
   Citizen report drawer (My Reports, Following, Report Issue).
   What a citizen may know about a report, and nothing more:
   • the public journey: received, queued, being fixed, resolved.
     "Pending confirmation" is internal and shows as being fixed.
   • the city's promise (service window) and whether it is on time
   • when resolved: a plain resolution line (which crew line, on time
     or late). Internal notes, reasons, crew names and who moved the
     file are never shown here.
   • how many citizens are affected, the photos, the place
   A citizen opens only their own reports and the ones they follow;
   anything else shows a locked panel. Rendered in a portal.
------------------------------------------------------------------- */

const STEPS = ["submitted", "acknowledged", "in_progress", "resolved"];

const COPY = {
  submitted: "The city received your report",
  acknowledged: "Reviewed and queued for a crew",
  in_progress: "A crew is working on it",
  resolved: "Fixed and verified by the city",
};

// the citizen-facing promise line
function promise(issue) {
  const s = slaOf(issue);
  const total = Number(issue.slaHours) || 0;
  if (!total) return { tone: "none", head: "No promise set", sub: "" };
  if (s.state === "closed") {
    const took = resolveHours(issue);
    if (took === null) return { tone: "closed", head: "Resolved", sub: `Promised within ${span(total)}` };
    return took <= total
      ? { tone: "closed", head: `Resolved in ${span(took)}`, sub: `On time · promised within ${span(total)}` }
      : { tone: "late", head: `Resolved in ${span(took)}`, sub: `${span(took - total)} late · promised within ${span(total)}` };
  }
  if (s.state === "over") return { tone: "over", head: `${span(-s.left)} late`, sub: `Promised within ${span(total)} · the city is past its promise` };
  return { tone: s.state, head: `${span(s.left)} left`, sub: `Promised within ${span(total)}` };
}

function CitizenReportDrawer({ issue, onClose, closeOnUnsave = false }) {
  const user = useAuth();
  useSeenFile(issue?.id); // opening the report is seeing its updates
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });
  const openId = issue ? issue.id : null;
  const [zoom, setZoom] = useState(null); // photo shown large
  const zoomRef = useRef(null);
  useEffect(() => { zoomRef.current = zoom; });

  useEffect(() => { setZoom(null); }, [openId]);

  // lock page scroll and close on Escape while a report is open (Esc closes a zoomed photo first)
  useEffect(() => {
    if (!openId) return undefined;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (zoomRef.current) setZoom(null);
      else closeRef.current();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [openId]);

  if (!issue) return null;

  const allowed = canView(issue, user);
  const mine = isReporter(issue, user);
  const following = isFollowing(issue, user);
  const supporter = isSupporter(issue, user);
  const status = publicStatus(issue.status);
  const stepIndex = Math.max(0, STEPS.indexOf(status));
  const progress = Math.round((stepIndex / (STEPS.length - 1)) * 100);
  const hasCoords = Number.isFinite(issue.lat) && Number.isFinite(issue.lng);
  const mapTo = hasCoords ? `/map?lat=${issue.lat}&lng=${issue.lng}&zone=${encodeURIComponent(issue.ward)}` : "/map";
  const pinX = hasCoords ? 28 + (Math.abs(issue.lng * 100) % 44) : 56;
  const pinY = hasCoords ? 26 + (Math.abs(issue.lat * 100) % 40) : 48;
  const events = (issue.timeline || []).filter((e) => e.status !== "pending_review");
  const eventOf = (step) => [...events].reverse().find((e) => e.status === step);
  const p = promise(issue);
  const line = expertiseLabel(expertiseForCategory(issue.category));
  const photos = issue.photos || [];
  const people = affected(issue);

  const onFollow = () => {
    toggleFollow(issue.id, user);
    if (closeOnUnsave && following && !supporter) onClose(); // a joined report stays in Saved
  };

  return createPortal(
    <div className="ix">
      <div className="crd-veil" onClick={onClose} />

      <aside className="crd" role="dialog" aria-modal="true" aria-label={`Report ${issue.id}`}>
        <span className="crd-edge" aria-hidden />
        <span className="crd-scan" aria-hidden />

        <header className="crd-head">
          <div className="crd-id">
            <span className="crd-mark"><FileText size={17} strokeWidth={1.8} /><i /></span>
            <div>
              <p className="crd-crumb">CITIZEN SERVICES <b>/</b> {mine ? "YOUR REPORT" : "FOLLOWED REPORT"}</p>
              <p className="crd-code">{issue.id}</p>
            </div>
          </div>
          <div className="crd-actions">
            {allowed ? (
              <button
                type="button"
                className={`crd-save${following ? " on" : ""}`}
                onClick={onFollow}
                title={mine ? (following ? "Remove from Saved" : "Keep it in Saved") : following ? "Stop following" : "Follow this report"}
              >
                <Bookmark size={14} fill={following ? "currentColor" : "none"} />
                {mine ? (following ? "Saved" : "Save") : following ? "Following" : "Follow"}
              </button>
            ) : null}
            <button type="button" className="crd-x" onClick={onClose} aria-label="Close"><X size={16} /></button>
          </div>
        </header>

        {!allowed ? (
          <div className="crd-body">
            <section className="crd-locked">
              <span><Lock size={18} /></span>
              <h2>This report isn't yours</h2>
              <p>You can open your own reports and the ones you follow. If this problem affects you too, report it from Report Issue: the city will show you the matching report so you can join it.</p>
              <Link to="/citizen/report" className="crd-map" onClick={onClose}>Report an issue <ArrowUpRight size={15} /></Link>
            </section>
          </div>
        ) : (
          <div className="crd-body">
            <section className="crd-hero">
              <h2>{issue.title}</h2>
              <div className="crd-chips">
                <IssueStatusBadge status={status} />
                <IssuePriorityBadge priority={issue.priority} />
                <span className="crd-cat">{CATEGORY_LABEL[issue.category] || issue.category}</span>
                {issue.danger ? <span className="crd-flag"><Siren size={11} /> Danger flagged</span> : null}
              </div>
            </section>

            {status === "resolved" ? (
              <section className={`crd-resolved${p.tone === "late" ? " late" : ""}`}>
                <span><CheckCircle2 size={18} /></span>
                <div>
                  <strong>Fixed and verified by the city</strong>
                  <p>
                    The {line} crew resolved this {eventOf("resolved") ? `on ${formatDateTime(eventOf("resolved").at)}` : ""}.{" "}
                    {p.tone === "late" ? `It took ${p.head.replace("Resolved in ", "")}, ${p.sub.split(" · ")[0]} against the city's promise.` : "It was done inside the city's promise."}
                  </p>
                </div>
              </section>
            ) : null}

            <section className="crd-journey">
              <div className="crd-journey-top">
                <span><Radar size={13} /> Report journey</span>
                <strong>{progress}%</strong>
              </div>
              <div className="crd-track">
                <i style={{ width: `${progress}%` }} />
                {STEPS.map((step, i) => (
                  <span key={step} className={`crd-node${i < stepIndex ? " done" : ""}${i === stepIndex ? " now" : ""}`} style={{ left: `${(i / (STEPS.length - 1)) * 100}%` }}>
                    {i < stepIndex || (i === stepIndex && step === "resolved") ? <Check size={10} strokeWidth={3} /> : null}
                  </span>
                ))}
              </div>
              <div className="crd-steps">
                {STEPS.map((step, i) => <span key={step} className={i <= stepIndex ? "on" : ""}>{STATUS_LABEL[step]}</span>)}
              </div>
            </section>

            {!issue.removed ? (
            <section className={`crd-promise ${p.tone}`}>
              <span className="crd-promise-ic"><Hourglass size={16} /></span>
              <div>
                <p className="crd-label">City promise</p>
                <strong>{p.head}</strong>
                <em>{p.sub}</em>
              </div>
              <div className="crd-affected" title="You plus everyone who said this affects them too">
                <Users size={14} /><b>{people}</b><span>{people === 1 ? "citizen" : "citizens"} affected</span>
              </div>
            </section>
            ) : null}

            {mine ? <CitizenRemoval issue={issue} user={user} /> : null}

            {!mine && !supporter && status !== "resolved" && !issue.removed ? (
              <section className="crd-join">
                <p>Does this affect you too? Joining adds you to the count the city sees.</p>
                <button type="button" className="crd-map" onClick={() => meToo(issue.id, user)}><Plus size={14} /> Affects me too</button>
              </section>
            ) : null}

            <section className="crd-meta">
              <Meta icon={MapPin} label="Zone" value={issue.ward} />
              <Meta icon={Hash} label="Report ID" value={issue.id} mono />
              <Meta icon={Calendar} label="Reported" value={formatDateTime(issue.createdAt)} />
              <Meta icon={Clock} label="Last update" value={formatDateTime(issue.updatedAt)} />
            </section>

            {issue.description ? (
              <section className="crd-card">
                <p className="crd-label">{mine ? "What you reported" : "What was reported"}</p>
                <p className="crd-desc">{issue.description}</p>
              </section>
            ) : null}

            {photos.length ? (
              <section className="crd-card">
                <p className="crd-label"><Camera size={12} /> Photos · {photos.length}</p>
                <div className="crd-photos">
                  {photos.map((ph, i) => (
                    <button key={ph.id} type="button" onClick={() => setZoom(ph)} aria-label={`Open photo ${i + 1}`}>
                      <img src={ph.url} alt={`Photo ${i + 1} of the problem`} />
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="crd-geo">
              <div className="crd-geo-stage">
                <span className="crd-grid" />
                <span className="crd-ring" style={{ left: `${pinX}%`, top: `${pinY}%` }} />
                <span className="crd-ring late" style={{ left: `${pinX}%`, top: `${pinY}%` }} />
                <span className="crd-pin" style={{ left: `${pinX}%`, top: `${pinY}%` }}><LocateFixed size={15} /></span>
                <span className="crd-geo-scan" />
                <span className="crd-hud tl" /><span className="crd-hud br" />
              </div>
              <div className="crd-geo-info">
                <div>
                  <p className="crd-geo-name">{issue.location}</p>
                  <p className="crd-geo-sub">{issue.ward}{hasCoords ? <span>{issue.lat.toFixed(5)}, {issue.lng.toFixed(5)}</span> : null}</p>
                </div>
                <Link to={mapTo} className="crd-map">Open on map <ArrowUpRight size={15} /></Link>
              </div>
            </section>

            <section className="crd-card">
              <p className="crd-label">Status timeline</p>
              <ol className="crd-tl">
                {STEPS.map((step, i) => {
                  const ev = eventOf(step);
                  const state = i < stepIndex ? "done" : i === stepIndex ? "now" : "next";
                  return (
                    <li key={step} className={`crd-tl-row ${state}`}>
                      <span className="crd-tl-rail">
                        <span className="crd-tl-dot">{state === "done" || (state === "now" && step === "resolved") ? <Check size={10} strokeWidth={3} /> : null}</span>
                        {i < STEPS.length - 1 ? <span className="crd-tl-line" /> : null}
                      </span>
                      <div className="crd-tl-copy">
                        <div className="crd-tl-head">
                          <strong>{STATUS_LABEL[step]}</strong>
                          {state === "now" && step !== "resolved" ? <em>Live</em> : null}
                        </div>
                        {/* public copy only: timeline notes carry internal reasons and names */}
                        <p>{COPY[step]}</p>
                        {ev && state !== "next" ? <time>{formatDateTime(ev.at)}</time> : <time className="wait">{state === "next" ? "Not yet" : "Waiting on the city"}</time>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>

            <p className="crd-foot"><ShieldCheck size={14} /> The city confirms each move before you see it. Your name is never shown publicly.</p>
          </div>
        )}
      </aside>

      {zoom ? (
        <div className="crd-zoom" onClick={() => setZoom(null)} role="dialog" aria-label="Photo">
          <img src={zoom.url} alt="The problem, full size" />
          <button type="button" aria-label="Close photo"><X size={18} /></button>
        </div>
      ) : null}
    </div>,
    document.body
  );
}

function Meta({ icon: Icon, label, value, mono = false }) {
  return (
    <div className="crd-meta-cell">
      <span><Icon size={14} /></span>
      <div>
        <p>{label}</p>
        <strong className={mono ? "mono-v" : ""}>{value || "—"}</strong>
      </div>
    </div>
  );
}

export default CitizenReportDrawer;