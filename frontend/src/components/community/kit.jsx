import { weekClock } from "../../utils/time";
import { useNavigate } from "react-router-dom";
import { Megaphone, ShieldCheck, Wrench, Vote, CheckCircle2, AlertTriangle, Users, Flag, Sparkles, ArrowUpRight } from "lucide-react";
import { useAuth } from "../../store/authStore";
import {
  PROPOSAL_STATUS, residentsOf, supportersOf, signalOf, signalProposal, pollTotals, pollOpen, votePoll,
  issueSignalOf, issueSignalCount, signalIssue,
} from "../../store/communityStore";
import { CATEGORY_LABEL } from "../../constants/issueCategories";
import { CITY_COMMAND, nameFor } from "../../store/profileStore";
import { STATUS_LABEL, publicStatus } from "../../constants/issueStatuses";
import FollowBar from "../issues/citizen/FollowBar";

/* ------------------------------------------------------------------
   Community cards, shared by the citizen board (and the command and
   field boards in the next batches): announcement, work notice,
   proposal, poll, fixed issue. One look, role accent via --a.
------------------------------------------------------------------- */
export const kindLabel = (c) => (c === "other" ? "Public space" : CATEGORY_LABEL[c] || "General");
export const ago = (iso) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
};
export const left = (iso) => {
  const m = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  if (m <= 0) return "closed";
  if (m < 60) return `${m} min left`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h left`;
  return `${Math.round(h / 24)} days left`;
};
const hm = (iso) => weekClock(iso);

export function StatusTag({ status }) {
  const st = PROPOSAL_STATUS[status] || { label: status, tone: "muted" };
  return <span className={`cx-tag ${st.tone}`}>{st.label}</span>;
}

export function AnnouncementCard({ a, focused }) {
  return (
    <article className={`cx-post${focused ? " focus" : ""}`} id={`cx-${a.id}`}>
      <div className="cx-meta">
        <span className="cx-tag amber"><Megaphone size={11} /> Announcement</span>
        <span className="cx-tag acc"><ShieldCheck size={11} /> City command</span>
        <span>{a.zones.includes("all") ? "Every zone" : a.zones.join(", ")} · {ago(a.at)}</span>
      </div>
      <h3>{a.title}</h3>
      {a.body ? <p className="cx-body">{a.body}</p> : null}
    </article>
  );
}

export function NoticeCard({ n, focused, onOpenFile }) {
  return (
    <article className={`cx-post${focused ? " focus" : ""}`} id={`cx-${n.id}`}>
      <div className="cx-meta">
        <span className="cx-tag warn"><Wrench size={11} /> Work notice</span>
        <span className="cx-tag acc">Field crew</span>
        {onOpenFile ? (
          <button type="button" className="m cx-ref link" onClick={() => onOpenFile(n.issueId)} title={`Open ${n.issueId}`}>{n.issueId} <ArrowUpRight size={10} /></button>
        ) : <span className="m cx-ref">{n.issueId}</span>}
        <span>{n.ward} · {ago(n.at)}</span>
      </div>
      <h3>{n.kind} · {hm(n.from)} to {hm(n.to)} IST</h3>
      {n.note ? <p className="cx-body">{n.note}</p> : null}
    </article>
  );
}

export function SupportBar({ p, compact = false }) {
  const r = residentsOf(p);
  const sup = supportersOf(p);
  const pct = Math.min(100, Math.round((r / Math.max(1, p.target)) * 100));
  const extra = Math.min(100 - pct, Math.round((sup / Math.max(1, p.target)) * 100));
  return (
    <div className={`cx-support${compact ? " compact" : ""}`}>
      <span><b>{r} resident{r === 1 ? "" : "s"}</b> · {sup} supporter{sup === 1 ? "" : "s"} elsewhere{p.concerns.length ? ` · ${p.concerns.length} concern${p.concerns.length === 1 ? "" : "s"}` : ""}</span>
      <span className="m cx-target">{r >= p.target ? "TARGET MET" : `TARGET ${p.target}`}</span>
      <div className="cx-bar"><i style={{ width: `${pct}%` }} /><i className="soft" style={{ width: `${extra}%` }} /></div>
    </div>
  );
}

export function ProposalCard({ p, ev, onOpen, focused }) {
  const me = useAuth();
  const mine = signalOf(p, me?.id);
  const open = p.status === "review";
  const affects = p.signals.filter((s) => s.kind === "affects").length;
  const use = p.signals.filter((s) => s.kind === "use").length;
  return (
    <article className={`cx-post${focused ? " focus" : ""}`} id={`cx-${p.id}`}>
      <div className="cx-meta">
        <span className="cx-tag acc"><Sparkles size={11} /> Proposal</span>
        <button type="button" className="m cx-ref link" onClick={() => onOpen(p.id)}>{p.id}</button>
        <span>{p.by.id === me?.id ? "by you" : "by a resident"} · {ago(p.at)}</span>
        <StatusTag status={p.status} />
      </div>
      <h3><button type="button" className="cx-title" onClick={() => onOpen(p.id)}>{p.title}</button></h3>
      {ev ? (
        <div className="cx-ev">
          <span className="m">EVIDENCE</span>
          <span>
            <b>{ev.reports} report{ev.reports === 1 ? "" : "s"}</b> here in 90 days
            {ev.breached ? <> · <b>{ev.breached} missed</b> their window</> : null}
            {ev.aqi ? <> · zone AQI <b>{ev.aqi}</b></> : null}
            {" · "}{kindLabel(p.category)}
          </span>
          <span className="cx-score m">{ev.score}</span>
        </div>
      ) : null}
      <SupportBar p={p} />
      {open && me?.role !== "citizen" ? (
        <div className="cx-sig"><button type="button" className="ghost" onClick={() => onOpen(p.id)}>Open the proposal <ArrowUpRight size={12} /></button></div>
      ) : open ? (
        <div className="cx-sig">
          <button type="button" className={mine === "affects" ? "on" : ""} aria-pressed={mine === "affects"} onClick={() => signalProposal(p.id, me, "affects")}><CheckCircle2 size={13} /> Affects me <b>{affects}</b></button>
          <button type="button" className={mine === "use" ? "on" : ""} aria-pressed={mine === "use"} onClick={() => signalProposal(p.id, me, "use")}><Users size={13} /> I&apos;d use this <b>{use}</b></button>
          <button type="button" onClick={() => onOpen(p.id, "concern")}><Flag size={13} /> Raise a concern</button>
          <button type="button" className="ghost" onClick={() => onOpen(p.id)}>Open <ArrowUpRight size={12} /></button>
        </div>
      ) : (
        <p className="cx-decided">{p.decision?.reason || "Decided"}{p.decision?.by ? <span> · {me?.role === "citizen" ? CITY_COMMAND : nameFor(p.decision.by)}, {ago(p.decision.at)}</span> : null}</p>
      )}
    </article>
  );
}

export function PollCard({ poll, focused, compact = false }) {
  const me = useAuth();
  const { counts, total } = pollTotals(poll);
  const live = pollOpen(poll);
  const mine = poll.votes?.[me?.id] || null;
  const showResults = Boolean(mine) || !live;
  const winner = poll.outcome?.optionId;
  return (
    <article className={`cx-poll${compact ? " compact" : ""}${focused ? " focus" : ""}`} id={`cx-${poll.id}`}>
      <div className="cx-meta">
        <span className={`cx-tag ${live ? "acc" : "muted"}`}><Vote size={11} /> {live ? `Poll · ${left(poll.closesAt)}` : "Poll · closed"}</span>
        <span className="m">{total} votes</span>
      </div>
      <h3>{poll.question}</h3>
      <div className="cx-opts" role="radiogroup" aria-label={poll.question}>
        {poll.options.map((o) => {
          const pct = total ? Math.round((counts[o.id] / total) * 100) : 0;
          return (
            <button
              key={o.id} type="button" role="radio" aria-checked={mine === o.id} disabled={!live}
              className={`cx-opt${mine === o.id ? " mine" : ""}${winner === o.id ? " win" : ""}`}
              style={{ "--p": showResults ? `${pct}%` : "0%" }}
              onClick={() => votePoll(poll.id, me, o.id)}
            >
              <i aria-hidden />
              <span>{o.label}</span>
              {showResults ? <b>{pct}%</b> : null}
            </button>
          );
        })}
      </div>
      <small className="cx-foot">
        {!live
          ? poll.outcome ? <>Outcome · {poll.outcome.note}</> : "Closed · outcome to follow"
          : mine ? "You voted · you can change it until the poll closes" : "One vote per person · results show after you vote"}
      </small>
    </article>
  );
}

export function FixedCard({ issue, focused }) {
  const me = useAuth();
  const navigate = useNavigate();
  const mine = issueSignalOf(issue.id, me?.id);
  const done = [...(issue.timeline || [])].reverse().find((t) => t.status === "resolved");
  return (
    <article className={`cx-post${focused ? " focus" : ""}`} id={`cx-${issue.id}`}>
      <div className="cx-meta">
        <span className="cx-tag ok"><CheckCircle2 size={11} /> Fixed near you</span>
        <button type="button" className="m cx-ref link" onClick={() => navigate(`/map?${new URLSearchParams({ issueId: issue.id, lat: String(issue.lat), lng: String(issue.lng), zone: issue.ward })}`)}>{issue.id}</button>
        <span>{issue.ward} · resolved {done ? ago(done.at) : ""}</span>
      </div>
      <h3>{issue.title}{issue.assignedTo ? <span className="cx-by"> · fixed by {me?.role === "citizen" ? "the field crew" : nameFor(issue.assignedTo)}</span> : null}</h3>
      <div className="cx-sig">
        <button type="button" className={mine === "fixed" ? "on" : ""} aria-pressed={mine === "fixed"} onClick={() => signalIssue(issue.id, me, "fixed")}><CheckCircle2 size={13} /> Fixed now <b>{issueSignalCount(issue.id, "fixed")}</b></button>
        <button type="button" className={mine === "still" ? "on warn" : ""} aria-pressed={mine === "still"} onClick={() => signalIssue(issue.id, me, "still")}><AlertTriangle size={13} /> Still happening <b>{issueSignalCount(issue.id, "still")}</b></button>
      </div>
    </article>
  );
}

/* Someone else's open report in this zone: the public card (no reporter, no
   photos, no notes) with Affects me too / Follow. */
export function OpenReportCard({ issue, focused, onDone }) {
  const me = useAuth();
  const navigate = useNavigate();
  const st = publicStatus(issue.status);
  return (
    <article className={`cx-post${focused ? " focus" : ""}`} id={`cx-${issue.id}`}>
      <div className="cx-meta">
        <span className="cx-tag acc"><Flag size={11} /> Open report</span>
        <button type="button" className="m cx-ref link" title="See it on the map" onClick={() => navigate(`/map?${new URLSearchParams({ issueId: issue.id, lat: String(issue.lat), lng: String(issue.lng), zone: issue.ward })}`)}>{issue.id}</button>
        <span>{issue.ward} · {kindLabel(issue.category)} · reported {ago(issue.createdAt)}</span>
        <span className={`cx-tag ${st === "in_progress" ? "warn" : "muted"}`}>{STATUS_LABEL[st] || st}</span>
      </div>
      <h3>{issue.title}</h3>
      <FollowBar issue={issue} user={me} onDone={onDone} />
    </article>
  );
}
