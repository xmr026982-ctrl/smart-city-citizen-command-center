import { dayYear } from "../../utils/time";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMinute } from "../../hooks/useMinute";
import {
  Search, BadgeCheck, Shield, Users, X, Inbox, Zap, Mail, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, ArrowDownUp, Radio, RotateCcw, Clock, MapPin, Gauge,
  ArrowUpRight, Activity, Trash2, AlertTriangle, CheckCircle2, Radar, FileText,
  KeyRound, RefreshCw, Link2, Send, Lock, ChevronDown, Hourglass, Crosshair, CornerUpLeft, LocateFixed, FolderOpen,
} from "lucide-react";
import { ROLE_META } from "../../config/settingsSchema";
import {
  rejectRequest, removeStaff, setRank, setVerified,
  RANKS, EXPERTISE, EXPERIENCE, expertiseLabel, uplinkPhase, isAwaiting, canVerify, UPLINK_STALL_DAYS,
} from "../../store/staffDeskStore";
import { useFieldRoster, CAPACITY } from "../../store/fieldRoster";
import { acceptAndDispatch, retransmitKey, handleStaffUplinked, UPLINK_BACKEND } from "../../services/staffUplinkService";
import { useGlide } from "../../components/issues/admin/CommandKit";
import "../../styles/staff-desk.css";
import { nameFor, useNames } from "../../store/profileStore";

/* ------------------------------------------------------------------
   Staff Desk (admin). Field roster + clearance queue.
   Each tab has its own search, sort, filters and pager.

   Layout, top to bottom: telemetry line (live IST clock, zones covered),
   four instrument tiles, the Field Console (tabs + every filter in one
   glass bar; Expertise and Rank are dropdown chips), the results strip
   with the sort, the cards, the pager.

   Sorting: one slim console on the results line, right above the grid
   it orders. Pick a sort, click it again to flip the order (← → moves
   between sorts from the keyboard). The results line says what the order
   means, every card shows its position (#01), the part of the card the
   order is ranked by lights up, and the cards glide into their new places.
   "Uplink first" (the default) puts the people who need action on top:
   key sending / not sent / stalled / awaiting, then the just uplinked.
   Every other sort ranks the whole roster, nobody is pinned.

   Target lock: "Manage on Staff Desk" in a personnel file (Staff
   Management, Audit Log) lands here with { target, from } in the route
   state. The desk opens On field, clears search, filters and sort, jumps
   to the page that holds the person, glides to the card and locks on
   (brackets, sweep, pulse; the other cards step back). A target bar
   names them and offers Open file (Enter), Back to where you came from,
   and Release (Esc). The field file opens by itself after the lock plays.
   The lock turns green and lets go once their rank or badge changes, and
   turns red if they are no longer on the field. Same rules as the
   Reassign lock on Assign Issues; the route state is wiped on arrival so
   Back or a reload never locks again.
------------------------------------------------------------------- */

const PAGE_SIZES = [6, 9, 12];
const LOCK_OPEN_MS = 900; // the field file opens after the lock has played
const FROM_LABEL = { "/admin/staff": "Staff Management", "/admin/audit": "Audit Log" };
const LATE_DAYS = 5; // a clearance request waiting this long is overdue

// dir = default direction; desc / asc = how each direction reads
const FIELD_SORTS = [
  { id: "uplink", label: "Uplink first", dir: "desc", desc: "Needs action first", asc: "Settled staff first" },
  { id: "name", label: "Name", dir: "asc", desc: "Name Z–A", asc: "Name A–Z" },
  { id: "load", label: "Load", dir: "desc", desc: "Heaviest load first", asc: "Lightest load first" },
  { id: "closed", label: "Closed", dir: "desc", desc: "Most closed first", asc: "Fewest closed first" },
  { id: "rank", label: "Rank", dir: "desc", desc: "Senior first", asc: "Junior first" },
];
const QUEUE_SORTS = [
  { id: "wait", label: "Waiting", dir: "desc", desc: "Waiting longest first", asc: "Newest request first" },
  { id: "name", label: "Name", dir: "asc", desc: "Name Z–A", asc: "Name A–Z" },
  { id: "zone", label: "Zone", dir: "asc", desc: "Zone Z–A", asc: "Zone A–Z" },
];
const FIELD_DIR = Object.fromEntries(FIELD_SORTS.map((o) => [o.id, o.dir]));
const QUEUE_DIR = Object.fromEntries(QUEUE_SORTS.map((o) => [o.id, o.dir]));

// "Uplink first" order: who needs action most (lower = sooner), everyone else after
const URGENCY = { sending: 0, failed: 1, stalled: 2, awaiting: 3, fresh: 4 };

const daysSince = (iso) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 864e5));

// "just now" / "3h ago" / "2d ago"
function rel(iso) {
  if (!iso) return "—";
  const h = (Date.now() - new Date(iso).getTime()) / 36e5;
  if (h < 1 / 60) return "just now";
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m ago`;
  if (h < 24) return `${Math.round(h)}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// File code from the full first name: "Priyanka Das" -> "PRIYANKA".
const fileCode = (name) => (name.trim().split(/\s+/)[0] || "STAFF").toUpperCase();

const stamp = (iso) =>
  iso ? dayYear(iso) : "—";

// The arrival flash plays once per browser for each newly uplinked person.
const SEEN_KEY = "staff-desk-uplink-seen";
function readSeen() {
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || "[]")); } catch { return new Set(); }
}
function writeSeen(set) {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify([...set].slice(-200))); } catch { /* blocked */ }
}

