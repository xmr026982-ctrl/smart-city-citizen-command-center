import { weekDay, day } from "../../utils/time";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { X, Sparkles, CheckCircle2, Users, Flag, Camera, ShieldCheck, Lock, ArrowUpRight, EyeOff, Send, Plus, Minus } from "lucide-react";
import { useAuth } from "../../store/authStore";
import {
  CONCERNS, signalOf, concernOf, signalProposal, raiseConcern, addProposalPhoto, answerDue, visiblePhotos,
  MODERATION_REASONS, POLL_HOURS, decideProposal, respondToProposal, moderate,
} from "../../store/communityStore";
import { HoldButton } from "../issues/shared/RemovalKit";
import { PRIORITY_LABEL } from "../../constants/issuePriorities";
import "../../styles/removal.css";
import { preparePhoto } from "../../utils/photos";
import { StatusTag, SupportBar, ago, kindLabel } from "./kit";
import { CITY_COMMAND, FIELD_CREW, nameFor } from "../../store/profileStore";
import TextHint from "../ui/TextHint";
import { isMash } from "../../utils/textGuard";

/* ------------------------------------------------------------------
   Proposal file (drawer). What the city knows (evidence, added by the
   app), what people signal, what the city said, and where the decision
   stands. Citizens only send structured signals here.
------------------------------------------------------------------- */
const fmtDay = (d) => weekDay(d);

