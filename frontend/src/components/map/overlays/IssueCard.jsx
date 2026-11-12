import { clock, stampShort } from "../../../utils/time";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Copy, Check, Navigation, ArrowUpRight, MapPin, User, Clock, Hourglass, Lock } from "lucide-react";
import { useAllIssues } from "../../../store/issueStore";
import { useAuth } from "../../../store/authStore";
import { CATEGORY_LABEL } from "../../../constants/issueCategories";
import { STATUS_LABEL, publicStatus } from "../../../constants/issueStatuses";
import { PRIORITY_LABEL } from "../../../constants/issuePriorities";
import { slaOf } from "../../../utils/sla";
import { fileLink } from "../../../utils/fileLink";
import { useInbox, useSeenFile } from "../../../store/notifyStore";
import FollowBar from "../../issues/citizen/FollowBar";
import { mapNotify } from "../mapNotify";

/* ------------------------------------------------------------------
   Issue card (all roles), on top of Person 3's map. One card, the same
   shape for everyone; what it shows and allows follows the role:
     admin   everything · Route · Open the file (All Issues)
     staff   own files · Route · Open the file (Assigned Work)
     citizen own reports · Route · Open my report (My Reports);
             other people's issues: the public card, no details
   Coordinates copy from the row itself (hover → copy). Esc or × closes.
   "Open the file" leaves the map on this issue, so Back returns to it.
------------------------------------------------------------------- */
const ROLE = { admin: "admin", staff: "staff", user: "citizen" };

export default function IssueCard({ role, issueId, onClose, onRoute }) {
  const everything = useAllIssues();
  const me = useAuth();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const issue = everything.find((i) => i.id === issueId) || null;
  // the newest update you hadn't seen, kept on the card while it's open; opening the card reads it
  const { items } = useInbox();
  const latest = items.find((n) => n.unread && n.ref?.type === "issue" && n.ref.id === issueId) || null;
  const [news, setNews] = useState(null);
  useEffect(() => { setNews(latest); }, [issueId]); // eslint-disable-line react-hooks/exhaustive-deps
  useSeenFile(issueId);

  useEffect(() => { setCopied(false); }, [issueId]);
  useEffect(() => {
    if (!issueId) return undefined;
    const onKey = (e) => { if (e.key === "Escape" && !document.querySelector("[aria-modal='true']")) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [issueId, onClose]);

  if (!issue) return null;
  const r = ROLE[role] || "citizen";
  const staffIds = [me?.serverId, me?._id, me?.id]
  .filter(Boolean)
  .map(String);

const staffOwnsIssue =
  (issue.assignedToId && staffIds.includes(String(issue.assignedToId))) ||
  (
    !issue.assignedToId &&
    String(issue.assignedTo || "").trim().toLowerCase() ===
      String(me?.displayName || me?.name || "").trim().toLowerCase()
  );

const mine =
  r === "admin" ||
  (r === "staff" ? Boolean(staffOwnsIssue) : issue.reporterId === me?.id);
  const isPublic = r === "citizen" && !mine;
  const sla = slaOf(issue);
  const status = r === "citizen" ? publicStatus(issue.status) : issue.status;
  const coords = `${issue.lat.toFixed(6)}, ${issue.lng.toFixed(6)}`;

  const copy = async () => {
    try { await navigator.clipboard.writeText(coords); } catch { /* clipboard blocked: the numbers stay selectable */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const openFile = () => {
    // keep this issue on the map behind us, so Back lands on it again
    const here = `/map?${new URLSearchParams({ issueId: issue.id, lat: String(issue.lat), lng: String(issue.lng), zone: issue.ward }).toString()}`;
    navigate(here, { replace: true });
    navigate(fileLink(r, issue.id, here));
  };

  return (
    <aside className={`mic${isPublic ? " public" : ""}`} aria-label={`Issue ${issue.id}`}>
      <header className="mic-head">
        <div>
          <p className="mic-kick">{isPublic ? "Reported issue" : r === "citizen" ? "Your report" : r === "staff" ? "Your work file" : "Issue file"} · <b>{issue.id}</b></p>
          <h3>{issue.title}</h3>
        </div>
        <button type="button" className="mic-x" onClick={onClose} aria-label="Close"><X size={15} /></button>
      </header>

      <div className="mic-chips">
        <span className={`mic-st s-${issue.status}`}><i />{STATUS_LABEL[status] || status}</span>
        {!isPublic ? <span className={`mic-pr p-${issue.priority}`}>{PRIORITY_LABEL[issue.priority] || issue.priority}</span> : null}
        <span className="mic-cat">{CATEGORY_LABEL[issue.category] || issue.category}</span>
      </div>

      {news ? (
        <div className="mic-news" role="status"><i aria-hidden /><b>{news.title}</b><time>{clock(news.at)}</time></div>
      ) : null}

      {!isPublic && issue.status !== "resolved" && sla.state !== "none" ? (
        <div className={`mic-sla ${sla.state}`}><Hourglass size={13} /> {sla.label}<span>of a {sla.total}h window</span></div>
      ) : null}

      <dl className="mic-facts">
        <div><dt><MapPin size={12} /> Zone</dt><dd>{issue.ward}</dd></div>
        {!isPublic ? <div><dt><User size={12} /> Crew</dt><dd className={issue.assignedTo ? "" : "warn"}>{issue.assignedTo || "Not assigned"}</dd></div> : null}
        <div><dt><Clock size={12} /> Reported</dt><dd>{stampShort(issue.createdAt)}</dd></div>
      </dl>

      {!isPublic && issue.location ? <p className="mic-place">{issue.location}</p> : null}

      <button type="button" className={`mic-coords${copied ? " done" : ""}`} onClick={copy} title="Copy coordinates">
        <span className="m">{coords}</span>
        <em>{copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}</em>
      </button>

      {isPublic ? <FollowBar issue={issue} user={me} compact onDone={(m) => mapNotify(m)} /> : null}

      <div className="mic-acts">
        <button type="button" className="mic-btn ghost" onClick={() => onRoute({ latitude: issue.lat, longitude: issue.lng, name: issue.title })}>
          <Navigation size={14} /> Route to issue
        </button>
        {mine ? (
          <button type="button" className="mic-btn go" onClick={openFile}>
            {r === "citizen" ? "Open my report" : "Open the file"} <ArrowUpRight size={14} />
          </button>
        ) : (
          <span className="mic-lock"><Lock size={12} /> Photos and notes stay with the reporter and the city</span>
        )}
      </div>
    </aside>
  );
}
