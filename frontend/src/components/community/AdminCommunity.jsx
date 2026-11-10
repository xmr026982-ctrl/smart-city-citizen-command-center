import { cutoff } from "../../utils/time";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { Sparkles, Vote, CheckCircle2, EyeOff, Megaphone, X, Plus, Minus, ShieldCheck, Wrench } from "lucide-react";
import { useAuth } from "../../store/authStore";
import { useAllIssues } from "../../store/issueStore";
import {
  useCommunity, residentsOf, answerDue, pollOpen, pollEnded, pollTotals, openPoll, closePoll, publishAnnouncement, moderate,
  announcementLive, noticeLive, MODERATION_REASONS, POLL_HOURS,
} from "../../store/communityStore";
import { useLiveFeed } from "../../hooks/useLiveFeed";
import { useMinute } from "../../hooks/useMinute";
import { useToast } from "../ui/Toast";
import { useUrlParam, useUrlDrawer, useSetParams } from "../../hooks/useUrlParam";
import { WARDS } from "../../constants/issueConstants";
import { evidenceFor } from "../../utils/evidence";
import { HoldButton } from "../issues/shared/RemovalKit";
import { SortBar, LensDeck } from "../issues/admin/CommandKit";
import { nameFor } from "../../store/profileStore";
import TextHint from "../ui/TextHint";
import { isMash } from "../../utils/textGuard";
import { StatusTag, ago, left } from "./kit";
import ProposalDrawer from "./ProposalDrawer";
import "../../styles/removal.css";

/* ------------------------------------------------------------------
   Community Command (admin). Proposals ranked by the city's evidence,
   polls with live results (closed with a published outcome),
   announcements by zone and audience, work notices, and moderation on
   the record. Every action notifies the right people and is logged.
   The view lives in the address:
     ?tab=proposals&show=decide&zone=Ballygunge&sort=residents-asc&p=PRP-0107
   Tabs and an open proposal are steps Back returns through; zone, sort
   and the tile lens just update the address.
------------------------------------------------------------------- */
const ZONE_NAMES = WARDS.map((w) => w.name);
const TABS = [
  { id: "proposals", label: "Proposals" },
  { id: "polls", label: "Polls" },
  { id: "announcements", label: "Announcements" },
  { id: "notices", label: "Work notices" },
  { id: "log", label: "Moderation log" },
];
const SORTS = [
  { id: "evidence", label: "Evidence", dir: "desc", desc: "Strongest case first", asc: "Weakest case first" },
  { id: "residents", label: "Residents", dir: "desc", desc: "Most residents first", asc: "Fewest residents first" },
  { id: "due", label: "Answer due", dir: "asc", asc: "Answer due soonest", desc: "Answer due latest" },
  { id: "new", label: "Newest", dir: "desc", desc: "Newest first", asc: "Oldest first" },
];
const MONTH = 30 * 864e5;
/* the tiles: each is a tab plus, for proposals and polls, a lens */
const LENSES = { decide: "proposals", outcomes: "proposals", live: "polls" };
const SORT_KEYS = SORTS.flatMap((o) => [`${o.id}-desc`, `${o.id}-asc`]);

