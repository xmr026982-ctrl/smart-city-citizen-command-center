import { cutoff, dayKey, weekDay, clock, fromIST, timeSlots, nextSlot } from "../../utils/time";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Wrench, Megaphone, AlertTriangle, Sparkles, MapPin, CheckCircle2, RotateCcw, Send } from "lucide-react";
import { useAuth } from "../../store/authStore";
import { useAllIssues } from "../../store/issueStore";
import {
  useCommunity, announcementLive, noticeLive, NOTICE_KINDS, postWorkNotice, endWorkNotice, stillCount, checkOf, answerStill,
} from "../../store/communityStore";
import { staffZones } from "../../store/notifyStore";
import { useLiveFeed } from "../../hooks/useLiveFeed";
import { useMinute } from "../../hooks/useMinute";
import { useToast } from "../ui/Toast";
import { useUrlParam, useUrlDrawer, useSetParams } from "../../hooks/useUrlParam";
import { evidenceFor } from "../../utils/evidence";
import { fileLink } from "../../utils/fileLink";
import { AnnouncementCard, NoticeCard, ProposalCard, ago } from "./kit";
import ProposalDrawer from "./ProposalDrawer";
import { LensDeck } from "../issues/admin/CommandKit";
import TextHint from "../ui/TextHint";
import { isMash } from "../../utils/textGuard";

/* ------------------------------------------------------------------
   Field crew Community: the zone board for your zones (your home zone
   plus the zones of your open files). What command announced for the
   crews, the work notices out there, proposals in your zones, and any
   file you closed that a resident says is still happening: check it and
   answer. Post structured work notices on your own open files.
   The view lives in the address: ?show=check&p=PRP-0107.
------------------------------------------------------------------- */
const FILTERS = [
  { id: "all", label: "Everything" },
  { id: "check", label: "Checks" },
  { id: "announcement", label: "Announcements" },
  { id: "notice", label: "Work notices" },
  { id: "proposal", label: "Proposals" },
];
const LENGTHS = [{ h: 1, l: "1 h" }, { h: 2, l: "2 h" }, { h: 4, l: "4 h" }, { h: 8, l: "8 h" }, { h: 24, l: "1 d" }, { h: 72, l: "3 d" }];
const SLOTS = timeSlots(30);
/* the next seven IST days: "Today · Mon, 9 Nov" */
const DAYS = () => Array.from({ length: 7 }, (_, i) => {
  const d = new Date(Date.now() + i * 864e5);
  return { k: dayKey(d), l: `${i === 0 ? "Today" : i === 1 ? "Tomorrow" : ""}${i < 2 ? " · " : ""}${weekDay(d)}` };
});
const endsAt = (k, t, h) => { const f = fromIST(k, t); return f ? cutoff(new Date(f.getTime() + h * 36e5)) : "—"; };

