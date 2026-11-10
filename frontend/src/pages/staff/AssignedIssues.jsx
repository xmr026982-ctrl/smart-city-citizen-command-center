import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ClipboardCheck, Clock, HardHat, ShieldCheck, Siren, CheckCircle2, MapPin, RotateCcw, FileSearch, ArrowUpRight, Sparkles, CornerUpLeft,
} from "lucide-react";
import IssueDetailsDrawer from "../../components/issues/shared/IssueDetailsDrawer";
import { RemovedNotices } from "../../components/issues/shared/RemovalKit";
import { useNewAssignments, NewWorkNotices } from "../../components/issues/shared/DispatchKit";
import { useAllIssues } from "../../store/issueStore";
import { setTopTag } from "../../store/topbarContext";
import GateDoor from "../../components/issues/shared/GateDoor";
import {
  LensDeck, SearchBox, Select, ResultLine, Pager, CatGlyph, StatusPill, PriorityPill, SlaMeter, Empty,
  SortBar, SortChip, RankBadge, useGlide, useHoverFx, FxLayer, ago,
} from "../../components/issues/admin/CommandKit";
import { Field, FieldHead, FlashChip, FieldMoves, TargetBar, useFieldDesk, useFlash, useTargetLock } from "../../components/issues/staff/FieldKit";
import { CATEGORY_LABEL } from "../../constants/issueCategories";
import { PRIORITY_LABEL } from "../../constants/issuePriorities";
import { CAPACITY } from "../../store/fieldRoster";
import { slaOf, PRIORITY_RANK, urgencyCompare } from "../../utils/sla";

/* ------------------------------------------------------------------
   Assigned Work: every issue on you, and the only place (with the issue
   file) where the field moves them. The tile deck locks one lens at a
   time: open on you (home), not started, on site, with command, breached.
   Closed work lives on Field Load. Each row carries its one next move:
     Acknowledged -> Start work
     In Progress  -> Request close (opens the close console, note required)
     Pending      -> Waiting on command · Withdraw
   Sorts flip on a second click, rows show their rank and the value they
   are sorted by, and glide into place.

   Target lock: "Assigned Work" in an issue file (or a link from
   Operations / Field Load) lands here with { target, from }. The page
   picks the lens and page that hold it, glides to the row and locks on.
   Enter runs its next move, Esc releases, and the bar offers a way back.
   Once the issue moves, the lock turns green and lets go.
------------------------------------------------------------------- */

const SORTS = [
  { id: "urgency", label: "Urgency", dir: "desc", desc: "Most urgent first", asc: "Least urgent first" },
  { id: "assignedAt", label: "Assigned", dir: "desc", desc: "Newest on you first", asc: "Longest on you first" },
  { id: "updatedAt", label: "Updated", dir: "desc", desc: "Recently moved first", asc: "Longest untouched first" },
  { id: "priority", label: "Priority", dir: "desc", desc: "Critical first", asc: "Low first" },
  { id: "title", label: "Title", dir: "asc", desc: "Title Z–A", asc: "Title A–Z" },
];
const SORT_DIR = Object.fromEntries(SORTS.map((o) => [o.id, o.dir]));

function readout(key, issue) {
  if (key === "urgency") return ["Window", slaOf(issue).label];
  if (key === "assignedAt") return ["On you", ago(issue.assignedAt)];
  if (key === "updatedAt") return ["Moved", ago(issue.updatedAt)];
  if (key === "priority") return ["Priority", PRIORITY_LABEL[issue.priority] || issue.priority];
  return ["Title", (issue.title || "?").charAt(0).toUpperCase()];
}

