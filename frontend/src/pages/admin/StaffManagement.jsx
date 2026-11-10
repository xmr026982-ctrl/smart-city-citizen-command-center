import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useMinute } from "../../hooks/useMinute";
import {
  Users, Radio, Gauge, CheckCircle2, BadgeCheck, MapPin, Zap, RotateCcw, KeyRound, Siren, UserSearch,
  ShieldCheck, Coffee,
} from "lucide-react";
import StaffDetailsDrawer from "../../components/issues/admin/StaffDetailsDrawer";
import IssueDetailsDrawer from "../../components/issues/shared/IssueDetailsDrawer";
import {
  Command, CommandHead, LensDeck, SearchBox, Seg, Chips, ResultLine, Pager, Avatar, Empty,
  SortBar, SortChip, RankBadge, useGlide, useHoverFx, FxLayer,
} from "../../components/issues/admin/CommandKit";
import { EXPERTISE, expertiseLabel } from "../../config/expertise";
import { useAudit, useIssues } from "../../store/issueStore";
import { useFieldRoster, CAPACITY } from "../../store/fieldRoster";
import { isAwaiting, RANKS } from "../../store/staffDeskStore";
import { slaOf } from "../../utils/sla";
import { nameFor, useNames } from "../../store/profileStore";

/* ------------------------------------------------------------------
   Staff Management: the uplinked field force with live work numbers.
   The tile deck locks one lens at a time: whole force (home), on
   duty, carrying load, crews with breaches, crews who closed work.
   The duty switch adds off duty and near capacity. An empty lens
   reads as a status report (e.g. "No crew near capacity"), not an error.
   Rank, expertise, verify and removal stay on the Staff Desk; this
   page is for reading load and performance and opening files.
------------------------------------------------------------------- */

// dir = default direction; click the active sort again to flip it
const SORTS = [
  { id: "load", label: "Load", dir: "desc", desc: "Heaviest load first", asc: "Lightest load first" },
  { id: "closed", label: "Closed", dir: "desc", desc: "Most closed first", asc: "Fewest closed first" },
  { id: "breach", label: "Breaches", dir: "desc", desc: "Most breaches first", asc: "Fewest breaches first" },
  { id: "name", label: "Name", dir: "asc", desc: "Name Z–A", asc: "Name A–Z" },
  { id: "rank", label: "Rank", dir: "desc", desc: "Senior first", asc: "Junior first" },
];
const BOARD_SORT = { id: "board", label: "On board", dir: "desc", desc: "Most closed on this board first", asc: "Fewest closed on this board first" };
const SORT_DIR = Object.fromEntries([...SORTS, BOARD_SORT].map((o) => [o.id, o.dir]));

// the value each card is ranked by, shown on the card
function readout(key, p) {
  if (key === "load") return ["Load", `${p.load}/${CAPACITY}`];
  if (key === "closed") return ["Closed", p.closed];
  if (key === "board") return ["On board", p.closedOnBoard];
  if (key === "breach") return ["Breached", p.breaches];
  if (key === "rank") return ["Rank", `${String(RANKS.indexOf(p.rank) + 1).padStart(2, "0")} · ${p.rank}`];
  return ["Name", (p.name || "?").charAt(0).toUpperCase()];
}