export default function StaffCommunity() {
  const me = useAuth();
  const c = useCommunity();
  const issues = useAllIssues();
  const feed = useLiveFeed();
  useMinute();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const setParams = useSetParams();
  const [filter, setFilter] = useUrlParam("show", { allowed: FILTERS.map((f) => f.id), fallback: "all" });
  const [openId, setOpenId, closeDrawer] = useUrlDrawer("p");
  const [focus, setFocus] = useState(null);
  const composerRef = useRef(null);

  const zones = useMemo(() => staffZones(me || {}, issues), [me, issues]);
  const mineOpen = issues.filter((i) => i.assignedTo === me?.name && !i.removed && i.status !== "resolved");

  // closed files of mine that residents say are still happening, not yet answered since
  const checks = useMemo(() => issues.filter((i) => {
    if (i.assignedTo !== me?.name || i.status !== "resolved" || !stillCount(i.id)) return false;
    const last = [...c.issueSignals].reverse().find((s) => s.issueId === i.id && s.kind === "still");
    const chk = checkOf(i.id);
    return !chk || (last && new Date(last.at) > new Date(chk.at));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [issues, c.issueSignals, c.checks, me?.name]);

  useEffect(() => {
    const st = location.state;
    if (!st) return;
    const id = st.check || st.focus || st.open;
    if (st.open) setParams({ p: st.open, show: "" });
    else {
      setParams({ show: "" }); // also clears the arrival
      if (id) {
        setFocus(id);
        setTimeout(() => document.getElementById(`cx-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 150);
        setTimeout(() => setFocus(null), 2600);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  const anns = c.announcements.filter((a) => announcementLive(a) && a.audience.staff && (a.zones.includes("all") || a.zones.some((z) => zones.has(z))));
  const notices = c.notices.filter((n) => zones.has(n.ward) && noticeLive(n, issues));
  const proposals = c.proposals.filter((p) => zones.has(p.ward) && (p.status === "review" || (p.decision && Date.now() - new Date(p.decision.at).getTime() < 14 * 864e5)));

  const items = [];
  checks.forEach((i) => items.push({ type: "check", id: i.id, t: 3e12, i }));
  anns.forEach((a) => items.push({ type: "announcement", id: a.id, t: new Date(a.at).getTime() + 1e12, a }));
  notices.forEach((n) => items.push({ type: "notice", id: n.id, t: new Date(n.at).getTime() + 5e11, n }));
  proposals.forEach((p) => items.push({ type: "proposal", id: p.id, t: new Date(p.decision?.at || p.at).getTime(), p }));
  const shown = items.filter((x) => filter === "all" || x.type === filter).sort((a, b) => b.t - a.t);

  const mineNotices = notices.filter((n) => n.by === me?.name).length;
  const reviewing = proposals.filter((p) => p.status === "review").length;
  const TILES = [
    { id: "check", label: "Still happening", lens: "Checks", icon: AlertTriangle, value: checks.length, sub: checks.length ? "Residents say a fix didn't hold" : "No fix questioned", meter: checks.length ? 100 : 0, tone: checks.length ? "red" : "amber" },
    { id: "notice", label: "Work notices", icon: Wrench, value: notices.length, sub: `${mineNotices} of them yours`, meter: notices.length ? (mineNotices / notices.length) * 100 : 0 },
    { id: "announcement", label: "Announcements", icon: Megaphone, value: anns.length, sub: "From command, for the crews", meter: anns.length ? 100 : 0, tone: "ink" },
    { id: "proposal", label: "Proposals", icon: Sparkles, value: reviewing, sub: "Under review in your zones", meter: proposals.length ? (reviewing / proposals.length) * 100 : 0, tone: "green" },
  ];
  const openP = c.proposals.find((p) => p.id === openId) || null;

  return (
    <main className="page cx tone-staff">
      <header className="cx-head">
        <div>
          <p className="cx-kick"><i />Field · Community</p>
          <h1>Zone board</h1>
          <p className="cx-sub">What your zones are hearing from the city, and the notices you post on your own work.</p>
        </div>
        <div className="cx-acts">
          <span className="cx-zones" title="Your home zone and the zones of your open files"><MapPin size={14} /><em>Your zones</em>{[...zones].join(" · ") || "None yet"}</span>
          <button type="button" className="cx-btn go" disabled={!mineOpen.length} onClick={() => { composerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); composerRef.current?.querySelector("select")?.focus(); }}><Wrench size={15} /> Post work notice</button>
        </div>
      </header>

      <LensDeck
        value={TILES.some((t) => t.id === filter) ? filter : "all"}
        onChange={setFilter}
        readout={`${shown.length} on your zones' board`}
        tiles={TILES}
      />

      <nav className="cx-chips-row" aria-label="Filter">
        {FILTERS.map((f) => <button key={f.id} type="button" className={`cx-chip${filter === f.id ? " on" : ""}`} onClick={() => setFilter(f.id)}>{f.label}</button>)}
      </nav>

      <div className="cx-cols">
        <section className="cx-feed" aria-label="Zone board">
          {!shown.length ? <div className="cx-empty">Nothing in this view for your zones.</div> : shown.map((x) => {
            const f = focus === x.id;
            if (x.type === "check") return <CheckCard key={x.id} issue={x.i} me={me} focused={f} toast={toast} onOpen={() => navigate(fileLink("staff", x.i.id, "/community"))} />;
            if (x.type === "announcement") return <AnnouncementCard key={x.id} a={x.a} focused={f} />;
            if (x.type === "notice") return <MyNotice key={x.id} n={x.n} me={me} focused={f} />;
            return <ProposalCard key={x.id} p={x.p} ev={evidenceFor(x.p, issues, feed)} onOpen={(id) => setOpenId(id)} focused={f} />;
          })}
        </section>
        <aside className="cx-rail">
          <NoticeComposer innerRef={composerRef} me={me} files={mineOpen} toast={toast} />
        </aside>
      </div>

      <ProposalDrawer p={openP} ev={openP ? evidenceFor(openP, issues, feed) : null} issues={issues} onClose={closeDrawer} />
    </main>
  );
}

function MyNotice({ n, me, focused }) {
  const mine = n.by === me?.name;
  const navigate = useNavigate();
  return (
    <div className="cx-wrap-notice">
      <NoticeCard n={n} focused={focused} onOpenFile={mine ? (id) => navigate(fileLink("staff", id, "/community")) : undefined} />
      {mine ? <div className="cx-row cx-under"><small>Your notice · ends {cutoff(n.to)}</small><button type="button" className="cx-btn sm" onClick={() => endWorkNotice(me, n.id)}>Work done · end it now</button></div> : null}
    </div>
  );
}

/* a closed file a resident says is still happening: check and answer */
function CheckCard({ issue, me, focused, toast, onOpen }) {
  const [verdict, setVerdict] = useState("fixed");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const send = () => {
    const res = answerStill(me, issue.id, verdict, note);
    if (!res.ok) { setErr(res.reason); return; }
    toast(verdict === "fixed" ? "Answered · the residents are told it's fixed" : "Sent to command for another visit");
  };
  return (
    <article className={`cx-post cx-check${focused ? " focus" : ""}`} id={`cx-${issue.id}`}>
      <div className="cx-meta">
        <span className="cx-tag warn"><AlertTriangle size={11} /> Still happening · {stillCount(issue.id)}</span>
        <button type="button" className="m cx-ref link" onClick={onOpen}>{issue.id}</button>
        <span>{issue.ward} · you closed it {ago(([...issue.timeline].reverse().find((t) => t.status === "resolved") || {}).at || issue.updatedAt)}</span>
      </div>
      <h3>{issue.title}</h3>
      <div className="cx-seg">
        <button type="button" className={verdict === "fixed" ? "on" : ""} onClick={() => setVerdict("fixed")}><CheckCircle2 size={12} /> Checked · it&apos;s fixed</button>
        <button type="button" className={verdict === "revisit" ? "on" : ""} onClick={() => setVerdict("revisit")}><RotateCcw size={12} /> Needs another visit</button>
      </div>
      <input className="cx-in" value={note} maxLength={200} onChange={(e) => { setNote(e.target.value); setErr(""); }} placeholder={verdict === "fixed" ? "What you checked, e.g. Light tested at 9 pm, working." : "What's wrong now, e.g. The new cover has cracked."} />
      <TextHint text={note} />
      {err ? <p className="cx-err">{err}</p> : null}
      <div className="cx-row"><small>{verdict === "fixed" ? "The residents who said it isn't fixed get your note" : "Command decides the next visit"} · logged</small><button type="button" className="cx-btn sm go" disabled={note.trim().length < 6 || isMash(note)} onClick={send}><Send size={13} /> Answer</button></div>
    </article>
  );
}

function NoticeComposer({ innerRef, me, files, toast }) {
  const [issueId, setIssueId] = useState(files[0]?.id || "");
  const [kind, setKind] = useState(NOTICE_KINDS[0]);
  const [startDay, setStartDay] = useState(() => dayKey(nextSlot()));
  const [startTime, setStartTime] = useState(() => clock(nextSlot()));
  const [hours, setHours] = useState(2);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => { if (!files.some((f) => f.id === issueId)) setIssueId(files[0]?.id || ""); }, [files, issueId]);
  const file = files.find((f) => f.id === issueId);
  const post = () => {
    const from = fromIST(startDay, startTime) || new Date();
    const res = postWorkNotice(me, { issueId, kind, from, to: new Date(from.getTime() + hours * 36e5), note });
    if (!res.ok) { setErr(res.reason); return; }
    setNote(""); setErr("");
    toast(`${res.id} posted · ${file?.ward} is notified`);
  };
  return (
    <div className="cx-card pad cx-compose" ref={innerRef}>
      <p className="cx-kick sm"><i />New work notice</p>
      {!files.length ? <p className="cx-quiet">You can post a notice once you have an open file.</p> : (
        <>
          <label className="cx-field"><span>On which of your files</span>
            <select className="cx-select wide" value={issueId} onChange={(e) => setIssueId(e.target.value)}>
              {files.map((f) => <option key={f.id} value={f.id}>{f.id} · {f.title}</option>)}
            </select>
          </label>
          <div className="cx-field"><span>Kind</span>
            <div className="cx-seg">{NOTICE_KINDS.map((k) => <button key={k} type="button" className={kind === k ? "on" : ""} onClick={() => setKind(k)}>{k}</button>)}</div>
          </div>
          <div className="cx-field"><span>Starts <em>24 h · IST</em></span>
            <div className="cx-when">
              <select className="cx-select wide" aria-label="Start day" value={startDay} onChange={(e) => setStartDay(e.target.value)}>
                {DAYS().map((d) => <option key={d.k} value={d.k}>{d.l}</option>)}
              </select>
              <select className="cx-select wide" aria-label="Start time" value={startTime} onChange={(e) => setStartTime(e.target.value)}>
                {SLOTS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="cx-field"><span>Lasts <em>ends {endsAt(startDay, startTime, hours)}</em></span>
            <div className="cx-seg cx-seg-fit">{LENGTHS.map((x) => <button key={x.h} type="button" className={hours === x.h ? "on" : ""} onClick={() => setHours(x.h)}>{x.l}</button>)}</div>
          </div>
          <label className="cx-field"><span>Note for residents <em>{note.length}/140</em></span>
            <textarea className="cx-ta" rows={2} maxLength={140} value={note} onChange={(e) => { setNote(e.target.value); setErr(""); }} placeholder="Where exactly, and what people should do." />
            <TextHint text={note} />
          </label>
          {err ? <p className="cx-err">{err}</p> : null}
          <div className="cx-row"><small>Goes to {file?.ward || "the zone"} · ends with the file · logged</small><button type="button" className="cx-btn sm go" disabled={isMash(note)} onClick={post}><Send size={13} /> Post notice</button></div>
        </>
      )}
    </div>
  );
}