export default function ProposalDrawer({ p, ev, issues, onClose, startOn = "" }) {
  const me = useAuth();
  const navigate = useNavigate();
  const [concernOpen, setConcernOpen] = useState(startOn === "concern");
  const [photoErr, setPhotoErr] = useState("");
  const fileRef = useRef(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });
  useEffect(() => { setConcernOpen(startOn === "concern"); setPhotoErr(""); }, [p?.id, startOn]);
  useEffect(() => {
    if (!p) return undefined;
    const onKey = (e) => { if (e.key === "Escape") closeRef.current(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [p]);
  if (!p) return null;

  const roleTone = me?.role === "admin" ? "admin" : me?.role === "staff" ? "staff" : "citizen";
  const isCitizen = me?.role === "citizen";
  const isAdmin = me?.role === "admin";
  const open = p.status === "review";
  const mine = signalOf(p, me?.id);
  const myConcern = concernOf(p, me?.id);
  const byReason = CONCERNS.map((r) => [r, p.concerns.filter((c) => c.reason === r).length]).filter(([, n]) => n);
  const photos = visiblePhotos(p);
  const due = answerDue(p);
  const linked = (ev?.linked || []).map((id) => issues.find((i) => i.id === id)).filter(Boolean);
  const steps = [
    { t: "Proposed", s: ago(p.at), c: "done" },
    { t: "Under review", s: open ? `answer by ${fmtDay(due)}` : "done", c: open ? "now" : "done" },
    { t: "Decision", s: p.decision ? ago(p.decision.at) : "", c: p.decision ? "done" : "" },
    { t: "Outcome", s: p.decision ? (p.decision.issueId ? p.decision.issueId : p.decision.pollId ? p.decision.pollId : "published") : "issue · poll · plan", c: p.decision ? "done" : "" },
  ];

  const pickPhoto = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      const ph = await preparePhoto(f);
      if (!addProposalPhoto(p.id, me, ph)) setPhotoErr("This proposal already has the most photos it can hold.");
      else setPhotoErr("");
    } catch (err) {
      setPhotoErr(err.message);
    }
  };
  const toMap = (i) => navigate(`/map?${new URLSearchParams({ issueId: i.id, lat: String(i.lat), lng: String(i.lng), zone: i.ward })}`);

  return createPortal(
    <div className={`cx-layer tone-${roleTone}`} role="presentation">
      <div className="cx-scrim" onClick={onClose} aria-hidden />
      <aside className="cx-drawer" role="dialog" aria-modal="true" aria-label={`Proposal ${p.id}`}>
        <header className="cx-dhead">
          <span className="cx-dic"><Sparkles size={18} /></span>
          <div className="cx-did">
            <small>Community / Proposal</small>
            <b className="m">{p.id}</b>
          </div>
          <StatusTag status={p.status} />
          <button type="button" className="cx-x" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </header>

        <div className="cx-dbody">
          <div>
            <h2>{p.title}</h2>
            <p className="cx-dsum">{p.summary}</p>
            <p className="cx-dmeta">{p.ward} · {kindLabel(p.category)} · {p.by.id === me?.id ? "proposed by you" : "proposed by a resident"} · {ago(p.at)}</p>
          </div>

          {ev ? (
            <section className="cx-card">
              <p className="cx-kick"><i />City evidence · added automatically</p>
              <div className="cx-facts">
                <div><b>{ev.reports}</b><span>reports here</span><small>last 90 days</small></div>
                <div><b>{ev.breached}</b><span>missed their window</span><small>{ev.open} still open</small></div>
                <div><b>{ev.aqi || "–"}</b><span>zone air quality</span><small>live AQI</small></div>
              </div>
              <div className="cx-scoreline">
                <span className="cx-ring" style={{ "--v": ev.score }} aria-hidden />
                <div>
                  <b className="m">{ev.score} / 100</b> evidence score
                  <div className="cx-parts">
                    {ev.parts.filter((x) => x.value).map((x) => <span key={x.id} className={x.value < 0 ? "neg" : ""}>{x.label} {x.value > 0 ? `+${x.value}` : x.value}</span>)}
                  </div>
                </div>
              </div>
              {linked.length ? (
                <div className="cx-linked">
                  <span>Linked reports</span>
                  {linked.map((i) => <button key={i.id} type="button" className="m" onClick={() => toMap(i)} title={i.title}>{i.id}</button>)}
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="cx-card">
            <p className="cx-kick"><i />Signals</p>
            <SupportBar p={p} compact />
            <p className="cx-note">Residents: people whose home zone is {p.ward}. Everyone else who backs it is a supporter.</p>
            {byReason.length || photos.length ? (
              <div className="cx-chips">
                {byReason.map(([r, n]) => <span key={r} className="cx-tag warn">Concern · {r} {n}</span>)}
                {photos.length ? <span className="cx-tag ok"><Camera size={11} /> {photos.length} photo{photos.length === 1 ? "" : "s"}</span> : null}
              </div>
            ) : null}
            {photos.length ? (
              isAdmin ? <PhotoModeration p={p} photos={photos} me={me} /> : <div className="cx-photos">{photos.slice(0, 6).map((ph) => <img key={ph.id} src={ph.url} alt="" />)}</div>
            ) : null}
            {open && isCitizen ? (
              <>
                <div className="cx-sig">
                  <button type="button" className={mine === "affects" ? "on" : ""} aria-pressed={mine === "affects"} onClick={() => signalProposal(p.id, me, "affects")}><CheckCircle2 size={13} /> Affects me</button>
                  <button type="button" className={mine === "use" ? "on" : ""} aria-pressed={mine === "use"} onClick={() => signalProposal(p.id, me, "use")}><Users size={13} /> I&apos;d use this</button>
                  <button type="button" className={myConcern || concernOpen ? "on warn" : ""} aria-expanded={concernOpen} onClick={() => setConcernOpen((v) => !v)}><Flag size={13} /> {myConcern ? `Concern · ${myConcern}` : "Raise a concern"}</button>
                  <button type="button" onClick={() => fileRef.current?.click()}><Camera size={13} /> Add a photo</button>
                  <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={pickPhoto} />
                </div>
                {concernOpen ? (
                  <div className="cx-concerns" role="radiogroup" aria-label="Your concern">
                    {CONCERNS.map((r) => (
                      <button key={r} type="button" role="radio" aria-checked={myConcern === r} className={myConcern === r ? "on" : ""} onClick={() => { raiseConcern(p.id, me, r); setConcernOpen(false); }}>{r}</button>
                    ))}
                    {myConcern ? <button type="button" className="clear" onClick={() => { raiseConcern(p.id, me, null); setConcernOpen(false); }}>Take my concern back</button> : null}
                  </div>
                ) : null}
                {photoErr ? <p className="cx-err">{photoErr}</p> : null}
              </>
            ) : open ? (
              <p className="cx-note"><Users size={11} /> Signals come from citizens. Command answers with a decision.</p>
            ) : (
              <p className="cx-note"><Lock size={11} /> Decided · signals are closed.</p>
            )}
          </section>

          {p.responses.filter((r) => !r.hidden).map((r) => (
            <section key={r.id} className="cx-official">
              <span className="cx-oic"><ShieldCheck size={15} /></span>
              <div>
                <small>Official response · {r.role === "admin" ? CITY_COMMAND : FIELD_CREW}{me?.role === "citizen" ? "" : ` · ${nameFor(r.by)}`} · {ago(r.at)}</small>
                <p>{r.body}</p>
              </div>
            </section>
          ))}

          {!isCitizen ? <ResponseComposer p={p} me={me} /> : null}
          {isAdmin && open ? <AdminDecide p={p} me={me} ev={ev} /> : null}

          {p.decision ? (
            <section className={`cx-card cx-decision t-${p.decision.status}`}>
              <p className="cx-kick"><i />Decision</p>
              <b><StatusTag status={p.decision.status} /></b>
              <p>{p.decision.reason}</p>
              {p.decision.issueId ? (
                <button type="button" className="cx-btn sm" onClick={() => { const i = issues.find((x) => x.id === p.decision.issueId); if (i) toMap(i); }}>Follow {p.decision.issueId} on the map <ArrowUpRight size={12} /></button>
              ) : null}
              {p.decision.pollId ? (
                <button type="button" className="cx-btn sm" onClick={() => { onClose(); navigate("/community", { state: { poll: p.decision.pollId } }); }}>Open poll {p.decision.pollId} <ArrowUpRight size={12} /></button>
              ) : null}
            </section>
          ) : null}

          <section className="cx-card">
            <p className="cx-kick"><i />Decision path</p>
            <div className="cx-path">
              {steps.map((s) => (
                <div key={s.t} className={`cx-step ${s.c}`}><i /><div>{s.t}<small>{s.s}</small></div></div>
              ))}
            </div>
          </section>
        </div>
      </aside>
    </div>,
    document.body
  );
}

/* admin: hide a photo (never deleted), with a reason, on the record */
function PhotoModeration({ p, photos, me }) {
  const [pick, setPick] = useState(null);
  return (
    <>
      <div className="cx-photos mod">
        {photos.slice(0, 12).map((ph) => (
          <button key={ph.id} type="button" className={pick === ph.id ? "on" : ""} onClick={() => setPick(pick === ph.id ? null : ph.id)} title="Moderate this photo">
            <img src={ph.url} alt="" /><span><EyeOff size={12} /></span>
          </button>
        ))}
      </div>
      {pick ? (
        <div className="cx-concerns" role="radiogroup" aria-label="Why hide it">
          <span className="cx-mod-k">Hide this photo because</span>
          {MODERATION_REASONS.map((r) => <button key={r} type="button" onClick={() => { moderate(me, { type: "photo", proposalId: p.id, photoId: pick }, r); setPick(null); }}>{r}</button>)}
        </div>
      ) : null}
    </>
  );
}

/* admin / field crew: an official response, on the record */
function ResponseComposer({ p, me }) {
  const [text, setText] = useState("");
  const send = () => { if (respondToProposal(p.id, me, text)) setText(""); };
  return (
    <section className="cx-card">
      <p className="cx-kick"><i />Official response · {me?.role === "admin" ? "City command" : "Field crew"}</p>
      <textarea className="cx-ta" rows={2} maxLength={400} value={text} onChange={(e) => setText(e.target.value)} placeholder="What the city is doing about it, in plain words. Everyone following this proposal sees it." />
      <TextHint text={text} />
      <div className="cx-row"><small>{text.length}/400 · citizens see it from {me?.role === "admin" ? "City Command" : "the field crew"}</small><button type="button" className="cx-btn sm go" disabled={text.trim().length < 6 || isMash(text)} onClick={send}><Send size={13} /> Post response</button></div>
    </section>
  );
}

const OUTCOMES = ["approved", "planned", "issue", "poll", "notnow"];
const ACTION = { approved: "Approve", planned: "Plan it", issue: "Turn into an issue", poll: "Move to a poll", notnow: "Not now" };
const HINT = {
  approved: "Agreed in principle; the plan follows.",
  planned: "Scheduled works: say when.",
  issue: "Becomes a work order on the issue board, filed for its author.",
  poll: "Neighbours choose between options first.",
  notnow: "Not this time: the reason is public.",
};

/* admin: decide (one decision, public, notifies the author and everyone who backed it) */
function AdminDecide({ p, me, ev }) {
  const [status, setStatus] = useState("planned");
  const [reason, setReason] = useState("");
  const [priority, setPriority] = useState(ev && ev.score >= 70 ? "high" : "medium");
  const [question, setQuestion] = useState(`Which option should go ahead for "${p.title}"?`);
  const [options, setOptions] = useState(["", ""]);
  const [hours, setHours] = useState(48);
  const [err, setErr] = useState("");
  const publish = () => {
    const res = decideProposal(p.id, me, status, reason, { priority, question, options, hours });
    if (!res.ok) setErr(res.reason);
  };
  const ready = reason.trim().length >= 6 && !isMash(reason) && (status !== "poll" || (options.filter((o) => o.trim()).length >= 2 && !isMash(question, { title: true }) && !options.some((o) => isMash(o, { title: true }))));
  return (
    <section className="cx-card cx-decide">
      <p className="cx-kick"><i />Decide · answer due {day(answerDue(p))}</p>
      <div className="cx-seg">
        {OUTCOMES.map((o) => <button key={o} type="button" className={status === o ? "on" : ""} aria-pressed={status === o} onClick={() => { setStatus(o); setErr(""); }}>{ACTION[o]}</button>)}
      </div>
      <p className="cx-note">{HINT[status]}</p>
      {status === "issue" ? (
        <label className="cx-field"><span>Priority</span>
          <div className="cx-seg">{["low", "medium", "high", "critical"].map((x) => <button key={x} type="button" className={priority === x ? "on" : ""} onClick={() => setPriority(x)}>{PRIORITY_LABEL[x]}</button>)}</div>
        </label>
      ) : null}
      {status === "poll" ? (
        <>
          <label className="cx-field"><span>Question</span><input value={question} maxLength={120} onChange={(e) => setQuestion(e.target.value)} /><TextHint text={question} title /></label>
          <div className="cx-field"><span>Options <em>2 to 4</em></span>
            {options.map((o, k) => (
              <div key={k} className="cx-optrow">
                <input value={o} maxLength={60} placeholder={`Option ${k + 1}`} onChange={(e) => setOptions(options.map((x, j) => (j === k ? e.target.value : x)))} />
                {options.length > 2 ? <button type="button" className="cx-x sm" aria-label="Remove option" onClick={() => setOptions(options.filter((_, j) => j !== k))}><Minus size={13} /></button> : null}
              </div>
            ))}
            {options.length < 4 ? <button type="button" className="cx-add" onClick={() => setOptions([...options, ""])}><Plus size={13} /> Add option</button> : null}
            <TextHint text={options.find((o) => isMash(o, { title: true })) || ""} title />
          </div>
          <label className="cx-field"><span>Open for</span>
            <div className="cx-seg">{POLL_HOURS.map((h) => <button key={h} type="button" className={hours === h ? "on" : ""} onClick={() => setHours(h)}>{h < 168 ? `${h / 24} day${h === 24 ? "" : "s"}` : "1 week"}</button>)}</div>
          </label>
        </>
      ) : null}
      <label className="cx-field"><span>Reason people will read <em>{reason.length}/240</em></span>
        <textarea className="cx-ta" rows={2} maxLength={240} value={reason} onChange={(e) => { setReason(e.target.value); setErr(""); }} placeholder={status === "notnow" ? "Why not now, and what would change it." : "What happens next, and when."} />
        <TextHint text={reason} />
      </label>
      {err ? <p className="cx-err" role="alert">{err}</p> : null}
      <div className="cx-row"><small>Notifies the author and everyone who backed it · logged</small><HoldButton label="Hold to publish decision" hint="Keep holding" disabled={!ready} onConfirm={publish} icon={ShieldCheck} /></div>
    </section>
  );
}