function StaffDesk() {
  useNames(); // names follow each person's current display name
  const { roster, requests } = useFieldRoster(); // live load/closed from the issue board
  const tick = useMinute(); // uplink stalls, "3h ago" and wait days stay live
  const acc = ROLE_META.admin.acc;
  const searchRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();

  const [tab, setTab] = useState(location.state?.tab === "queue" ? "queue" : "field");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState("");
  const [reqId, setReqId] = useState("");

  // field roster controls
  const [rank, setRankFilter] = useState("all");
  const [skill, setSkill] = useState("all");
  const [dutyOnly, setDutyOnly] = useState(false);
  const [uplinkOnly, setUplinkOnly] = useState(Boolean(location.state?.uplinkOnly));
  const [seen, setSeen] = useState(readSeen);
  const markSeen = (id) => setSeen((prev) => {
    if (prev.has(id)) return prev;
    const next = new Set(prev).add(id);
    writeSeen(next);
    return next;
  });
  const [fieldSort, setFieldSort] = useState("uplink");
  const [fieldDir, setFieldDir] = useState("desc");
  const [fieldPage, setFieldPage] = useState(1);

  // clearance queue controls
  const [qSkill, setQSkill] = useState("all");
  const [qExp, setQExp] = useState("all");
  const [qLate, setQLate] = useState(false);
  const [queueSort, setQueueSort] = useState("wait");
  const [queueDir, setQueueDir] = useState("desc");
  const [queuePage, setQueuePage] = useState(1);

  const [pageSize, setPageSize] = useState(6);

  // target lock: { id, from, at, base: { rank, verified }, open }
  const [target, setTarget] = useState(null);
  const scrolledRef = useRef(0);

  const needle = q.trim().toLowerCase();

  const list = useMemo(() => {
    const out = roster.filter((p) => {
      if (rank !== "all" && p.rank !== rank) return false;
      if (skill !== "all" && p.expertise !== skill) return false;
      if (dutyOnly && !p.onDuty) return false;
      if (uplinkOnly && !isAwaiting(p)) return false;
      if (!needle) return true;
      return [p.name, p.zone, p.rank, p.email, expertiseLabel(p.expertise)].join(" ").toLowerCase().includes(needle);
    });
    // each comparator is written for its default direction; the other direction flips it
    const flip = fieldDir === FIELD_DIR[fieldSort] ? 1 : -1;
    out.sort((a, b) => {
      let d = 0;
      if (fieldSort === "uplink") {
        const pa = uplinkPhase(a);
        const pb = uplinkPhase(b);
        d = (URGENCY[pa] ?? 9) - (URGENCY[pb] ?? 9);
        // inside a group: the most recent clearance / first sign-in first
        if (!d && pa in URGENCY) d = new Date(b.uplinkedAt || b.acceptedAt || 0) - new Date(a.uplinkedAt || a.acceptedAt || 0);
      } else if (fieldSort === "load") d = b.load - a.load;
      else if (fieldSort === "closed") d = b.closed - a.closed;
      else if (fieldSort === "rank") d = RANKS.indexOf(b.rank) - RANKS.indexOf(a.rank);
      else d = a.name.localeCompare(b.name);
      return d * flip || a.name.localeCompare(b.name);
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roster, rank, skill, dutyOnly, uplinkOnly, needle, fieldSort, fieldDir, tick]);

  const queue = useMemo(() => {
    const out = requests.filter((r) => {
      if (qSkill !== "all" && r.expertise !== qSkill) return false;
      if (qExp !== "all" && r.experience !== qExp) return false;
      if (qLate && daysSince(r.filedAt) < LATE_DAYS) return false;
      if (!needle) return true;
      return [r.name, r.zone, r.experience, expertiseLabel(r.expertise)].join(" ").toLowerCase().includes(needle);
    });
    const flip = queueDir === QUEUE_DIR[queueSort] ? 1 : -1;
    out.sort((a, b) => {
      let d;
      if (queueSort === "wait") d = new Date(a.filedAt) - new Date(b.filedAt); // filed earliest = waiting longest
      else if (queueSort === "zone") d = a.zone.localeCompare(b.zone);
      else d = a.name.localeCompare(b.name);
      return d * flip || a.name.localeCompare(b.name);
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requests, qSkill, qExp, qLate, needle, queueSort, queueDir, tick]);

  // back to page 1 whenever the result set changes shape
  useEffect(() => { setFieldPage(1); }, [rank, skill, dutyOnly, uplinkOnly, needle, fieldSort, fieldDir, pageSize]);
  useEffect(() => { setQueuePage(1); }, [qSkill, qExp, qLate, needle, queueSort, queueDir, pageSize]);

  // cards glide to their new places when the sort or its direction changes
  const gridRef = useRef(null);
  useGlide(gridRef, tab === "field" ? `f-${fieldSort}-${fieldDir}` : `q-${queueSort}-${queueDir}`);

  const fieldPages = Math.max(1, Math.ceil(list.length / pageSize));
  const queuePages = Math.max(1, Math.ceil(queue.length / pageSize));
  const fPage = Math.min(fieldPage, fieldPages);
  const qPage = Math.min(queuePage, queuePages);
  const fieldSlice = list.slice((fPage - 1) * pageSize, fPage * pageSize);
  const queueSlice = queue.slice((qPage - 1) * pageSize, qPage * pageSize);

  const page = tab === "field" ? fPage : qPage;
  const pages = tab === "field" ? fieldPages : queuePages;
  const total = tab === "field" ? list.length : queue.length;
  const goPage = (n) => {
    const next = Math.min(Math.max(1, n), pages);
    if (next === page) return;
    if (tab === "field") setFieldPage(next); else setQueuePage(next);
    // bring the new page into view
    requestAnimationFrame(() => document.querySelector(".dk-result")?.scrollIntoView({ block: "start", behavior: "smooth" }));
  };

  // keyboard: "/" focuses search, ← / → flip pages (when no door is open)
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target.tagName || "").toLowerCase();
      if (["input", "select", "textarea"].includes(tag) || openId || reqId) return;
      if (e.target.closest?.(".dk-sorter, .dk-fchip-wrap")) return; // the sort and the filter menus use the arrow keys themselves
      if (e.key === "/") { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === "ArrowRight") goPage(page + 1);
      if (e.key === "ArrowLeft") goPage(page - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const open = roster.find((p) => p.id === openId) || null;
  const request = requests.find((r) => r.id === reqId) || null;

  const verified = roster.filter((p) => p.verified).length;
  const awaiting = roster.filter(isAwaiting).length;
  const stalled = roster.filter((p) => ["stalled", "failed"].includes(uplinkPhase(p))).length;
  const onDuty = roster.filter((p) => p.onDuty).length;
  const avgLoad = roster.length ? roster.reduce((s, p) => s + p.load, 0) / roster.length : 0;
  const oldestWait = requests.length ? Math.max(...requests.map((r) => daysSince(r.filedAt))) : 0;
  const pct = (n) => (roster.length ? Math.round((n / roster.length) * 100) : 0);
  const lateCount = requests.filter((r) => daysSince(r.filedAt) >= LATE_DAYS).length;
  // zones with at least one signed-in member on duty

  // dropdown options with live counts
  const skillOptions = (items) => [
    { id: "all", label: "All expertise", count: items.length },
    ...EXPERTISE.map((e) => ({ id: e.id, label: e.label, count: items.filter((x) => x.expertise === e.id).length })),
  ];
  const expOptions = [
    { id: "all", label: "All experience", count: requests.length },
    ...EXPERIENCE.map((x) => ({ id: x, label: x, count: requests.filter((r) => r.experience === x).length })),
  ];
  const rankOptions = [
    { id: "all", label: "All ranks", count: roster.length },
    ...RANKS.map((r) => ({ id: r, label: r, count: roster.filter((p) => p.rank === r).length })),
  ];

  const fieldFiltered = rank !== "all" || skill !== "all" || dutyOnly || uplinkOnly || fieldSort !== "uplink" || fieldDir !== "desc";
  const queueFiltered = qSkill !== "all" || qExp !== "all" || qLate || queueSort !== "wait" || queueDir !== "desc";
  const resetField = () => { setRankFilter("all"); setSkill("all"); setDutyOnly(false); setUplinkOnly(false); setFieldSort("uplink"); setFieldDir("desc"); };
  const resetQueue = () => { setQSkill("all"); setQExp("all"); setQLate(false); setQueueSort("wait"); setQueueDir("desc"); };

  // the sort bar of the open tab
  const sorts = tab === "field" ? FIELD_SORTS : QUEUE_SORTS;
  const sortKey = tab === "field" ? fieldSort : queueSort;
  const sortDir = tab === "field" ? fieldDir : queueDir;
  const pickSort = (id) => {
    const opt = sorts.find((o) => o.id === id);
    const dir = id === sortKey ? (sortDir === "asc" ? "desc" : "asc") : opt.dir;
    if (tab === "field") { setFieldSort(id); setFieldDir(dir); } else { setQueueSort(id); setQueueDir(dir); }
  };
  const sortNow = sorts.find((o) => o.id === sortKey);

  /* ---------- target lock ---------- */
  // clear the way to the person, then lock on
  const focusOn = (id, from = null, autoOpen = false) => {
    const person = roster.find((p) => p.id === id);
    setOpenId("");
    setReqId("");
    if (!person) { setTarget({ id, from, at: Date.now(), gone: true }); return; }
    setTab("field");
    setQ("");
    resetField();
    setTarget({ id, from, at: Date.now(), base: { rank: person.rank, verified: person.verified }, open: autoOpen });
  };

  // arrival from a personnel file (route state), then wipe the state so Back / reload never re-lock
  useEffect(() => {
    const st = location.state;
    if (!st?.target) return;
    navigate(location.pathname, { replace: true, state: null });
    focusOn(st.target, st.from && st.from !== location.pathname ? st.from : null, st.open !== false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  const lockedPerson = target && !target.gone ? roster.find((p) => p.id === target.id) || null : null;
  // removed while locked
  const targetGone = Boolean(target && (target.gone || !lockedPerson));
  // what changed since the lock (rank first, then the badge)
  const targetDone = !targetGone && lockedPerson && target.base
    ? lockedPerson.rank !== target.base.rank
      ? `Rank now ${lockedPerson.rank}`
      : lockedPerson.verified !== target.base.verified
        ? (lockedPerson.verified ? "Verified badge given" : "Verified badge removed")
        : ""
    : "";
  const targetIndex = lockedPerson && tab === "field" ? list.findIndex((p) => p.id === target.id) : -1;
  const targetOnPage = targetIndex >= 0 && Math.floor(targetIndex / pageSize) + 1 === fPage;

  // jump to the page that holds the target (runs after the page-1 resets above)
  useEffect(() => {
    if (!target || targetIndex < 0) return;
    setFieldPage(Math.floor(targetIndex / pageSize) + 1);
  }, [target?.at, targetIndex, pageSize]); // eslint-disable-line react-hooks/exhaustive-deps

  // glide to the card once per lock
  useEffect(() => {
    if (!target || !targetOnPage || scrolledRef.current === target.at) return undefined;
    const t = setTimeout(() => {
      const card = document.querySelector(`[data-person="${target.id}"]`);
      if (!card) return;
      scrolledRef.current = target.at;
      card.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 120);
    return () => clearTimeout(t);
  });

  // the field file opens by itself once the lock has played (arrivals only)
  useEffect(() => {
    if (!target?.open || targetGone) return undefined;
    const id = target.id;
    const t = setTimeout(() => {
      setOpenId(id);
      setTarget((cur) => (cur && cur.at === target.at ? { ...cur, open: false } : cur));
    }, LOCK_OPEN_MS);
    return () => clearTimeout(t);
  }, [target?.at, target?.open, targetGone]); // eslint-disable-line react-hooks/exhaustive-deps

  // a finished or lost target lets go on its own (not while their file is open)
  useEffect(() => {
    if (!target || openId || (!targetDone && !targetGone)) return undefined;
    const t = setTimeout(() => setTarget(null), targetGone ? 8000 : 6000);
    return () => clearTimeout(t);
  }, [target, targetDone, targetGone, openId]);

  // Enter = open their file, Esc = release (the open door and the menus keep their own keys)
  useEffect(() => {
    if (!target) return undefined;
    const onKey = (e) => {
      const tag = (e.target.tagName || "").toLowerCase();
      if (["input", "select", "textarea", "button", "a"].includes(tag)) return;
      if (e.target.closest?.(".dk-sorter, .dk-fchip-wrap") || document.querySelector("[aria-modal='true']")) return;
      if (e.key === "Escape") { e.stopImmediatePropagation(); setTarget(null); }
      if (e.key === "Enter" && lockedPerson) { e.preventDefault(); setOpenId(lockedPerson.id); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [target, lockedPerson]);

  return (
    <main className="page desk" style={{ "--acc": acc }}>
      <span className="dk-aurora" aria-hidden />

      <header className="dk-head">
        <div>
          <h1>Staff Desk</h1>
          <p className="dk-sub">Field clearance. Rank is seniority. Expertise is the work they take.</p>
        </div>
        <div className="dk-head-tools">
          <label className="dk-search">
            <Search size={15} />
            <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder={tab === "field" ? "Search staff" : "Search requests"} aria-label="Search" />
            {q ? (
              <button type="button" className="dk-clear" onClick={() => setQ("")} aria-label="Clear search"><X size={13} /></button>
            ) : (
              <kbd>/</kbd>
            )}
          </label>
        </div>
      </header>

      <section className="dk-tiles">
        <Tile
          index={1}
          icon={Users}
          label="On field"
          value={roster.length}
          sub={awaiting ? `${awaiting} awaiting uplink${stalled ? ` · ${stalled} stalled` : ""}` : `${EXPERTISE.length} expertise lines · all uplinked`}
          meter={pct(roster.length - awaiting)}
          signal={awaiting ? (stalled ? "late" : "wait") : ""}
        />
        <Tile index={2} icon={BadgeCheck} label="Verified" value={verified} sub={`${pct(verified)}% of the field`} meter={pct(verified)} />
        <Tile index={3} icon={Shield} label="On duty" value={onDuty} sub={`Avg load ${avgLoad.toFixed(1)} / ${CAPACITY}`} meter={pct(onDuty)} />
        <Tile index={4} icon={Inbox} label="Clearance" value={requests.length} sub={requests.length ? `Oldest waits ${oldestWait}d` : "Queue is clear"} meter={Math.min(100, oldestWait * 10)} warn={oldestWait >= 5} />
      </section>

      <section className="dk-console" aria-label="Field console">
        <span className="dk-console-tag" aria-hidden>Field console</span>
        <i className="dk-hud" aria-hidden />
        <div className="dk-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "field"} className={tab === "field" ? "on" : ""} onClick={() => setTab("field")}>
            <Users size={14} /> On field <em>{roster.length}</em>
          </button>
          <button type="button" role="tab" aria-selected={tab === "queue"} className={tab === "queue" ? "on" : ""} onClick={() => setTab("queue")}>
            <Inbox size={14} /> Clearance queue <em className={requests.length ? "hot" : ""}>{requests.length}</em>
          </button>
        </div>

        {tab === "field" ? (
          <div className="dk-console-tools">
            <FilterMenu label="Expertise" unit="lines" value={skill} options={skillOptions(roster)} onPick={setSkill} />
            <FilterMenu label="Rank" unit="ranks" value={rank} options={rankOptions} onPick={setRankFilter} />
            <i className="dk-console-sep" aria-hidden />
            <button type="button" role="switch" aria-checked={dutyOnly} className={`dk-switch${dutyOnly ? " on" : ""}`} onClick={() => setDutyOnly((v) => !v)}>
              <span className="dk-switch-track" aria-hidden><i /></span> On duty
            </button>
            {(awaiting > 0 || uplinkOnly) && (
              <button type="button" aria-pressed={uplinkOnly} className={`dk-qf${uplinkOnly ? " on" : ""}`} onClick={() => setUplinkOnly((v) => !v)}>
                <SignalBars level={2} /> Awaiting uplink <em>{String(awaiting).padStart(2, "0")}</em>
              </button>
            )}
            {fieldFiltered && (
              <button type="button" className="dk-reset" onClick={resetField} title="Reset filters and sort" aria-label="Reset filters and sort"><RotateCcw size={14} /></button>
            )}
          </div>
        ) : (
          <div className="dk-console-tools">
            <FilterMenu label="Expertise" unit="lines" value={qSkill} options={skillOptions(requests)} onPick={setQSkill} />
            <FilterMenu label="Experience" unit="levels" value={qExp} options={expOptions} onPick={setQExp} />
            <i className="dk-console-sep" aria-hidden />
            {(lateCount > 0 || qLate) && (
              <button type="button" aria-pressed={qLate} className={`dk-qf${qLate ? " on" : ""}`} onClick={() => setQLate((v) => !v)} title={`Requests waiting ${LATE_DAYS} days or more`}>
                <Hourglass size={13} /> Waiting {LATE_DAYS}d+ <em>{String(lateCount).padStart(2, "0")}</em>
              </button>
            )}
            {queueFiltered && (
              <button type="button" className="dk-reset" onClick={resetQueue} title="Reset filters and sort" aria-label="Reset filters and sort"><RotateCcw size={14} /></button>
            )}
          </div>
        )}
      </section>

      {target ? (
        <TargetBar
          target={target}
          person={lockedPerson}
          gone={targetGone}
          done={targetDone}
          onPage={targetOnPage}
          onOpen={() => lockedPerson && setOpenId(lockedPerson.id)}
          onRelocate={() => focusOn(target.id, target.from)}
          onBack={() => navigate(target.from)}
          onRelease={() => setTarget(null)}
        />
      ) : null}

      {tab === "field" && (
        <>
          <ResultLine total={list.length} of={roster.length} page={fPage} size={pageSize} noun="staff" order={sortNow} dir={sortDir}>
            <SortConsole sorts={sorts} active={sortKey} dir={sortDir} onPick={pickSort} />
          </ResultLine>

          {!list.length && <div className="dk-empty">No staff match.</div>}
          <section className={`dk-grid by-${fieldSort}${targetOnPage ? " targeting" : ""}`} ref={gridRef} key={`f-${fPage}-${pageSize}`}>
            {fieldSlice.map((p, i) => {
              const loadPct = Math.min(100, Math.round((p.load / CAPACITY) * 100));
              const tone = loadPct >= 84 ? "hot" : loadPct >= 50 ? "mid" : "cool";
              const phase = uplinkPhase(p);
              const waiting = isAwaiting(p);
              const arrive = phase === "fresh" && !seen.has(p.id);
              const locked = target && !targetGone && target.id === p.id;
              const cls = `dk-card tilt${waiting ? ` up-wait up-${phase}` : ""}${arrive ? " up-arrive" : ""}${locked ? ` locked${targetDone ? " done" : ""}` : ""}`;
              return (
                <button key={p.id} data-glide={p.id} data-person={p.id} type="button" className={cls} style={{ animationDelay: `${i * 45}ms` }} onClick={() => setOpenId(p.id)}>
                  <span className="tilt-glare" />
                  <span className="dk-card-edge" aria-hidden />
                  <i className="dk-hud" aria-hidden />
                  <span className="dk-rank">#{String((fPage - 1) * pageSize + i + 1).padStart(2, "0")}</span>
                  {locked ? (
                    <span className="dk-lockset" key={target.at} aria-hidden>
                      <i className="tl" /><i className="tr" /><i className="bl" /><i className="br" />
                      <s className="dk-lock-sweep" />
                    </span>
                  ) : null}
                  {arrive && (
                    <span className="dk-uplink-burst" aria-hidden onAnimationEnd={(e) => { if (e.animationName === "dkUpWipe") markSeen(p.id); }}>
                      <i className="wipe" /><i className="ring" />
                    </span>
                  )}
                  <Mark name={nameFor(p.name)} on={waiting ? undefined : p.onDuty} />
                  <div className="dk-ident">
                    <strong>{nameFor(p.name)}{p.verified && <BadgeCheck size={14} className="dk-tick" />}</strong>
                    <em>{p.rank}</em>
                    <span><MapPin size={11} /> {p.zone}</span>
                  </div>
                  <div className="dk-pills">
                    <UplinkChip person={p} phase={phase} />
                    <i className="skill"><Zap size={10} /> {expertiseLabel(p.expertise)}</i>
                    {p.verified && <i className="ok">Verified</i>}
                    {!waiting && <i className={p.onDuty ? "on" : ""}>{p.onDuty ? "On duty" : p.duty === "break" ? "On break" : "Off duty"}</i>}
                  </div>
                  {waiting ? (
                    <div className={`dk-upline ${phase}`}>
                      <span className="dk-upline-icon"><KeyRound size={12} /></span>
                      <span className="dk-upline-copy">
                        {phase === "sending" && <>Transmitting activation key<b className="dots"><i /><i /><i /></b></>}
                        {phase === "failed" && <>Key not sent · open to re-transmit</>}
                        {phase === "stalled" && <>Uplink stalled · key sent {rel(p.keySentAt || p.acceptedAt)}</>}
                        {phase === "awaiting" && <>Key sent {rel(p.keySentAt || p.acceptedAt)} · waiting for first sign-in</>}
                      </span>
                      <span className="dk-upline-wave" aria-hidden><i /><i /><i /><i /><i /></span>
                    </div>
                  ) : (
                    <div className={`dk-load ${tone}`}>
                      <div className="dk-load-top">
                        <span><Gauge size={11} /> Load</span>
                        <b>{p.load} / {CAPACITY}</b>
                      </div>
                      <span className="dk-load-bar"><i style={{ width: `${loadPct}%` }} /></span>
                    </div>
                  )}
                  <dl>
                    <div><dt>Closed</dt><dd>{p.closed}</dd></div>
                    <div><dt>Rank</dt><dd>{String(RANKS.indexOf(p.rank) + 1).padStart(2, "0")}</dd></div>
                  </dl>
                </button>
              );
            })}
          </section>
        </>
      )}

      {tab === "queue" && (
        <>
          <ResultLine total={queue.length} of={requests.length} page={qPage} size={pageSize} noun="requests" order={sortNow} dir={sortDir}>
            <SortConsole sorts={sorts} active={sortKey} dir={sortDir} onPick={pickSort} />
          </ResultLine>

          {!queue.length && <div className="dk-empty">{requests.length ? "No request matches." : "Clearance queue is clear."}</div>}
          <section className={`dk-grid by-${queueSort}`} ref={gridRef} key={`q-${qPage}-${pageSize}`}>
            {queueSlice.map((r, i) => {
              const wait = daysSince(r.filedAt);
              return (
                <button key={r.id} data-glide={r.id} type="button" className="dk-card tilt pending" style={{ animationDelay: `${i * 45}ms` }} onClick={() => setReqId(r.id)}>
                  <span className="tilt-glare" />
                  <span className="dk-card-edge" aria-hidden />
                  <i className="dk-hud" aria-hidden />
                  <span className="dk-rank">#{String((qPage - 1) * pageSize + i + 1).padStart(2, "0")}</span>
                  <Mark name={r.name} />
                  <div className="dk-ident">
                    <strong>{r.name}</strong>
                    <em>Awaiting clearance</em>
                    <span><MapPin size={11} /> {r.zone}</span>
                  </div>
                  <div className="dk-pills">
                    <i className="skill"><Zap size={10} /> {expertiseLabel(r.expertise)}</i>
                    <i>{r.experience}</i>
                    <i className={`wait${wait >= LATE_DAYS ? " late" : ""}`}><Clock size={10} /> {wait ? `${wait}d waiting` : "Filed today"}</i>
                  </div>
                  <p className={`dk-qual${r.note ? "" : " empty"}`}>{r.note || "No note added."}</p>
                </button>
              );
            })}
          </section>
        </>
      )}

      {total > 0 && (
        <Pager page={page} pages={pages} total={total} size={pageSize} onPage={goPage} onSize={setPageSize} />
      )}

      {open && <PersonDoor person={open} roster={roster} onClose={() => setOpenId("")} />}
      {request && <RequestDoor request={request} roster={roster} onClose={() => setReqId("")} />}
    </main>
  );
}

/* ------------------------------------------------------------------ target bar */

// Names the locked person and what you can do with them. Violet while locked,
// green once their rank or badge changed, red if they are no longer on the field.
function TargetBar({ target, person, gone, done, onPage, onOpen, onRelocate, onBack, onRelease }) {
  const tone = gone ? " gone" : done ? " done" : "";
  const code = `STF-${fileCode(person?.name || target.id.replace(/^staff-/, ""))}`;
  return (
    <div className={`dk-target${tone}`} role="status" key={target.at}>
      <span className="dk-target-ic">{gone ? <AlertTriangle size={15} /> : done ? <CheckCircle2 size={15} /> : <Crosshair size={15} />}</span>
      <span className="dk-target-copy">
        <em>{gone ? "Target lost" : done ? "Updated" : "Target locked"}</em>
        <b>{code}</b>
        <span>
          {gone
            ? "No longer on the field. Their past files stay in the Audit Log."
            : done
              ? <>{nameFor(person.name)} · {person.zone} · <strong>{done}</strong></>
              : <>{nameFor(person.name)} · {person.rank} · {person.zone}</>}
        </span>
      </span>
      <span className="dk-target-acts">
        {!gone && !onPage ? (
          <button type="button" className="dk-tbtn" onClick={onRelocate}><LocateFixed size={12} /> Relocate</button>
        ) : null}
        {!gone ? (
          <button type="button" className="dk-tbtn primary" onClick={onOpen}><FolderOpen size={12} /> Open file <kbd>Enter</kbd></button>
        ) : null}
        {target.from ? (
          <button type="button" className="dk-tbtn" onClick={onBack}><CornerUpLeft size={12} /> Back to {FROM_LABEL[target.from] || "previous page"}</button>
        ) : null}
        <button type="button" className="dk-tbtn ghost" onClick={onRelease}>Release <kbd>Esc</kbd></button>
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ sort console */

// One slim capsule: a ⇅ mark and the sorts, with a violet glider under the
// active one (its arrow shows the direction). A radio group: ← → / Home / End
// move between sorts, Enter or a second click flips the order.
function SortConsole({ sorts, active, dir, onPick }) {
  const railRef = useRef(null);
  const [glide, setGlide] = useState(null); // { x, w } of the active sort
  const [live, setLive] = useState(false); // slide only after the first placement

  useLayoutEffect(() => {
    const rail = railRef.current;
    if (!rail) return undefined;
    const place = () => {
      const on = rail.querySelector("button.on");
      setGlide(on ? { x: on.offsetLeft, w: on.offsetWidth } : null);
      // narrow screens: keep the active sort in view inside the sideways-scrolling rail
      if (on && rail.scrollWidth > rail.clientWidth) {
        rail.scrollTo({ left: Math.max(0, on.offsetLeft - (rail.clientWidth - on.offsetWidth) / 2), behavior: "smooth" });
      }
    };
    place();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(place) : null;
    ro?.observe(rail);
    document.fonts?.ready?.then(place).catch(() => {});
    return () => ro?.disconnect();
  }, [active, dir, sorts]);

  useEffect(() => {
    const t = requestAnimationFrame(() => setLive(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const onKey = (e) => {
    const i = sorts.findIndex((o) => o.id === active);
    let n = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") n = (i + 1) % sorts.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") n = (i - 1 + sorts.length) % sorts.length;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = sorts.length - 1;
    if (n < 0) return;
    e.preventDefault();
    e.stopPropagation();
    onPick(sorts[n].id);
    requestAnimationFrame(() => railRef.current?.querySelectorAll("button")[n]?.focus());
  };

  return (
    <div className="dk-sorter">
      <span className="dk-sorter-mark" aria-hidden><ArrowDownUp size={13} /></span>
      <div className="dk-sorter-rail" ref={railRef} role="radiogroup" aria-label="Sort by" onKeyDown={onKey}>
        {glide ? (
          <span className={`dk-sorter-glider${live ? " live" : ""}`} style={{ transform: `translateX(${glide.x}px)`, width: glide.w }} aria-hidden />
        ) : null}
        {sorts.map((s) => {
          const on = s.id === active;
          return (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              className={on ? "on" : ""}
              title={on ? `${dir === "asc" ? s.asc : s.desc} · click to flip` : `Sort by ${s.label.toLowerCase()}`}
              onClick={() => onPick(s.id)}
            >
              <span>{s.label}</span>
              {on ? <i className={`dk-sorter-dir ${dir}`} aria-label={dir === "asc" ? "ascending" : "descending"}>↓</i> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ filter menu */

// A dropdown chip: "EXPERTISE  All ▾". Opens a glass list with live counts and a
// share bar per option. ↑ ↓ / Home / End move, Enter picks, Esc or a click
// outside closes. A chip with a filter set turns violet.
function FilterMenu({ label, unit, value, options, onPick }) {
  const wrapRef = useRef(null);
  const btnRef = useRef(null);
  const listRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const [nudge, setNudge] = useState(0); // keeps the menu inside the screen on narrow layouts
  const at = Math.max(0, options.findIndex((o) => o.id === value));
  const max = Math.max(1, ...options.map((o) => o.count));
  const set = value !== "all";
  const uid = `dk-f-${label.toLowerCase()}`;

  const show = () => { setHi(at); setOpen(true); };
  const close = (refocus = true) => { setOpen(false); if (refocus) btnRef.current?.focus(); };
  const pick = (id) => { onPick(id); close(); };

  // keep the open menu inside the viewport (12px gutter)
  useLayoutEffect(() => {
    if (!open) { setNudge(0); return; }
    const box = listRef.current?.getBoundingClientRect();
    if (!box) return;
    const over = box.right - (window.innerWidth - 12);
    const under = 12 - box.left;
    setNudge(over > 0 ? -over : under > 0 ? under : 0);
  }, [open]);

  // focus the list when it opens; close on a click outside
  useEffect(() => {
    if (!open) return undefined;
    listRef.current?.focus();
    const away = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  const onKey = (e) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); e.stopPropagation(); show(); }
      return;
    }
    const last = options.length - 1;
    let n = -1;
    if (e.key === "ArrowDown") n = hi >= last ? 0 : hi + 1;
    else if (e.key === "ArrowUp") n = hi <= 0 ? last : hi - 1;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = last;
    if (n >= 0) { e.preventDefault(); e.stopPropagation(); setHi(n); return; }
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); pick(options[hi].id); return; }
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); return; }
    if (e.key === "Tab") setOpen(false);
  };

  return (
    <div className="dk-fchip-wrap" ref={wrapRef} onKeyDown={onKey}>
      <button
        ref={btnRef}
        type="button"
        className={`dk-fchip${set ? " set" : ""}${open ? " open" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? uid : undefined}
        onClick={() => (open ? close() : show())}
      >
        <em>{label}</em>
        <b>{set ? options[at]?.label : "All"}</b>
        <ChevronDown size={13} className="dk-fchip-car" />
      </button>
      {open && (
        <div
          className="dk-fmenu"
          id={uid}
          role="listbox"
          tabIndex={-1}
          ref={listRef}
          aria-label={label}
          aria-activedescendant={`${uid}-${hi}`}
          style={nudge ? { marginLeft: nudge } : undefined}
        >
          <p className="dk-fmenu-hd"><span>Filter · {label}</span><b>{options.length - 1} {unit}</b></p>
          {options.map((o, i) => {
            const on = o.id === value;
            return (
              <div
                key={o.id}
                id={`${uid}-${i}`}
                role="option"
                aria-selected={on}
                className={`dk-fopt${on ? " on" : ""}${i === hi ? " hi" : ""}`}
                onMouseEnter={() => setHi(i)}
                onClick={() => pick(o.id)}
              >
                <span>{o.label}</span>
                <small>{String(o.count).padStart(2, "0")}{on ? " ✓" : ""}</small>
                <i className="dk-fopt-bar" aria-hidden><s style={{ width: `${Math.round((o.count / max) * 100)}%` }} /></i>
              </div>
            );
          })}
          <p className="dk-fmenu-ft"><span><kbd>↑↓</kbd> Move</span><span><kbd>Enter</kbd> Pick</span><span><kbd>Esc</kbd> Close</span></p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ pager */

function pageWindow(page, pages) {
  // 1 … 4 5 [6] 7 8 … 12
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const out = [1];
  const from = Math.max(2, page - 1);
  const to = Math.min(pages - 1, page + 1);
  if (from > 2) out.push("gap-l");
  for (let n = from; n <= to; n += 1) out.push(n);
  if (to < pages - 1) out.push("gap-r");
  out.push(pages);
  return out;
}

function Pager({ page, pages, total, size, onPage, onSize }) {
  const from = (page - 1) * size + 1;
  const to = Math.min(total, page * size);
  const progress = pages > 1 ? ((page - 1) / (pages - 1)) * 100 : 100;

  return (
    <nav className="dk-pager" aria-label="Pages">
      <div className="dk-pager-read">
        <span className="dk-pager-range">{String(from).padStart(2, "0")}–{String(to).padStart(2, "0")}</span>
        <span className="dk-pager-of">of {total}</span>
      </div>

      <div className="dk-pager-core">
        <button type="button" className="dk-pg-step" onClick={() => onPage(1)} disabled={page === 1} aria-label="First page"><ChevronsLeft size={15} /></button>
        <button type="button" className="dk-pg-step" onClick={() => onPage(page - 1)} disabled={page === 1} aria-label="Previous page"><ChevronLeft size={15} /></button>
        <div className="dk-pg-nums">
          {pageWindow(page, pages).map((n) =>
            typeof n === "number" ? (
              <button key={n} type="button" className={n === page ? "on" : ""} aria-current={n === page ? "page" : undefined} onClick={() => onPage(n)}>
                {String(n).padStart(2, "0")}
              </button>
            ) : (
              <span key={n} className="dk-pg-gap">···</span>
            )
          )}
        </div>
        <button type="button" className="dk-pg-step" onClick={() => onPage(page + 1)} disabled={page === pages} aria-label="Next page"><ChevronRight size={15} /></button>
        <button type="button" className="dk-pg-step" onClick={() => onPage(pages)} disabled={page === pages} aria-label="Last page"><ChevronsRight size={15} /></button>
        <span className="dk-pg-track" aria-hidden><i style={{ width: `${progress}%` }} /></span>
      </div>

      <div className="dk-pager-size">
        <span>Per page</span>
        <div className="dk-seg small">
          {PAGE_SIZES.map((n) => (
            <button key={n} type="button" className={n === size ? "on" : ""} onClick={() => onSize(n)}>{n}</button>
          ))}
        </div>
        <kbd title="Use the arrow keys to flip pages">← →</kbd>
      </div>
    </nav>
  );
}

// the results line: count · what the order means · range, and the sort console on the right
function ResultLine({ total, of, page, size, noun, order, dir, children }) {
  if (!of) return null;
  const from = total ? (page - 1) * size + 1 : 0;
  const to = Math.min(total, page * size);
  const means = order ? (dir === "asc" ? order.asc : order.desc) : "";
  return (
    <div className="dk-result">
      <p className="dk-result-read" aria-live="polite">
        <span className="dk-result-dot" />
        <span>{total === of ? `${of} ${noun}` : `${total} of ${of} ${noun} match`}</span>
        {means ? <><b className="sep">·</b><span className="dk-result-order" key={means}>{means}</span></> : null}
        {total > 0 && <><b className="sep">·</b><b>{String(from).padStart(2, "0")}–{String(to).padStart(2, "0")}</b></>}
      </p>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ parts */

function Tile({ index, icon: Icon, label, value, sub, meter = 0, warn = false, signal = "" }) {
  return (
    <article className={`dk-tile tilt${warn ? " warn" : ""}`}>
      <span className="tilt-glare" />
      <i className="dk-hud" aria-hidden />
      <span className="dk-tile-idx" aria-hidden>{String(index).padStart(2, "0")} / 04</span>
      <header><Icon size={16} /><span>{label}</span></header>
      <strong>{value}</strong>
      <p className={`dk-tile-sub${signal ? ` sig ${signal}` : ""}`}>{signal ? <SignalBars level={signal === "late" ? 1 : 2} /> : null}{sub}</p>
      <span className="dk-tile-meter"><i style={{ width: `${Math.max(4, meter)}%` }} /></span>
      <span className="dk-tile-ruler" aria-hidden />
    </article>
  );
}

function Mark({ name, on }) {
  return (
    <span className="dk-avatar">
      <svg className="ring a" viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r="57" fill="none" stroke="currentColor" strokeWidth="1.4" strokeDasharray="2 7" />
      </svg>
      <svg className="ring b" viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r="51" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="70 250" />
        <circle cx="60" cy="60" r="51" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="24 296" strokeDashoffset="-170" opacity=".5" />
      </svg>
      <span className="core">
        <b>{initials(name)}</b>
        <i className="scanbar" />
      </span>
      {on !== undefined && <i className={`dk-beacon${on ? " on" : ""}`} aria-label={on ? "On duty" : "Off duty"} />}
    </span>
  );
}

/* ------------------------------------------------------------------ doors */

// Shared shell for both panels: veil, slide-in door, scan line, HUD corners, Escape to close.
function Door({ kicker, code, title, tone = "", onClose, children, footer }) {
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") closeRef.current(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div className="sd-veil" onClick={onClose}>
      <aside className={`sd-door ${tone}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <span className="sd-edge" aria-hidden />
        <span className="sd-scan" aria-hidden />
        <i className="sd-hud tl" aria-hidden /><i className="sd-hud tr" aria-hidden />
        <header className="sd-head">
          <div>
            <p className="sd-kicker">{kicker} <b>/</b> <span>{code}</span></p>
            <h2>{title}</h2>
          </div>
          <button type="button" className="sd-x" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </header>
        <div className="sd-body">{children}</div>
        {footer ? <footer className="sd-foot">{footer}</footer> : null}
      </aside>
    </div>
  );
}

// Rank ladder: five steps, the chosen one glows. Replaces the plain select.
function RankLadder({ value, onChange }) {
  const at = RANKS.indexOf(value);
  return (
    <div className="sd-ladder" role="radiogroup" aria-label="Rank">
      {RANKS.map((r, i) => (
        <button
          key={r}
          type="button"
          role="radio"
          aria-checked={r === value}
          className={`${i < at ? "past" : ""}${r === value ? " on" : ""}`}
          onClick={() => onChange(r)}
        >
          <span className="sd-rung"><i style={{ height: `${28 + i * 14}%` }} /></span>
          <b>{String(i + 1).padStart(2, "0")}</b>
          <em>{r}</em>
        </button>
      ))}
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub }) {
  return (
    <div className="sd-stat">
      <span><Icon size={14} /></span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        {sub ? <em>{sub}</em> : null}
      </div>
    </div>
  );
}

// Opens Gmail compose in a new tab, addressed to the staff member, subject pre-filled.
// Only accepted staff carry an email on this desk; clearance requests never show one.
function gmailLink(person) {
  const subject = `Smart Kolkata · Civic Command → ${person.name}`;
  const body = `Hello ${person.name.split(" ")[0]},\n\n\n\n— Civic Command, Smart Kolkata`;
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(person.email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function GmailGate({ person }) {
  const [copied, setCopied] = useState(false);
  const href = gmailLink(person);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(person.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <div className="sd-mail">
      <a className="sd-mail-main" href={href} target="_blank" rel="noopener noreferrer" title={`Write to ${person.name} in Gmail`}>
        <span className="sd-mail-icon"><Mail size={15} /></span>
        <span className="sd-mail-copy">
          <em>Contact through Gmail</em>
          <b>{person.email}</b>
        </span>
      </a>
      <button type="button" className="sd-mail-copybtn" onClick={copy} aria-label="Copy email">
        {copied ? "Copied" : "Copy"}
      </button>
      <a className="sd-mail-go" href={href} target="_blank" rel="noopener noreferrer">
        Open Gmail <ArrowUpRight size={13} />
      </a>
    </div>
  );
}

/* ------------------------------------------------------------------ uplink */

// Four signal bars; `level` of them lit.
function SignalBars({ level = 4 }) {
  return (
    <span className="dk-sig" aria-hidden>
      {[1, 2, 3, 4].map((n) => <i key={n} className={n <= level ? "on" : ""} />)}
    </span>
  );
}

const PHASE_CHIP = {
  sending: { text: "Transmitting key", level: 1 },
  failed: { text: "Key not sent", level: 0 },
  stalled: { text: "Uplink stalled", level: 1 },
  awaiting: { text: "Awaiting uplink", level: 2 },
  fresh: { text: "Uplinked", level: 4 },
};

function UplinkChip({ person, phase }) {
  const chip = PHASE_CHIP[phase];
  if (!chip) return null; // long-time live staff: no chip, card looks like everyone else
  return (
    <i className={`up-chip ${phase}`} title={phase === "fresh" ? `First sign-in ${rel(person.uplinkedAt)}` : undefined}>
      <SignalBars level={chip.level} />
      {chip.text}
      {phase === "fresh" && <em>{rel(person.uplinkedAt)}</em>}
    </i>
  );
}

// REQUESTED → CLEARED → KEY SENT → UPLINKED, with dates. Permanent record in the field file.
function UplinkTrace({ person }) {
  const phase = uplinkPhase(person);
  const steps = [
    { id: "req", label: "Requested", at: person.requestedAt },
    { id: "clr", label: "Cleared", at: person.acceptedAt },
    { id: "key", label: "Key sent", at: person.keySentAt },
    { id: "up", label: "Uplinked", at: person.uplinkedAt },
  ];
  const doneCount = person.uplink === "live" ? 4 : person.keySentAt ? 3 : 2;
  const current = person.uplink === "live" ? -1 : doneCount; // index of the pulsing step
  const fill = person.uplink === "live" ? 100 : ((doneCount - 1) / 3) * 100;

  return (
    <section className={`sd-panel sd-trace ph-${phase}`}>
      <p className="sd-label"><Link2 size={12} /> Uplink trace</p>
      <div className="sd-trace-track">
        <span className="sd-trace-rail" aria-hidden><i style={{ width: `${fill}%` }} /></span>
        {steps.map((st, i) => {
          const done = i < doneCount;
          const now = i === current;
          return (
            <div key={st.id} className={`sd-trace-step${done ? " done" : ""}${now ? " now" : ""}`}>
              <span className="sd-trace-node"><i /></span>
              <b>{st.label}</b>
              <em>{done ? stamp(st.at) : now ? (phase === "sending" ? "Transmitting" : phase === "failed" ? "Not sent" : "Pending") : "—"}</em>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// Shown instead of field performance while the person has not signed in yet.
function UplinkConsole({ person }) {
  const phase = uplinkPhase(person);
  const since = person.keySentAt || person.acceptedAt;
  const hours = since ? (Date.now() - new Date(since).getTime()) / 36e5 : 0;
  const limit = UPLINK_STALL_DAYS * 24;
  const pct = Math.min(100, Math.round((hours / limit) * 100));
  const busy = phase === "sending";
  const copy = {
    sending: "Accepted. The activation key is being sent to their mail now.",
    failed: "The activation key did not go out. Re-transmit it, or contact them through Gmail.",
    stalled: `No sign-in for ${Math.floor(hours / 24)} days. The key may be lost or expired. Re-transmit it or contact them.`,
    awaiting: "Accepted. They create a password from the one-time link, then sign in on the staff login page.",
  }[phase];

  return (
    <section className={`sd-panel sd-uplink ${phase}`}>
      <div className="sd-uplink-orb" aria-hidden>
        <i className="r1" /><i className="r2" /><i className="r3" />
        <span><KeyRound size={20} /></span>
      </div>
      <div className="sd-uplink-copy">
        <p className="sd-label"><Radar size={12} /> {PHASE_CHIP[phase]?.text || "Uplink"}</p>
        <p className="sd-uplink-text">{copy}</p>
        <div className="sd-uplink-meter">
          <div><span>Key age</span><b>{busy ? "—" : rel(since).replace(" ago", "")} / {UPLINK_STALL_DAYS}d</b></div>
          <span className="sd-bar"><i style={{ width: `${busy ? 4 : pct}%` }} /></span>
        </div>
        <div className="sd-uplink-actions">
          <button type="button" className="sd-retx" disabled={busy} onClick={() => retransmitKey(person.id)}>
            {busy ? <><Send size={14} /> Transmitting…</> : <><RefreshCw size={14} /> Re-transmit key</>}
          </button>
          {/* Dev-only stand-in: hidden in production builds and once the backend is connected. */}
          {import.meta.env?.DEV && !UPLINK_BACKEND && (
            <button
              type="button"
              className="sd-sim"
              disabled={busy}
              onClick={() => handleStaffUplinked({ email: person.email })}
              title="Development only. In production the backend signals the first sign-in."
            >
              <em>DEV</em> Simulate first sign-in
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

// Verified badge switch. Locked (visible, dimmed, with the reason) until the person is uplinked.
function VerifySwitch({ person, phase }) {
  const locked = !canVerify(person);
  const lockCopy = {
    sending: "Locked · activation key is still transmitting",
    failed: "Locked · activation key not sent",
    stalled: "Locked · uplink stalled, no first sign-in yet",
    awaiting: "Locked · unlocks after their first sign-in",
  }[phase] || "Locked · unlocks after their first sign-in";
  const copy = locked
    ? lockCopy
    : person.verified
      ? "Shown on their card and files"
      : phase === "fresh"
        ? "Unlocked · uplink confirmed. Give the badge once checked"
        : "Give the badge once checked";

  return (
    <button
      type="button"
      className={`sd-switch${person.verified ? " on" : ""}${locked ? ` locked ${phase}` : ""}${!locked && phase === "fresh" ? " unlocked" : ""}`}
      onClick={() => { if (!locked) setVerified(person.id, !person.verified); }}
      aria-pressed={person.verified}
      aria-disabled={locked}
      disabled={locked}
      title={locked ? "The Verified badge unlocks once they sign in for the first time" : undefined}
    >
      <span className="sd-switch-copy">
        {locked ? <Lock size={16} /> : <BadgeCheck size={16} />}
        <span>
          <b>Verified badge</b>
          <em>{copy}</em>
        </span>
      </span>
      <span className="sd-toggle">{locked ? <Lock size={10} className="sd-toggle-lock" /> : null}<i /></span>
    </button>
  );
}

function PersonDoor({ person, roster, onClose }) {
  const [confirm, setConfirm] = useState(false);
  const loadPct = Math.min(100, Math.round((person.load / CAPACITY) * 100));
  const loadTone = loadPct >= 84 ? "hot" : loadPct >= 50 ? "mid" : "cool";
  const handled = person.load + person.closed;
  const closeRate = handled ? Math.round((person.closed / handled) * 100) : 0;
  const peers = roster.filter((p) => p.expertise === person.expertise);
  const standing = [...peers].sort((a, b) => b.closed - a.closed).findIndex((p) => p.id === person.id) + 1;
  const code = `STF-${fileCode(person.name)}`;
  const phase = uplinkPhase(person);
  const waiting = isAwaiting(person);

  return (
    <Door kicker="FIELD FILE" code={code} title={nameFor(person.name)} tone={waiting ? `up-wait up-${phase}` : ""} onClose={onClose}>
      <section className="sd-hero">
        <Mark name={nameFor(person.name)} on={waiting ? undefined : person.onDuty} />
        <div className="sd-hero-copy">
          <strong>{person.rank}</strong>
          <span><Zap size={12} /> {expertiseLabel(person.expertise)} <b>·</b> <MapPin size={12} /> {person.zone}</span>
          <div className="sd-chips">
            <UplinkChip person={person} phase={phase} />
            {!waiting && <i className={person.onDuty ? "on" : ""}><Radio size={10} /> {person.onDuty ? "On duty" : person.duty === "break" ? "On break" : "Off duty"}</i>}
            <i className={person.verified ? "ok" : "warn"}><BadgeCheck size={10} /> {person.verified ? "Verified" : "Unverified"}</i>
            {person.experience ? <i>{person.experience}</i> : null}
          </div>
        </div>
      </section>

      {person.email ? <GmailGate person={person} /> : (
        <p className="sd-mail-held"><Lock size={12} /> Official email is held on the server and shown to command only.</p>
      )}

      <UplinkTrace person={person} />

      {waiting && <UplinkConsole person={person} />}

      {!waiting && <section className="sd-panel sd-perf">
        <div className="sd-dial" style={{ "--p": closeRate }}>
          <span><strong>{closeRate}%</strong><em>closed</em></span>
        </div>
        <div className="sd-perf-copy">
          <p className="sd-label"><Activity size={12} /> Field performance</p>
          <div className={`sd-loadline ${loadTone}`}>
            <div><span>Open load</span><b>{person.load} / {CAPACITY}</b></div>
            <span className="sd-bar"><i style={{ width: `${loadPct}%` }} /></span>
          </div>
          <div className="sd-mini">
            <div><em>Closed</em><b>{person.closed}</b></div>
            <div><em>Handled</em><b>{handled}</b></div>
            <div><em>Standing</em><b>{standing ? `#${standing}` : "—"}<small>/{peers.length}</small></b></div>
          </div>
        </div>
      </section>}

      <section className="sd-grid">
        <Stat icon={Zap} label="Expertise" value={expertiseLabel(person.expertise)} />
        <Stat icon={MapPin} label="Zone" value={person.zone} />
        <Stat icon={Shield} label="Rank level" value={`${String(RANKS.indexOf(person.rank) + 1).padStart(2, "0")} of ${RANKS.length}`} />
        <Stat icon={Users} label="Same expertise" value={`${peers.length} on field`} />
      </section>

      <section className="sd-panel sd-pad">
        <p className="sd-label"><Shield size={12} /> Clearance controls</p>
        <p className="sd-help">Rank is seniority. Pick a step to promote or step back.</p>
        <RankLadder value={person.rank} onChange={(r) => setRank(person.id, r)} />

        <VerifySwitch person={person} phase={phase} />
      </section>

      <section className="sd-danger">
        {!confirm ? (
          <button type="button" className="sd-remove" onClick={() => setConfirm(true)}>
            <Trash2 size={15} /> Remove from the system
          </button>
        ) : (
          <div className="sd-confirm">
            <p className="sd-confirm-kicker"><AlertTriangle size={12} /> CONFIRM REMOVAL</p>
            <strong>{nameFor(person.name)}</strong>
            <p>
              This removes them from the system. They leave the field and this desk. Past files stay in the record.
              {person.load ? <> Their <b>{person.load} open issue{person.load === 1 ? "" : "s"}</b> go back to dispatch for a new owner.</> : null}
            </p>
            <div>
              <button type="button" className="sd-kill" onClick={() => { removeStaff(person.id); onClose(); }}>Remove from the system</button>
              <button type="button" className="sd-ghost" onClick={() => setConfirm(false)}>Keep</button>
            </div>
          </div>
        )}
      </section>
    </Door>
  );
}

function RequestDoor({ request, roster, onClose }) {
  const [rank, setRankValue] = useState("Field Operative");
  const [deny, setDeny] = useState(false);
  const wait = daysSince(request.filedAt);
  const sameSkill = roster.filter((p) => p.expertise === request.expertise);
  const sameZone = roster.filter((p) => p.zone === request.zone);
  const both = sameSkill.filter((p) => p.zone === request.zone);
  const zoneLoad = sameZone.length ? sameZone.reduce((s, p) => s + p.load, 0) / sameZone.length : 0;
  const need = both.length === 0 ? "high" : zoneLoad >= CAPACITY * 0.6 ? "mid" : "low";
  const needCopy = {
    high: `No ${expertiseLabel(request.expertise)} crew on the field in ${request.zone}. This clearance fills a gap.`,
    mid: `${request.zone} crews are running heavy. One more hand eases the load.`,
    low: `${request.zone} is covered for ${expertiseLabel(request.expertise)}. Accept on merit.`,
  }[need];
  const code = `REQ-${fileCode(request.name)}`;

  const footer = !deny ? (
    <>
      <p className="sd-foot-note"><KeyRound size={12} /><span>Accept transmits a one-time activation key to their mail. They join On field as <b>Awaiting uplink</b> until their first sign-in.</span></p>
      <button type="button" className="sd-accept" onClick={() => { acceptAndDispatch(request.id, rank); onClose(); }}>
        <CheckCircle2 size={16} /> Accept as {rank}
      </button>
      <button type="button" className="sd-reject" onClick={() => setDeny(true)}>Reject</button>
    </>
  ) : null;

  return (
    <Door kicker="CLEARANCE" code={code} title={request.name} tone="pending" onClose={onClose} footer={footer}>
      <section className="sd-hero">
        <Mark name={request.name} />
        <div className="sd-hero-copy">
          <strong>Awaiting clearance</strong>
          <span><Zap size={12} /> {expertiseLabel(request.expertise)} <b>·</b> <MapPin size={12} /> {request.zone}</span>
          <div className="sd-chips">
            <i>{request.experience}</i>
            <i className={wait >= 5 ? "late" : "wait"}><Clock size={10} /> {wait ? `Waiting ${wait}d` : "Filed today"}</i>
          </div>
        </div>
      </section>

      <section className={`sd-need ${need}`}>
        <span className="sd-need-ring"><Radar size={16} /></span>
        <div>
          <p className="sd-label">Field need · {need === "high" ? "High" : need === "mid" ? "Medium" : "Low"}</p>
          <p>{needCopy}</p>
        </div>
      </section>

      <section className="sd-grid">
        <Stat icon={Zap} label="Same expertise" value={`${sameSkill.length} on field`} />
        <Stat icon={MapPin} label="In this zone" value={`${sameZone.length} on field`} sub={sameZone.length ? `Avg load ${zoneLoad.toFixed(1)}` : "No crew yet"} />
        <Stat icon={Clock} label="Filed" value={dayYear(request.filedAt)} />
        <Stat icon={Shield} label="Experience" value={request.experience} />
      </section>

      <section className="sd-panel sd-pad">
        <p className="sd-label"><FileText size={12} /> Filed note</p>
        <p className={`sd-note${request.note ? "" : " empty"}`}>{request.note || "No note added to this request."}</p>
      </section>

      <section className="sd-panel sd-pad">
        <p className="sd-label"><Shield size={12} /> Rank on accept</p>
        <p className="sd-help">Everyone usually starts as Field Operative.</p>
        <RankLadder value={rank} onChange={setRankValue} />
      </section>

      {deny && (
        <section className="sd-danger">
          <div className="sd-confirm">
            <p className="sd-confirm-kicker"><AlertTriangle size={12} /> DENY CLEARANCE</p>
            <strong>{request.name}</strong>
            <p>The request is closed. Access stays denied. This cannot be undone from here.</p>
            <div>
              <button type="button" className="sd-kill" onClick={() => { rejectRequest(request.id); onClose(); }}>Reject request</button>
              <button type="button" className="sd-ghost" onClick={() => setDeny(false)}>Keep open</button>
            </div>
          </div>
        </section>
      )}
    </Door>
  );
}

function initials(name) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

export default StaffDesk;