export default function AdminCommunity() {
  const me = useAuth();
  const c = useCommunity();
  const issues = useAllIssues();
  const feed = useLiveFeed();
  const minute = useMinute();
  const location = useLocation();
  const { toast } = useToast();
  const setParams = useSetParams();
  const [tab] = useUrlParam("tab", { allowed: TABS.map((t) => t.id), fallback: "proposals" });
  const [zone, setZone] = useUrlParam("zone", { allowed: ZONE_NAMES, fallback: "all" });
  const [sortKey, setSortKey] = useUrlParam("sort", { allowed: SORT_KEYS, fallback: "evidence-desc" });
  const sort = { id: sortKey.split("-")[0], dir: sortKey.split("-")[1] };
  const setSort = ({ id, dir }) => setSortKey(`${id}-${dir}`);
  const [showRaw] = useUrlParam("show", { allowed: Object.keys(LENSES) });
  const lens = showRaw && LENSES[showRaw] === tab ? showRaw : "all"; // a lens only holds on its own tab
  // a tab is a step Back returns to; it drops the lens
  const setTab = (id, { push = true } = {}) => { if (id !== tab || showRaw) setParams({ tab: id === "proposals" ? "" : id, show: "" }, { push }); };
  const [openId, setOpenId, closeDrawer] = useUrlDrawer("p");
  const [pollDoor, setPollDoor] = useState(null); // null | { from }
  const [focus, setFocus] = useState(null);
  const composerRef = useRef(null);

  // arrivals from notifications: { open: PRP } or { poll: POL } / { focus: ANN }
  useEffect(() => {
    const st = location.state;
    if (!st) return;
    // one replace that lands on the right tab and clears the arrival; the zone stays
    if (st.open) setParams({ tab: "", show: "", p: st.open });
    else if (st.poll) setParams({ tab: "polls", show: "" });
    else if (st.focus) setParams({ tab: String(st.focus).startsWith("WN") ? "notices" : "announcements", show: "" });
    else setParams({});
    const id = st.poll || st.focus;
    if (id) {
      setFocus(id);
      setTimeout(() => document.getElementById(`cx-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 150);
      setTimeout(() => setFocus(null), 2600);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  const inZone = (w) => zone === "all" || w === zone || w === "all";
  const ev = useMemo(() => Object.fromEntries(c.proposals.map((p) => [p.id, evidenceFor(p, issues, feed)])),
    // evidence's air quality follows the minute, not every feed tick
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [c.proposals, issues, minute]);

  const review = c.proposals.filter((p) => p.status === "review");
  const overdue = review.filter((p) => answerDue(p).getTime() < Date.now());
  const live = c.polls.filter(pollOpen);
  const ended = c.polls.filter(pollEnded);
  const weekVotes = live.reduce((s, p) => s + pollTotals(p).total, 0);
  const outcomes = c.proposals.filter((p) => p.decision && Date.now() - new Date(p.decision.at).getTime() < MONTH).length + c.polls.filter((p) => p.outcome && Date.now() - new Date(p.outcome.at).getTime() < MONTH).length;
  const modLog = c.trail.filter((e) => e.n?.type === "moderated");

  const proposals = useMemo(() => {
    let list = c.proposals.filter((p) => inZone(p.ward));
    if (lens === "decide") list = list.filter((p) => p.status === "review");
    if (lens === "outcomes") list = list.filter((p) => p.decision);
    const key = { evidence: (p) => ev[p.id]?.score || 0, residents: (p) => residentsOf(p), due: (p) => answerDue(p).getTime(), new: (p) => new Date(p.at).getTime() }[sort.id];
    const sign = sort.dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => sign * (key(a) - key(b)) || new Date(b.at) - new Date(a.at));
  }, [c.proposals, zone, sort, lens, ev]);

  const TILES = [
    { id: "decide", tab: "proposals", label: "To decide", icon: Sparkles, value: review.length, sub: overdue.length ? `${overdue.length} past their answer date` : "All within their week", meter: c.proposals.length ? (review.length / c.proposals.length) * 100 : 0, tone: overdue.length ? "amber" : undefined },
    { id: "live", tab: "polls", label: "Live polls", icon: Vote, value: live.length, sub: ended.length ? `${ended.length} ended · outcome to publish` : `${weekVotes} votes so far`, meter: c.polls.length ? (live.length / c.polls.length) * 100 : 0, tone: "ink" },
    { id: "outcomes", tab: "proposals", label: "Outcomes", icon: CheckCircle2, value: outcomes, sub: "Published this month", meter: outcomes ? 100 : 0, tone: "green" },
    { id: "moderation", tab: "log", label: "Moderation", lens: "Moderation log", icon: EyeOff, value: modLog.length, sub: modLog.length ? `Last: ${modLog[0].n.label}` : "Nothing hidden", meter: modLog.length ? 100 : 0, tone: "amber" },
  ];
  // the tile that is lit: a lens on its own tab, or the log tab itself
  const tileOn = lens !== "all" ? lens : tab === "log" ? "moderation" : "all";
  const openP = c.proposals.find((p) => p.id === openId) || null;
  const pollList = c.polls.filter((p) => inZone(p.ward) && (lens !== "live" || pollOpen(p) || (pollEnded(p) && !p.outcome)));

  return (
    <main className="page cx tone-admin">
      <header className="cx-head">
        <div>
          <p className="cx-kick"><i />Command · Community</p>
          <h1>Community Command</h1>
          <p className="cx-sub">Proposals ranked by the city&apos;s own evidence, polls with live results, announcements by zone, and moderation on the record.</p>
        </div>
        <div className="cx-acts">
          <button type="button" className="cx-btn" onClick={() => setPollDoor({ from: null })}><Vote size={15} /> Open a poll</button>
          <button type="button" className="cx-btn go" onClick={() => { composerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); composerRef.current?.querySelector("input")?.focus(); }}><Megaphone size={15} /> Publish announcement</button>
        </div>
      </header>

      <LensDeck
        value={tileOn}
        onChange={(id) => {
          if (id === "all") { setParams({ tab: "", show: "" }, { push: tab !== "proposals" }); return; }
          const t = TILES.find((x) => x.id === id);
          setParams({ tab: t.tab === "proposals" ? "" : t.tab, show: LENSES[id] ? id : "" }, { push: t.tab !== tab });
        }}
        readout={tab === "proposals" ? `${proposals.length} proposal${proposals.length === 1 ? "" : "s"}${zone === "all" ? "" : ` in ${zone}`}` : tab === "polls" ? `${pollList.length} poll${pollList.length === 1 ? "" : "s"}` : `${modLog.length} on the record`}
        tiles={TILES}
      />

      <nav className="cx-chips-row" aria-label="Sections">
        {TABS.map((t) => {
          const n = { proposals: proposals.length, polls: c.polls.filter((p) => inZone(p.ward)).length, announcements: c.announcements.filter((a) => announcementLive(a) && (zone === "all" || a.zones.includes(zone) || a.zones.includes("all"))).length, notices: c.notices.filter((x) => inZone(x.ward) && noticeLive(x, issues)).length, log: modLog.length }[t.id];
          return <button key={t.id} type="button" className={`cx-chip${tab === t.id ? " on" : ""}`} onClick={() => setTab(t.id)}>{t.label} <b className="cx-n">{n}</b></button>;
        })}
        <span className="cx-grow" />
        <select className="cx-select" value={zone} onChange={(e) => setZone(e.target.value)} aria-label="Zone">
          <option value="all">All 6 zones</option>
          {ZONE_NAMES.map((z) => <option key={z} value={z}>{z}</option>)}
        </select>
      </nav>
      {tab === "proposals" ? (
        <div className="cx-sortrow"><SortBar options={SORTS} value={sort.id} dir={sort.dir} onChange={(id, dir) => setSort({ id, dir })} /></div>
      ) : null}

      <div className="cx-cols">
        <section className="cx-feed" aria-label={TABS.find((t) => t.id === tab).label}>
          {tab === "proposals" ? (
            <>
              <div className="cx-qrow head" aria-hidden><span>Proposal</span><span>Evidence</span><span>Residents</span><span>Status</span></div>
              {proposals.length ? proposals.map((p) => {
                const e = ev[p.id];
                const r = residentsOf(p);
                const late = p.status === "review" && answerDue(p).getTime() < Date.now();
                const reasons = [...new Set(p.concerns.map((x) => x.reason))];
                return (
                  <button key={p.id} type="button" className="cx-qrow" onClick={() => setOpenId(p.id)}>
                    <span className="cx-qt">
                      <b title={p.title}>{p.title}</b>
                      <small><em className="m">{p.id}</em><span>{p.ward}</span><span>{ago(p.at)}</span></small>
                      {p.concerns.length || late ? (
                        <small className="cx-qn">
                          {late ? <span className="late">Answer overdue</span> : null}
                          {p.concerns.length ? <span className="warn" title={reasons.join(", ")}>{p.concerns.length} concern{p.concerns.length === 1 ? "" : "s"}: {reasons.slice(0, 2).join(", ").toLowerCase()}</span> : null}
                        </small>
                      ) : null}
                    </span>
                    <span className="cx-qs" title="Evidence score"><span className="cx-ring" style={{ "--v": e?.score || 0 }} aria-hidden /><b className="m">{e?.score ?? "–"}</b><em>Evidence</em></span>
                    <span className="cx-qr"><b>{r} / {p.target}<em> residents</em></b><i><u style={{ width: `${Math.min(100, (r / p.target) * 100)}%` }} /></i></span>
                    <span className="cx-qa">{p.status === "review" ? <span className="cx-btn sm go as">Decide</span> : <StatusTag status={p.status} />}</span>
                  </button>
                );
              }) : <div className="cx-empty">No proposals in this view.</div>}
            </>
          ) : null}

          {tab === "polls" ? (
            pollList.length ? pollList.sort((a, b) => (pollEnded(b) - pollEnded(a)) || (pollOpen(b) - pollOpen(a)) || new Date(b.opensAt) - new Date(a.opensAt)).map((p) => (
              <AdminPoll key={p.id} poll={p} me={me} focused={focus === p.id} proposals={c.proposals} onOpenProposal={setOpenId} toast={toast} />
            )) : <div className="cx-empty">No polls in this view. Open one from a proposal or from the button above.</div>
          ) : null}

          {tab === "announcements" ? (
            c.announcements.filter((a) => zone === "all" || a.zones.includes(zone) || a.zones.includes("all")).map((a) => (
              <ModRow key={a.id} id={a.id} focused={focus === a.id} hidden={a.hidden} icon={Megaphone} kick={`${a.id} · ${a.zones.includes("all") ? "every zone" : a.zones.join(", ")} · ${[a.audience.citizens && "citizens", a.audience.staff && "field crews"].filter(Boolean).join(" + ")}`} title={a.title} body={a.body}
                meta={announcementLive(a) ? `Live · until ${cutoff(a.until)}` : a.hidden ? `Withdrawn · ${a.hidden.reason}` : "Ended"}
                onHide={announcementLive(a) ? (r) => moderate(me, { type: "announcement", id: a.id }, r) : null} />
            ))
          ) : null}

          {tab === "notices" ? (
            c.notices.filter((x) => inZone(x.ward)).length ? c.notices.filter((x) => inZone(x.ward)).map((x) => (
              <ModRow key={x.id} id={x.id} focused={focus === x.id} hidden={x.hidden} icon={Wrench} kick={`${x.id} · ${x.issueId} · ${x.ward} · ${nameFor(x.by)}`} title={`${x.kind} · ${new Date(x.from).toLocaleString("en-IN", { weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false })} to ${new Date(x.to).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })}`} body={x.note}
                meta={noticeLive(x, issues) ? "Live" : x.hidden ? `Withdrawn · ${x.hidden.reason}` : "Ended"}
                onHide={noticeLive(x, issues) ? (r) => moderate(me, { type: "notice", id: x.id }, r) : null} />
            )) : <div className="cx-empty">No work notices in this view. Field crews post them on their own files.</div>
          ) : null}

          {tab === "log" ? (
            modLog.length ? modLog.map((e) => (
              <div key={e.id} className="cx-post">
                <div className="cx-meta"><span className="cx-tag warn"><EyeOff size={11} /> Hidden</span><span>{nameFor(e.actor)} · {ago(e.at)}</span></div>
                <h3>{e.n.label} · {e.n.reason}</h3>
              </div>
            )) : <div className="cx-empty">Nothing has been hidden. Every hide is listed here and in the Audit Log.</div>
          ) : null}
        </section>

        <aside className="cx-rail">
          <AnnouncementComposer me={me} innerRef={composerRef} toast={toast} />
          {live[0] ? (
            <div className="cx-card pad">
              <AdminPoll poll={[...live].sort((a, b) => new Date(a.closesAt) - new Date(b.closesAt))[0]} me={me} compact proposals={c.proposals} onOpenProposal={setOpenId} toast={toast} />
            </div>
          ) : null}
        </aside>
      </div>

      <ProposalDrawer p={openP} ev={openP ? ev[openP.id] : null} issues={issues} onClose={closeDrawer} />
      <PollDoor state={pollDoor} me={me} proposals={c.proposals} issues={issues} onClose={() => setPollDoor(null)} onOpened={(id) => { setPollDoor(null); setTab("polls"); setFocus(id); toast(`Poll ${id} is open · the zone is notified`); setTimeout(() => setFocus(null), 2600); }} />
    </main>
  );
}

/* a poll, command side: live results, close with an outcome */
function AdminPoll({ poll, me, compact = false, focused = false, proposals, onOpenProposal, toast }) {
  const { counts, total } = pollTotals(poll);
  const top = [...poll.options].sort((a, b) => counts[b.id] - counts[a.id])[0];
  const [closing, setClosing] = useState(false);
  const [pick, setPick] = useState(top?.id);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const liveNow = pollOpen(poll);
  const ended = pollEnded(poll);
  const src = poll.from?.type === "proposal" ? proposals.find((p) => p.id === poll.from.id) : null;
  const close = () => {
    const res = closePoll(poll.id, me, pick, note);
    if (!res.ok) { setErr(res.reason); return; }
    setClosing(false); toast(`Poll ${poll.id} closed · voters are notified`);
  };
  return (
    <article className={`cx-post cx-apoll${focused ? " focus" : ""}`} id={compact ? undefined : `cx-${poll.id}`}>
      <div className="cx-meta">
        <span className={`cx-tag ${liveNow ? "acc" : ended ? "warn" : "muted"}`}><Vote size={11} /> {liveNow ? `Live · ${left(poll.closesAt)}` : ended ? "Ended · outcome to publish" : "Closed"}</span>
        <span className="m cx-ref">{poll.id}</span>
        <span>{poll.ward === "all" ? "Every zone" : poll.ward} · {total} votes</span>
        {src ? <button type="button" className="m cx-ref link" onClick={() => onOpenProposal(src.id)}>from {src.id}</button> : null}
      </div>
      <h3>{poll.question}</h3>
      <div className="cx-opts">
        {poll.options.map((o) => {
          const pct = total ? Math.round((counts[o.id] / total) * 100) : 0;
          return (
            <div key={o.id} className={`cx-opt static${poll.outcome?.optionId === o.id ? " win" : ""}`} style={{ "--p": `${pct}%` }}>
              <i aria-hidden /><span>{o.label}</span><b>{pct}% · {counts[o.id]}</b>
            </div>
          );
        })}
      </div>
      {poll.outcome ? <p className="cx-decided">Outcome · {poll.outcome.note}<span> · {nameFor(poll.outcome.by)}, {ago(poll.outcome.at)}</span></p> : null}
      {!poll.outcome && !closing ? <div className="cx-row"><small>{liveNow ? "Results are live. Close it any time with the outcome." : "Voting has ended."}</small><button type="button" className="cx-btn sm" onClick={() => setClosing(true)}>Close with outcome</button></div> : null}
      {closing ? (
        <div className="cx-closing">
          <div className="cx-seg">{poll.options.map((o) => <button key={o.id} type="button" className={pick === o.id ? "on" : ""} onClick={() => setPick(o.id)}>{o.label}</button>)}</div>
          <input className="cx-in" value={note} maxLength={200} onChange={(e) => { setNote(e.target.value); setErr(""); }} placeholder="What happens next, e.g. Benches go in at Deshapriya Park next month." />
          <TextHint text={note} />
          {err ? <p className="cx-err">{err}</p> : null}
          <div className="cx-row"><button type="button" className="cx-btn sm" onClick={() => setClosing(false)}>Cancel</button><HoldButton label="Hold to close" hint="Keep holding" disabled={note.trim().length < 6 || isMash(note)} onConfirm={close} icon={CheckCircle2} /></div>
        </div>
      ) : null}
    </article>
  );
}

/* announcement / notice row with "withdraw" (hidden with a reason, on the record) */
function ModRow({ id, icon: Icon, kick, title, body, meta, hidden, onHide, focused }) {
  const [open, setOpen] = useState(false);
  return (
    <article className={`cx-post${hidden ? " muted" : ""}${focused ? " focus" : ""}`} id={`cx-${id}`}>
      <div className="cx-meta"><span className="cx-tag acc"><Icon size={11} /> {kick}</span></div>
      <h3>{title}</h3>
      {body ? <p className="cx-body">{body}</p> : null}
      <div className="cx-row">
        <small>{meta}</small>
        {onHide ? <button type="button" className="cx-btn sm" onClick={() => setOpen((v) => !v)}><EyeOff size={13} /> Withdraw</button> : null}
      </div>
      {open && onHide ? (
        <div className="cx-concerns"><span className="cx-mod-k">Withdraw because</span>{MODERATION_REASONS.map((r) => <button key={r} type="button" onClick={() => { onHide(r); setOpen(false); }}>{r}</button>)}</div>
      ) : null}
    </article>
  );
}

const HOURS = [{ h: 24, l: "1 day" }, { h: 72, l: "3 days" }, { h: 168, l: "1 week" }, { h: 336, l: "2 weeks" }];
function AnnouncementComposer({ me, innerRef, toast }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [zones, setZones] = useState([]);
  const [citizens, setCitizens] = useState(true);
  const [staff, setStaff] = useState(true);
  const [hours, setHours] = useState(72);
  const [err, setErr] = useState("");
  const all = zones.includes("all");
  const toggle = (z) => setZones(z === "all" ? (all ? [] : ["all"]) : zones.filter((x) => x !== "all").includes(z) ? zones.filter((x) => x !== z && x !== "all") : [...zones.filter((x) => x !== "all"), z]);
  const ready = title.trim().length >= 8 && zones.length && (citizens || staff) && !isMash(title, { title: true }) && !isMash(body);
  const publish = () => {
    const res = publishAnnouncement(me, { title, body, zones, citizens, staff, hours });
    if (!res.ok) { setErr(res.reason); return; }
    setTitle(""); setBody(""); setZones([]); setErr("");
    toast(`${res.id} published · the zone is notified`);
  };
  return (
    <div className="cx-card pad cx-compose" ref={innerRef}>
      <p className="cx-kick sm"><i />Publish announcement</p>
      <label className="cx-field"><span>Title <em>{title.length}/110</em></span><input className="cx-in" value={title} maxLength={110} onChange={(e) => { setTitle(e.target.value); setErr(""); }} placeholder="Water supply off 10:00–14:00 Saturday" /><TextHint text={title} title /></label>
      <label className="cx-field"><span>Details <em>{body.length}/300</em></span><textarea className="cx-ta" rows={2} maxLength={300} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Where, when, what to do." /><TextHint text={body} /></label>
      <div className="cx-field"><span>Zones</span>
        <div className="cx-seg">
          {ZONE_NAMES.map((z) => <button key={z} type="button" className={all || zones.includes(z) ? "on" : ""} onClick={() => toggle(z)}>{z}</button>)}
          <button type="button" className={all ? "on" : ""} onClick={() => toggle("all")}>All 6</button>
        </div>
      </div>
      <div className="cx-field"><span>Reaches</span>
        <div className="cx-seg">
          <button type="button" className={citizens ? "on" : ""} aria-pressed={citizens} onClick={() => setCitizens((v) => !v)}>Citizens</button>
          <button type="button" className={staff ? "on" : ""} aria-pressed={staff} onClick={() => setStaff((v) => !v)}>Field crews</button>
        </div>
      </div>
      <div className="cx-field"><span>Stays up</span>
        <div className="cx-seg">{HOURS.map((x) => <button key={x.h} type="button" className={hours === x.h ? "on" : ""} onClick={() => setHours(x.h)}>{x.l}</button>)}</div>
      </div>
      {err ? <p className="cx-err">{err}</p> : null}
      <div className="cx-row"><small>Notifies everyone it reaches · logged</small><HoldButton label="Hold to publish" hint="Keep holding" disabled={!ready} onConfirm={publish} icon={Megaphone} /></div>
    </div>
  );
}

/* open a poll (optionally from a proposal under review, or an open issue) */
function PollDoor({ state, me, proposals, issues, onClose, onOpened }) {
  const [question, setQuestion] = useState("");
  const [ward, setWard] = useState(ZONE_NAMES[0]);
  const [options, setOptions] = useState(["", ""]);
  const [hours, setHours] = useState(48);
  const [from, setFrom] = useState("");
  const [err, setErr] = useState("");
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });
  useEffect(() => {
    if (!state) return undefined;
    setQuestion(""); setOptions(["", ""]); setFrom(""); setErr("");
    const onKey = (e) => { if (e.key === "Escape") closeRef.current(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state]);
  if (!state) return null;
  const sources = [
    ...proposals.filter((p) => p.status === "review" && (ward === "all" || p.ward === ward)).map((p) => ({ v: `proposal:${p.id}`, l: `${p.id} · ${p.title}` })),
    ...issues.filter((i) => !i.removed && i.status !== "resolved" && (ward === "all" || i.ward === ward)).slice(0, 20).map((i) => ({ v: `issue:${i.id}`, l: `${i.id} · ${i.title}` })),
  ];
  const open = () => {
    const [type, id] = from ? from.split(":") : [];
    const res = openPoll(me, { question, ward, options, hours, from: from ? { type, id } : null });
    if (!res.ok) { setErr(res.reason); return; }
    onOpened(res.id);
  };
  return createPortal(
    <div className="cx-layer tone-admin" role="presentation">
      <div className="cx-scrim" onClick={onClose} aria-hidden />
      <aside className="cx-drawer narrow" role="dialog" aria-modal="true" aria-label="Open a poll">
        <header className="cx-dhead">
          <span className="cx-dic"><Vote size={18} /></span>
          <div className="cx-did"><small>Community / New poll</small><b>Open a poll</b></div>
          <button type="button" className="cx-x" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </header>
        <div className="cx-dbody">
          <p className="cx-dsum">One vote per person, results live, and you close it with the outcome people will read. Everyone in the zone is notified.</p>
          <div className="cx-field"><span>Zone</span>
            <div className="cx-seg">{[...ZONE_NAMES, "all"].map((z) => <button key={z} type="button" className={ward === z ? "on" : ""} onClick={() => { setWard(z); setFrom(""); }}>{z === "all" ? "All 6" : z}</button>)}</div>
          </div>
          <label className="cx-field"><span>From <em>optional</em></span>
            <select className="cx-select wide" value={from} onChange={(e) => setFrom(e.target.value)}>
              <option value="">Nothing · a new question</option>
              {sources.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
            </select>
          </label>
          <label className="cx-field"><span>Question <em>{question.length}/120</em></span><input value={question} maxLength={120} onChange={(e) => { setQuestion(e.target.value); setErr(""); }} placeholder="Which park gets new benches first?" /><TextHint text={question} title /></label>
          <div className="cx-field"><span>Options <em>2 to 4</em></span>
            {options.map((o, k) => (
              <div key={k} className="cx-optrow">
                <input value={o} maxLength={60} placeholder={`Option ${k + 1}`} onChange={(e) => setOptions(options.map((x, j) => (j === k ? e.target.value : x)))} />
                {options.length > 2 ? <button type="button" className="cx-x sm" aria-label="Remove option" onClick={() => setOptions(options.filter((_, j) => j !== k))}><Minus size={13} /></button> : null}
              </div>
            ))}
            <TextHint text={options.find((o) => isMash(o, { title: true })) || ""} title />
            {options.length < 4 ? <button type="button" className="cx-add" onClick={() => setOptions([...options, ""])}><Plus size={13} /> Add option</button> : null}
          </div>
          <div className="cx-field"><span>Open for</span>
            <div className="cx-seg">{POLL_HOURS.map((h) => <button key={h} type="button" className={hours === h ? "on" : ""} onClick={() => setHours(h)}>{h < 168 ? `${h / 24} day${h === 24 ? "" : "s"}` : "1 week"}</button>)}</div>
          </div>
          {err ? <p className="cx-err" role="alert">{err}</p> : null}
          <div className="cx-row"><small>Logged in the Audit Log</small><button type="button" className="cx-btn go" onClick={open} disabled={question.trim().length < 8 || options.filter((o) => o.trim()).length < 2 || isMash(question, { title: true }) || options.some((o) => isMash(o, { title: true }))}><ShieldCheck size={14} /> Open poll</button></div>
        </div>
      </aside>
    </div>,
    document.body
  );
}

