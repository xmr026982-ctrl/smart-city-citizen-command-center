import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Sparkles, Vote, CheckCircle2, MapPin, ChevronDown, Check, Flag } from "lucide-react";
import { useAuth } from "../../store/authStore";
import { useAllIssues } from "../../store/issueStore";
import { useCommunity, announcementLive, reachesZone, noticeLive, pollOpen, signalOf, PROPOSAL_STATUS } from "../../store/communityStore";
import { useActiveZone, setActiveZone } from "../../store/zoneStore";
import { useLiveFeed } from "../../hooks/useLiveFeed";
import { useMinute } from "../../hooks/useMinute";
import { useToast } from "../ui/Toast";
import { useUrlParam, useUrlDrawer, useSetParams } from "../../hooks/useUrlParam";
import { ZONES } from "../../config/zones";
import { WARDS } from "../../constants/issueConstants";
import { evidenceFor } from "../../utils/evidence";
import { AnnouncementCard, NoticeCard, ProposalCard, PollCard, FixedCard, OpenReportCard } from "./kit";
import { isFollowing, isSupporter, affected } from "../../services/citizenService";
import ProposalDrawer from "./ProposalDrawer";
import ProposeDoor from "./ProposeDoor";
import { LensDeck } from "../issues/admin/CommandKit";

/* ------------------------------------------------------------------
   Citizen Community: the zone board. One zone at a time (it follows the
   zone in the top bar, and picking one here moves the top bar too).
   The feed mixes what the city announced, the crews' work notices,
   proposals with their evidence, polls, and what got fixed this week.
   The view lives in the address: ?zone=Ballygunge&show=poll&p=PRP-0107
   (reload keeps it, Back closes an open proposal, links can be shared).
------------------------------------------------------------------- */
const COVERED = WARDS.map((w) => w.name);
const WEEK = 7 * 864e5;
const FILTERS = [
  { id: "all", label: "Everything" },
  { id: "report", label: "Open reports" },
  { id: "proposal", label: "Proposals" },
  { id: "poll", label: "Polls" },
  { id: "fixed", label: "Fixed near you" },
  { id: "announcement", label: "Announcements" },
  { id: "notice", label: "Work notices" },
];

function lastMove(p) {
  const times = [p.at, p.decision?.at, ...p.responses.map((r) => r.at)].filter(Boolean).map((t) => new Date(t).getTime());
  return Math.max(...times);
}