function StaffManagement() {
  useNames(); // names follow each person's current display name
  const issues = useIssues();
  const audit = useAudit();
  const { roster } = useFieldRoster();
  const tick = useMinute();
  const [query, setQuery] = useState("");
  const [skill, setSkill] = useState("all");
  const location = useLocation();
  const [lens, setLens] = useState(["on", "off", "loaded", "full", "breach", "closers"].includes(location.state?.lens) ? location.state.lens : "all"); // all | on | off | loaded | full | breach | closers
  const [sortKey, setSortKey] = useState("load");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(9);
  const [openId, setOpenId] = useState(null);
  const [issueId, setIssueId] = useState(null);

  const live = useMemo(
    () => roster.filter((p) => !isAwaiting(p)).map((p) => ({ ...p, breaches: p.openIssues.filter((i) => slaOf(i).state === "over").length })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [roster, tick]
  );
  const awaiting = roster.filter(isAwaiting);

  const stats = useMemo(() => {
    const onDuty = live.filter((p) => p.onDuty).length;
    const load = live.reduce((s, p) => s + p.load, 0);
    const closed = live.reduce((s, p) => s + p.closedOnBoard, 0);
    const resolvedBoard = issues.filter((i) => i.status === "resolved").length;
    return {
      force: live.length, onDuty, load, cap: live.length * CAPACITY, closed, resolvedBoard,
      breaches: live.reduce((s, p) => s + p.breaches, 0),
      breachCrews: live.filter((p) => p.breaches).length,
      closers: live.filter((p) => p.closedOnBoard).length,
      near: live.filter((p) => p.load >= CAPACITY - 1).length,
    };
  }, [live, issues]);

  const list = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const out = live.filter((p) => {
      if (skill !== "all" && p.expertise !== skill) return false;
      if (lens === "on" && !p.onDuty) return false;
      if (lens === "off" && p.onDuty) return false;
      if (lens === "loaded" && !p.load) return false;
      if (lens === "full" && p.load < CAPACITY - 1) return false;
      if (lens === "breach" && !p.breaches) return false;
      if (lens === "closers" && !p.closedOnBoard) return false;
      if (!needle) return true;
      return [p.name, p.zone, p.rank, expertiseLabel(p.expertise)].join(" ").toLowerCase().includes(needle);
    });
    // each comparator is written for its default direction; the other direction flips it
    const flip = sortDir === SORT_DIR[sortKey] ? 1 : -1;
    out.sort((a, b) => {
      let d;
      if (sortKey === "load") d = b.load - a.load;
      else if (sortKey === "closed") d = b.closed - a.closed;
      else if (sortKey === "board") d = b.closedOnBoard - a.closedOnBoard || b.closed - a.closed;
      else if (sortKey === "breach") d = b.breaches - a.breaches || b.load - a.load;
      else if (sortKey === "rank") d = RANKS.indexOf(b.rank) - RANKS.indexOf(a.rank);
      else d = a.name.localeCompare(b.name);
      return d * flip || a.name.localeCompare(b.name);
    });
    return out;
  }, [live, query, skill, lens, sortKey, sortDir]);

  useEffect(() => { setPage(1); }, [query, skill, lens, sortKey, sortDir, size]);
  const gridRef = useRef(null);
  useGlide(gridRef, `${sortKey}-${sortDir}`);
  useHoverFx(gridRef, { tilt: true }); // cards: same 3D tilt + glare family as the Staff Desk

  const pages = Math.max(1, Math.ceil(list.length / size));
  const safePage = Math.min(page, pages);
  const slice = list.slice((safePage - 1) * size, safePage * size);
  const open = live.find((p) => p.id === openId) || null;
  const issue = issues.find((i) => i.id === issueId) || null;

  // a lens also brings its own order: breaches first, top closers first, heaviest load first
  const LENS_SORT = { breach: "breach", closers: "board", full: "load", loaded: "load" };
  const pickLens = (id) => {
    const implied = LENS_SORT[lens];
    setLens(id);
    if (LENS_SORT[id]) { setSortKey(LENS_SORT[id]); setSortDir(SORT_DIR[LENS_SORT[id]]); }
    else if (sortKey === "board" || (implied && sortKey === implied)) { setSortKey("load"); setSortDir("desc"); } // lens released: its order goes too
  };
  const sorts = lens === "closers" ? [BOARD_SORT, ...SORTS] : SORTS;

  const filters = query || skill !== "all" || lens !== "all" || sortKey !== "load" || sortDir !== "desc";

  // what an empty lens means (only when no search or expertise filter is narrowing it)
  const EMPTY = {
    all: { icon: UserSearch, title: "No uplinked staff yet", sub: "Cleared people join this list after their first sign-in." },
    on: { icon: Coffee, title: "Nobody is on duty", sub: "Every uplinked crew member is off duty right now." },
    off: { icon: CheckCircle2, title: "Everyone is on duty", sub: "No uplinked crew member is off duty." },
    loaded: { icon: CheckCircle2, title: "No crew is carrying work", sub: "Open issues are waiting for dispatch, or the board is clear." },
    full: { icon: CheckCircle2, title: "No crew near capacity", sub: `Every crew has at least 2 free slots of ${CAPACITY}.` },
    breach: { icon: ShieldCheck, title: "No crew has a breached issue", sub: "Every open assignment is inside its service window." },
    closers: { icon: CheckCircle2, title: "No closed work on this board yet", sub: "Crews show here once their issues are confirmed closed." },
  };
  const empty = query || skill !== "all"
    ? { icon: UserSearch, title: "No staff match", sub: "Change the search or expertise filter, or release the lens." }
    : EMPTY[lens] || EMPTY.all;
  const reset = () => { setQuery(""); setSkill("all"); setLens("all"); setSortKey("load"); setSortDir("desc"); };

  return (
    <Command>
      <CommandHead crumb="STAFF MANAGEMENT" title="Staff Management" sub="The uplinked field force with live load and results. Rank, verification and removal are handled on the Staff Desk.">
      </CommandHead>

      <LensDeck
        value={lens}
        onChange={pickLens}
        readout={`${list.length} of ${live.length} staff`}
        tiles={[
          { id: "all", icon: Users, label: "Field force", lens: "Whole force", value: stats.force, sub: `${EXPERTISE.length} expertise lines`, meter: 100 },
          { id: "on", icon: Radio, label: "On duty", value: stats.onDuty, sub: `${stats.force - stats.onDuty} off duty`, meter: stats.force ? (stats.onDuty / stats.force) * 100 : 0, tone: "green" },
          { id: "loaded", icon: Gauge, label: "Open load", lens: "Carrying load", value: `${stats.load}/${stats.cap}`, sub: `${stats.cap ? Math.round((stats.load / stats.cap) * 100) : 0}% of capacity · ${stats.near} near full`, meter: stats.cap ? (stats.load / stats.cap) * 100 : 0, tone: "amber" },
          { id: "breach", icon: Siren, label: "Breaches on crews", lens: "Crews with breaches", value: stats.breaches, sub: `${stats.breachCrews} crew${stats.breachCrews === 1 ? "" : "s"} past a window`, meter: stats.load ? (stats.breaches / stats.load) * 100 : 0, tone: stats.breaches ? "red" : "green" },
          { id: "closers", icon: CheckCircle2, label: "Closed on board", lens: "Crews who closed work", value: stats.closed, sub: `${stats.closers} crew${stats.closers === 1 ? "" : "s"} closed work here`, meter: stats.resolvedBoard ? (stats.closed / stats.resolvedBoard) * 100 : 0, tone: "cyan" },
        ]}
      />

      {awaiting.length ? (
        <div className="ac-banner">
          <span><KeyRound size={15} /> {awaiting.length} cleared {awaiting.length === 1 ? "person is" : "people are"} awaiting uplink ({awaiting.map((p) => p.name.split(" ")[0]).join(", ")}). They join this list after their first sign-in.</span>
          <Link to="/admin/staff-desk" className="ac-btn sm">Open Staff Desk</Link>
        </div>
      ) : null}

      <div className="ac-toolbar">
        <div className="grow"><SearchBox value={query} onChange={setQuery} placeholder="Search name, zone, rank or expertise" /></div>
        <Seg value={lens} onChange={pickLens} label="Duty" options={[{ id: "all", label: "Everyone" }, { id: "on", label: "On duty" }, { id: "off", label: "Off duty" }, { id: "full", label: "Near capacity" }]} />
      </div>

      <div className="ac-filterline">
        <Chips value={skill} onChange={setSkill} items={[{ id: "all", label: "All expertise", count: live.length }, ...EXPERTISE.map((e) => ({ id: e.id, label: e.label, count: live.filter((p) => p.expertise === e.id).length }))]} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <SortBar options={sorts} value={sortKey} dir={sortDir} onChange={(id, dir) => { setSortKey(id); setSortDir(dir); }} />
          {filters ? <button type="button" className="ac-btn sm" onClick={reset}><RotateCcw size={12} /> Reset</button> : null}
        </div>
      </div>

      <ResultLine total={list.length} of={live.length} page={safePage} size={size} noun="staff" />

      {!slice.length ? (
        <Empty icon={empty.icon} title={empty.title} sub={empty.sub} />
      ) : (
        <section className="ac-crew" ref={gridRef} key={`${safePage}-${size}-${lens}`}>
          {slice.map((p, i) => {
            const pct = Math.min(100, Math.round((p.load / CAPACITY) * 100));
            const tone = pct >= 84 ? "hot" : pct >= 50 ? "mid" : "";
            const [rl, rv] = readout(sortKey, p);
            return (
              <button key={p.id} data-glide={p.id} data-fx type="button" className="ac-crew-card" style={{ animationDelay: `${i * 40}ms` }} onClick={() => setOpenId(p.id)}>
                <FxLayer />
                <span className="ac-crew-rankpos"><RankBadge n={(safePage - 1) * size + i + 1} /></span>
                <div className="ac-crew-top">
                  <Avatar name={nameFor(p.name)} size={48} dot={p.onDuty} />
                  <div>
                    <strong>{nameFor(p.name)}{p.verified ? <BadgeCheck size={14} color="#7c3aed" /> : null}</strong>
                    <em>{p.rank}</em>
                    <small><MapPin size={11} /> {p.zone}</small>
                  </div>
                </div>
                <div className="ac-crew-tags">
                  <SortChip key={sortKey} label={rl} value={rv} tone={sortKey === "breach" && p.breaches ? "over" : ""} />
                  <span className="ac-tag violet"><Zap size={9} /> {expertiseLabel(p.expertise)}</span>
                  <span className={`ac-tag ${p.onDuty ? "green" : ""}`}>{p.onDuty ? "On duty" : p.duty === "break" ? "On break" : "Off duty"}</span>
                  {p.breaches ? <span className="ac-tag red"><Siren size={9} /> {p.breaches} breached</span> : null}
                </div>
                <div className={`ac-crew-load ${tone}`}>
                  <div><span>Open load</span><b>{p.load} / {CAPACITY}</b></div>
                  <span className="bar"><i style={{ width: `${Math.max(3, pct)}%` }} /></span>
                </div>
                <div className="ac-crew-stats">
                  <div><em>Open</em><b>{p.load}</b></div>
                  <div><em>Closed</em><b>{p.closed}</b></div>
                  <div className={p.breaches ? "warn" : ""}><em>Breached</em><b>{p.breaches}</b></div>
                </div>
              </button>
            );
          })}
        </section>
      )}

      <Pager page={safePage} pages={pages} total={list.length} size={size} onPage={setPage} onSize={setSize} sizes={[6, 9, 12]} />

      <StaffDetailsDrawer person={open} audit={audit} onClose={() => setOpenId(null)} onOpenIssue={(id) => { setOpenId(null); setIssueId(id); }} />
      <IssueDetailsDrawer issue={issue} onClose={() => setIssueId(null)} />
    </Command>
  );
}

export default StaffManagement;