function AssignedIssues() {
  const { user, issues, me, mine, tick, audit } = useFieldDesk();
  const everything = useAllIssues();
  const fresh = useNewAssignments(audit, everything, user?.name);
  const location = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [lens, setLens] = useState("open"); // open | queued | site | gate | breached (closed work lives on Field Load)
  const [sortKey, setSortKey] = useState("urgency");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(6);
  const [fileId, setFileId] = useState(null);
  const [gate, setGate] = useState(null); // { mode: "close" | "recall", id }
  const askClose = (id) => setGate({ mode: "close", id });
  const askRecall = (id) => setGate({ mode: "recall", id });
  const [flash, setFlash] = useFlash();
  const scrolledRef = useRef(0);

  const stats = useMemo(() => {
    const open = mine.filter((i) => i.status !== "resolved");
    return {
      open: open.length,
      queued: open.filter((i) => i.status === "acknowledged").length,
      site: open.filter((i) => i.status === "in_progress").length,
      gate: open.filter((i) => i.status === "pending_review").length,
      breached: open.filter((i) => slaOf(i).state === "over").length,
      closed: mine.length - open.length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mine, tick]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = mine.filter((issue) => {
      const open = issue.status !== "resolved";
      if (!open) return false; // closed work lives on Field Load
      if (lens === "queued" && issue.status !== "acknowledged") return false;
      if (lens === "site" && issue.status !== "in_progress") return false;
      if (lens === "gate" && issue.status !== "pending_review") return false;
      if (lens === "breached" && (!open || slaOf(issue).state !== "over")) return false;
      if (category !== "all" && issue.category !== category) return false;
      if (!needle) return true;
      return `${issue.id} ${issue.title} ${issue.location} ${issue.ward} ${CATEGORY_LABEL[issue.category] || ""}`.toLowerCase().includes(needle);
    });
    // each comparator is written for its default direction; the other direction flips it
    const flip = sortDir === SORT_DIR[sortKey] ? 1 : -1;
    list.sort((a, b) => {
      let d;
      if (sortKey === "urgency") d = urgencyCompare(a, b);
      else if (sortKey === "assignedAt" || sortKey === "updatedAt") d = new Date(b[sortKey] || 0) - new Date(a[sortKey] || 0);
      else if (sortKey === "priority") d = (PRIORITY_RANK[b.priority] || 0) - (PRIORITY_RANK[a.priority] || 0);
      else d = a.title.localeCompare(b.title);
      return d * flip || a.id.localeCompare(b.id);
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mine, lens, category, query, sortKey, sortDir, tick]);

  useEffect(() => { setPage(1); }, [query, category, lens, sortKey, sortDir, size]);

  /* ---------- target lock ---------- */
  const focus = (issue) => {
    setQuery("");
    setCategory("all");
    setSortKey("urgency");
    setSortDir("desc");
    setFileId(null);
    setGate(null);
    setLens("open"); // the home lens holds every open issue
  };
  const openMine = useMemo(() => mine.filter((i) => i.status !== "resolved"), [mine]);
  const [target, setTarget, targetIssue] = useTargetLock({ location, navigate, issues: openMine, focus, onMiss: (id) => { if (issues.some((i) => i.id === id)) setFileId(id); } });
  // the locked file rides in the top bar: "Assigned Work · ISS-2411"
  useEffect(() => { setTopTag(target && targetIssue && !target.done ? targetIssue.id : null); }, [target, targetIssue]);
  useEffect(() => () => setTopTag(null), []);

  const targetIndex = target ? filtered.findIndex((i) => i.id === target.id) : -1;
  useEffect(() => {
    if (!target || targetIndex < 0) return;
    setPage(Math.floor(targetIndex / size) + 1);
  }, [target?.at, targetIndex, size]); // eslint-disable-line react-hooks/exhaustive-deps

  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const safePage = Math.min(page, pages);
  const slice = filtered.slice((safePage - 1) * size, safePage * size);
  const onPage = targetIndex >= 0 && Math.floor(targetIndex / size) + 1 === safePage;

  // glide to the row once per lock
  useEffect(() => {
    if (!target || !onPage || scrolledRef.current === target.at) return undefined;
    const t = setTimeout(() => {
      const row = document.querySelector(`[data-issue="${target.id}"]`);
      if (!row) return;
      scrolledRef.current = target.at;
      row.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 120);
    return () => clearTimeout(t);
  });

  // lock, then open: a beat after the glide the file opens on the locked row (same rule as every desk)
  const autoOpenRef = useRef(0);
  useEffect(() => {
    if (!target || target.done || target.quiet || !onPage || autoOpenRef.current === target.at) return undefined;
    const at = target.at;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(() => { autoOpenRef.current = at; setFileId(target.id); }, reduce ? 160 : 650);
    return () => clearTimeout(t);
  }, [target, onPage]);

  // Enter = the locked issue's next move, Esc = release (before the lens deck sees Esc)
  useEffect(() => {
    if (!target || !targetIssue) return undefined;
    const onKey = (e) => {
      const tag = (e.target.tagName || "").toLowerCase();
      if (["input", "select", "textarea", "button", "a"].includes(tag) || document.querySelector("[aria-modal='true']")) return;
      if (e.key === "Escape") { e.stopImmediatePropagation(); setTarget(null); }
      if (e.key === "Enter" && !target.done) {
        e.preventDefault();
        if (targetIssue.status === "in_progress") askClose(targetIssue.id);
        else if (targetIssue.status === "pending_review") askRecall(targetIssue.id);
        else setFileId(targetIssue.id);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [target, targetIssue, setTarget]);

  const listRef = useRef(null);
  useGlide(listRef, `${sortKey}-${sortDir}`);
  useHoverFx(listRef);

  const fileIssue = issues.find((i) => i.id === fileId) || null;
  const gateIssue = gate ? issues.find((i) => i.id === gate.id) || null : null;
  const gateSent = (id, mode) => setFlash({ id, text: mode === "recall" ? `${id} recalled · back in progress` : `${id} close requested · with command` });

  const filters = query || category !== "all" || lens !== "open" || sortKey !== "urgency" || sortDir !== "desc";
  const reset = () => { setQuery(""); setCategory("all"); setLens("open"); setSortKey("urgency"); setSortDir("desc"); };

  const EMPTY = {
    open: [Sparkles, "Nothing open on you", "Command dispatches new work here. City Intake shows what's on the board."],
    queued: [CheckCircle2, "Everything on you is started", "No acknowledged issue is waiting for you to begin."],
    site: [HardHat, "No crew on site", "Start work on an acknowledged issue to see it here."],
    gate: [ShieldCheck, "No close request with command", "Request close on finished work to send it to the gate."],
    breached: [CheckCircle2, "No breached work", "Every open issue on you is inside its service window."],
  };
  const empty = query || category !== "all"
    ? [FileSearch, "No issue matches", "Change the search or category, or release the lens."]
    : EMPTY[lens] || EMPTY.open;
  const EmptyIcon = empty[0];
  const onMoved = (f) => setFlash(f);

  return (
    <Field>
      <FieldHead crumb="ASSIGNED WORK" title="Assigned Work" sub="Every issue on you, most urgent first. Start work, then ask command to close. Command confirms the close." me={me} tick={tick}>
        <FlashChip flash={flash} />
      </FieldHead>

      <NewWorkNotices items={fresh.items} />
      <RemovedNotices audit={audit} everything={everything} me={user?.name} />

      <LensDeck
        value={lens}
        onChange={setLens}
        base="open"
        readout={`${filtered.length} of ${stats.open} open on you`}
        tiles={[
          { id: "open", icon: ClipboardCheck, label: "Open on you", lens: "Open on you", value: `${stats.open}/${CAPACITY}`, sub: `${stats.closed} closed · see Field Load`, meter: (stats.open / CAPACITY) * 100 },
          { id: "queued", icon: Clock, label: "Not started", value: stats.queued, sub: "Acknowledged, start when on site", meter: stats.open ? (stats.queued / stats.open) * 100 : 0, tone: "amber" },
          { id: "site", icon: HardHat, label: "On site", value: stats.site, sub: "In progress now", meter: stats.open ? (stats.site / stats.open) * 100 : 0, tone: "green" },
          { id: "gate", icon: ShieldCheck, label: "With command", value: stats.gate, sub: "Close requested", meter: stats.open ? (stats.gate / stats.open) * 100 : 0, tone: "cyan" },
          { id: "breached", icon: Siren, label: "Breached", value: stats.breached, sub: stats.breached ? "Past the service window" : "All inside their window", meter: stats.open ? (stats.breached / stats.open) * 100 : 0, tone: stats.breached ? "red" : "green" },
        ]}
      />

      {target && targetIssue ? (
        <TargetBar
          target={target}
          issue={targetIssue}
          user={user}
          onPage={onPage}
          onRequestClose={askClose} onWithdraw={askRecall}
          onMoved={onMoved}
          onRelocate={() => { focus(targetIssue); setTarget((t) => (t ? { ...t, at: Date.now(), quiet: true } : t)); }}
          onBack={() => navigate(target.from)}
          onRelease={() => setTarget(null)}
        />
      ) : null}

      <div className="ac-toolbar">
        <div className="grow"><SearchBox value={query} onChange={setQuery} placeholder="Search ID, title, place or zone" /></div>
        <Select label="Category" value={category} onChange={setCategory} options={[{ id: "all", label: "All" }, ...Object.entries(CATEGORY_LABEL).map(([id, label]) => ({ id, label }))]} />
      </div>

      <div className="ac-filterline">
        <SortBar options={SORTS} value={sortKey} dir={sortDir} onChange={(id, dir) => { setSortKey(id); setSortDir(dir); }} />
        {filters ? <button type="button" className="ac-btn sm" onClick={reset}><RotateCcw size={12} /> Reset</button> : null}
      </div>

      <ResultLine total={filtered.length} of={stats.open} page={safePage} size={size} noun="open issues on you" />

      {!slice.length ? (
        <Empty icon={EmptyIcon} title={empty[1]} sub={empty[2]} />
      ) : (
        <div className={`ac-list${target && !target.done && onPage ? " targeting" : ""}`} ref={listRef} key={`${safePage}-${size}-${lens}`}>
          {slice.map((issue, i) => {
            const sla = slaOf(issue);
            const locked = target && !target.done && target.id === issue.id;
            const [rl, rv] = readout(sortKey, issue);
            return (
              <article
                key={issue.id}
                data-issue={issue.id}
                data-glide={issue.id}
                data-fx
                className={`ac-row r-${issue.status}${sla.state === "over" ? " breach" : ""}${locked ? " target" : ""}${fresh.ids.has(issue.id) ? " fresh-work" : ""}${flash?.id === issue.id && flash.tone !== "warn" ? " flash" : ""}`}
                style={{ animationDelay: `${i * 35}ms` }}
              >
                {locked ? (
                  <>
                    <i className="ac-lock tl" aria-hidden /><i className="ac-lock tr" aria-hidden />
                    <i className="ac-lock bl" aria-hidden /><i className="ac-lock br" aria-hidden />
                    <span className="ac-lock-sweep" aria-hidden />
                  </>
                ) : null}
                <FxLayer />
                <CatGlyph category={issue.category} size={40} />
                <div className="ac-row-main">
                  <div className="ac-row-top">
                    <RankBadge n={(safePage - 1) * size + i + 1} />
                    {fresh.ids.has(issue.id) ? <span className="dx-newtag">New</span> : null}
                    <button type="button" className="ac-link ac-id" onClick={() => setFileId(issue.id)}>{issue.id}</button>
                    <span className="ac-dot">·</span>
                    <span><MapPin size={11} style={{ verticalAlign: -1 }} /> {issue.ward}</span>
                    <span className="ac-dot">·</span>
                    <span>{CATEGORY_LABEL[issue.category] || issue.category}</span>
                  </div>
                  <h4>{issue.title}</h4>
                  <div className="ac-row-meta">
                    <StatusPill status={issue.status} />
                    <PriorityPill priority={issue.priority} />
                    <SlaMeter issue={issue} />
                    {issue.lastReturn && issue.status === "in_progress" ? (
                      <span className="ac-tag fc-returned" title={issue.lastReturn.reason}><CornerUpLeft size={9} /> Returned by command{issue.returned > 1 ? ` · ${issue.returned}×` : ""}</span>
                    ) : null}
                  </div>
                </div>
                <div className="ac-row-side">
                  <SortChip key={sortKey} label={rl} value={rv} tone={sortKey === "urgency" ? sla.state : ""} />
                  <span className="ac-when">{issue.location}</span>
                  <div className="ac-row-actions">
                    <FieldMoves issue={issue} user={user} glow={locked} onRequestClose={askClose} onWithdraw={askRecall} onMoved={onMoved} />
                    <button type="button" className="ac-btn sm" onClick={() => setFileId(issue.id)}>File <ArrowUpRight size={12} /></button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Pager page={safePage} pages={pages} total={filtered.length} size={size} onPage={setPage} onSize={setSize} sizes={[6, 9, 12]} />

      <IssueDetailsDrawer issue={fileIssue} onClose={() => setFileId(null)} />
      <GateDoor mode={gate?.mode} issue={gateIssue} onClose={() => setGate(null)} onSent={gateSent} />
    </Field>
  );
}

export default AssignedIssues;