export default function CitizenCommunity() {
  const me = useAuth();
  const c = useCommunity();
  const issues = useAllIssues();
  const feed = useLiveFeed();
  useMinute(); // polls and notices count down
  const location = useLocation();
  const { toast } = useToast();
  const activeId = useActiveZone();

  const setParams = useSetParams();
  // the board's zone: the address first, then the top bar's zone, then your home zone
  const topName = ZONES.find((z) => z.id === activeId)?.name;
  const [zoneParam, setZoneParam] = useUrlParam("zone", { allowed: COVERED });
  const zone = zoneParam || (COVERED.includes(topName) ? topName : COVERED.includes(me?.ward) ? me.ward : COVERED[0]);
  const toTopBar = (name) => { const z = ZONES.find((x) => x.name === name); if (z) setActiveZone(z.id); };
  // a shared link moves the top bar to its zone; a zone picked in the top bar moves the board
  useEffect(() => { if (zoneParam) toTopBar(zoneParam); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const lastTop = useRef(topName);
  useEffect(() => {
    if (lastTop.current === topName) return;
    lastTop.current = topName;
    if (zoneParam && COVERED.includes(topName) && topName !== zoneParam) setZoneParam(topName);
  }, [topName, zoneParam, setZoneParam]);
  const pickZone = (name) => { setZoneParam(name); toTopBar(name); };

  const [filter, setFilterParam] = useUrlParam("show", { allowed: FILTERS.map((f) => f.id), fallback: "all" });
  const setFilter = (v) => setFilterParam(v);
  const [openId, openDrawer, closeDrawer] = useUrlDrawer("p");
  const [startOn, setStartOn] = useState("");
  const [door, setDoor] = useState(false);
  const [zoneMenu, setZoneMenu] = useState(false);
  const [focus, setFocus] = useState(null);

  // arrivals from a notification: { open } a proposal, { poll } or { focus } a post
  useEffect(() => {
    const st = location.state;
    if (!st) return;
    const find = (id) => c.proposals.find((p) => p.id === id) || c.polls.find((p) => p.id === id) || c.announcements.find((a) => a.id === id) || c.notices.find((n) => n.id === id);
    const target = find(st.open || st.poll || st.focus);
    const w = target && (target.ward || (target.zones && !target.zones.includes("all") ? target.zones[0] : null));
    const z = w && COVERED.includes(w) ? w : "";
    if (z) toTopBar(z);
    if (target && st.open) {
      setParams({ zone: z || zoneParam, p: st.open, show: "" });
    } else {
      setParams({ zone: z || zoneParam, show: "" }); // also clears the arrival
      if (target) { setFocus(target.id); setTimeout(() => document.getElementById(`cx-${target.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 120); setTimeout(() => setFocus(null), 2600); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  const data = useMemo(() => {
    const proposals = c.proposals.filter((p) => p.ward === zone);
    const polls = c.polls.filter((p) => p.ward === zone || p.ward === "all");
    const anns = c.announcements.filter((a) => announcementLive(a) && reachesZone(a, zone));
    const notices = c.notices.filter((n) => n.ward === zone && noticeLive(n, issues));
    const fixed = issues.filter((i) => i.ward === zone && i.status === "resolved" && !i.removed && Date.now() - new Date(([...i.timeline].reverse().find((t) => t.status === "resolved") || {}).at || 0).getTime() < WEEK);
    const ev = Object.fromEntries(proposals.map((p) => [p.id, evidenceFor(p, issues, feed)]));
    // neighbours' open reports: most people affected first
    const reports = issues
      .filter((i) => i.ward === zone && !i.removed && i.status !== "resolved" && i.reporterId !== me?.id && Number.isFinite(i.lat))
      .sort((a, b) => affected(b) - affected(a) || new Date(b.createdAt) - new Date(a.createdAt));
    return { proposals, polls, anns, notices, fixed, ev, reports };
    // feed changes every few seconds; evidence only needs its AQI, so it follows the minute
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c, issues, zone]);

  const livePolls = data.polls.filter(pollOpen);
  const railPoll = livePolls.find((p) => !p.votes?.[me?.id]) || livePolls[0] || null;
  const stats = {
    proposals: data.proposals.filter((p) => p.status === "review").length,
    backed: data.proposals.filter((p) => p.status === "review" && signalOf(p, me?.id)).length,
    polls: livePolls.length,
    toVote: livePolls.filter((p) => !p.votes?.[me?.id]).length,
    fixed: data.fixed.length,
    mineFixed: data.fixed.filter((i) => i.reporterId === me?.id || (i.supporters || []).some((s) => s.id === me?.id)).length,
    anns: data.anns.length,
    reports: data.reports.length,
    followed: data.reports.filter((i) => isFollowing(i, me) || isSupporter(i, me)).length,
  };

  const items = useMemo(() => {
    const out = [];
    data.anns.forEach((a) => out.push({ type: "announcement", id: a.id, t: new Date(a.at).getTime() + 1e12, a })); // announcements stay on top
    data.notices.forEach((n) => out.push({ type: "notice", id: n.id, t: new Date(n.at).getTime() + 5e11, n }));
    data.proposals.forEach((p) => out.push({ type: "proposal", id: p.id, t: lastMove(p) + (p.status === "review" ? 0 : -1e10), p }));
    data.polls.forEach((p) => { if (filter === "poll" || p.id !== railPoll?.id) out.push({ type: "poll", id: p.id, t: new Date(p.opensAt).getTime() + (pollOpen(p) ? 0 : -1e10), poll: p }); });
    data.fixed.forEach((i) => out.push({ type: "fixed", id: i.id, t: new Date(i.updatedAt || i.createdAt).getTime(), i }));
    // open reports: in "Everything", the three most affected; their own view lists them all
    (filter === "report" ? data.reports : data.reports.slice(0, 3)).forEach((i, k) => out.push({ type: "report", id: i.id, t: (filter === "report" ? 0 : new Date(i.createdAt).getTime()) - k, i }));
    return out.filter((x) => filter === "all" || x.type === filter).sort((a, b) => b.t - a.t);
  }, [data, filter, railPoll?.id]);

  // everything you follow, newest move first: proposals you back and reports you follow (any zone)
  const navigate = useNavigate();
  const following = [
    ...c.proposals
      .filter((p) => p.by.id === me?.id || signalOf(p, me?.id))
      .map((p) => ({ id: p.id, t: lastMove(p), now: p.status === "review", title: p.title, sub: `${p.ward} · ${PROPOSAL_STATUS[p.status]?.label}${p.decision?.issueId ? ` · ${p.decision.issueId}` : ""}`, go: () => openProposal(p.id) })),
    ...issues
      .filter((i) => !i.removed && i.reporterId !== me?.id && (isFollowing(i, me) || isSupporter(i, me)))
      .map((i) => ({ id: i.id, t: new Date(i.updatedAt || i.createdAt).getTime(), now: i.status !== "resolved", title: i.title, sub: `${i.ward} · report ${i.id}${i.status === "resolved" ? " · fixed" : ""}`, go: () => navigate(`/citizen/issues/${encodeURIComponent(i.id)}`) })),
  ].sort((a, b) => b.t - a.t).slice(0, 5);

  const openP = c.proposals.find((p) => p.id === openId) || null;
  const openProposal = (id, on = "") => { setStartOn(on); openDrawer(id); };

  const TILES = [
    { id: "proposal", label: "Proposals", lens: "Proposals", icon: Sparkles, value: stats.proposals, sub: stats.backed ? `${stats.backed} you back` : "Under review in this zone", meter: stats.proposals ? (stats.backed / stats.proposals) * 100 : 0 },
    { id: "poll", label: "Open polls", lens: "Polls", icon: Vote, value: stats.polls, sub: stats.toVote ? `${stats.toVote} waiting for your vote` : "You've voted in every one", meter: stats.polls ? ((stats.polls - stats.toVote) / stats.polls) * 100 : 0, tone: "ink" },
    { id: "fixed", label: "Fixed this week", lens: "Fixed near you", icon: CheckCircle2, value: stats.fixed, sub: stats.mineFixed ? `${stats.mineFixed} you reported or backed` : "Resolved in this zone", meter: stats.fixed ? 100 : 0, tone: "green" },
    { id: "report", label: "Open reports", lens: "Open reports", icon: Flag, value: stats.reports, sub: stats.followed ? `${stats.followed} you follow` : "Neighbours' reports you can back", meter: stats.reports ? (stats.followed / stats.reports) * 100 : 0, tone: "amber" },
  ];

  return (
    <main className="page cx tone-citizen">
      <header className="cx-head">
        <div>
          <p className="cx-kick"><i />Community · {zone}</p>
          <h1>Your zone, in motion</h1>
          <p className="cx-sub">What neighbours are backing, what the city decided, and what got fixed. Every signal you send reaches the people who decide.</p>
        </div>
        <div className="cx-acts">
          <div className="cx-zone">
            <button type="button" className="cx-btn" aria-haspopup="listbox" aria-expanded={zoneMenu} onClick={() => setZoneMenu((v) => !v)}>
              <MapPin size={15} /> {zone} <ChevronDown size={14} />
            </button>
            {zoneMenu ? (
              <ul className="cx-zlist" role="listbox" aria-label="Community zone">
                {COVERED.map((w) => (
                  <li key={w}><button type="button" role="option" aria-selected={w === zone} onClick={() => { pickZone(w); setZoneMenu(false); }}>{w}{w === me?.ward ? <em>home</em> : null}{w === zone ? <Check size={13} /> : null}</button></li>
                ))}
              </ul>
            ) : null}
          </div>
          <button type="button" className="cx-btn go" onClick={() => setDoor(true)}><Sparkles size={15} /> Propose an improvement</button>
        </div>
      </header>

      <LensDeck
        value={TILES.some((t) => t.id === filter) ? filter : "all"}
        onChange={setFilter}
        readout={`${items.length} on the ${zone} board`}
        tiles={TILES}
      />

      <nav className="cx-chips-row" aria-label="Filter">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" className={`cx-chip${filter === f.id ? " on" : ""}`} onClick={() => setFilter(f.id)}>{f.label}</button>
        ))}
      </nav>

      <div className="cx-cols">
        <section className="cx-feed" aria-label="Zone board">
          {!items.length ? (
            <div className="cx-empty"><p>{filter === "report" ? `No open reports from neighbours in ${zone} right now.` : `Nothing here yet in ${zone}. Be the first to propose something.`}</p></div>
          ) : items.map((x) => {
            const f = focus === x.id;
            if (x.type === "announcement") return <AnnouncementCard key={x.id} a={x.a} focused={f} />;
            if (x.type === "notice") return <NoticeCard key={x.id} n={x.n} focused={f} />;
            if (x.type === "proposal") return <ProposalCard key={x.id} p={x.p} ev={data.ev[x.id]} onOpen={openProposal} focused={f} />;
            if (x.type === "poll") return <div key={x.id} className="cx-post flush"><PollCard poll={x.poll} focused={f} /></div>;
            if (x.type === "report") return <OpenReportCard key={x.id} issue={x.i} focused={f} onDone={(m) => toast(m)} />;
            return <FixedCard key={x.id} issue={x.i} focused={f} />;
          })}
        </section>

        <aside className="cx-rail">
          {railPoll && filter !== "poll" ? <div className="cx-card pad"><PollCard poll={railPoll} compact focused={focus === railPoll.id} /></div> : null}
          <div className="cx-card pad">
            <p className="cx-kick sm"><i />What you follow</p>
            {following.length ? following.map((x) => (
              <button key={x.id} type="button" className={`cx-follow ${x.now ? "now" : "done"}`} onClick={x.go}>
                <i aria-hidden />
                <span><b>{x.title}</b><small>{x.sub}</small></span>
              </button>
            )) : <p className="cx-quiet">Back a proposal, or follow a neighbour&apos;s report under Open reports. Every move on it shows up here.</p>}
          </div>
        </aside>
      </div>

      <ProposalDrawer p={openP} ev={openP ? evidenceFor(openP, issues, feed) : null} issues={issues} onClose={closeDrawer} startOn={startOn} />
      <ProposeDoor
        open={door}
        zone={zone}
        onClose={() => setDoor(false)}
        onOpenProposal={(id) => { setDoor(false); openProposal(id); }}
        onSent={(id) => { setDoor(false); toast("Proposal sent · the city answers within a week"); openProposal(id); }}
      />
    </main>
  );
}
