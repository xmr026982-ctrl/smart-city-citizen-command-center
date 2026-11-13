import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useMinute } from "../../hooks/useMinute";
import {
  Send, Inbox, Users, Gauge, Radar, RefreshCw, UserMinus, Zap, MapPin, Sparkles, RotateCcw, FileSearch, X, Check,
  AlertTriangle, Wrench, Filter, Crosshair, CornerUpLeft, LocateFixed,
} from "lucide-react";
import StaffAssignModal from "../../components/issues/admin/StaffAssignModal";
import IssueDetailsDrawer from "../../components/issues/shared/IssueDetailsDrawer";
import {
  Command, CommandHead, LensDeck, SearchBox, Select, Seg, Chips, ResultLine, Pager, CatGlyph,
  StatusPill, PriorityPill, SlaMeter, Avatar, Empty, SortBar, SortChip, RankBadge, useGlide, useHoverFx, FxLayer, ago,
} from "../../components/issues/admin/CommandKit";
import { CATEGORY_LABEL } from "../../constants/issueCategories";
import { STATUS_LABEL } from "../../constants/issueStatuses";
import { PRIORITY_LABEL } from "../../constants/issuePriorities";
import { expertiseLabel, expertiseForCategory } from "../../config/expertise";
import { useAuth } from "../../store/authStore";
import { assignIssue, setPriority, useIssues } from "../../store/issueStore";
import { useReceipts, dispatchWithReceipt, DispatchReceipt } from "../../components/issues/shared/DispatchKit";
import { showUndo } from "../../components/issues/shared/RemovalKit";
import { useFieldRoster, bestFor, availability, mismatchOf, CAPACITY } from "../../store/fieldRoster";
import { PRIORITY_RANK, urgencyCompare, slaOf } from "../../utils/sla";
import { formatDateTime } from "../../utils/formatDate";
import { nameFor, useNames } from "../../store/profileStore";

/* ------------------------------------------------------------------
   Assign Issues (dispatch board). Every open issue with its best
   available match from the live Staff Desk roster. The tile deck
   locks one lens at a time: no owner (home), owned, ready to
   dispatch (a free match exists), expertise gaps. A gap is either
   unstaffed (no owner and no free crew with the right expertise) or
   mismatched (owned by someone with the wrong expertise; Fix opens
   the console with the best right-skill match selected).
   One-click dispatch, the full dispatch console, reassign, unassign.

   Target lock: Reassign / Open dispatch from any issue file lands here
   with { target, from } in the route state. The page picks the lens and
   page that hold the issue, scrolls to it and locks on (brackets, scan,
   pulse, the rest dims). Enter opens the console, Esc releases, and the
   bar offers a way back to where the admin came from.
------------------------------------------------------------------- */

const FROM_LABEL = {
  "/admin/staff": "Staff Management",
  "/admin/queue": "All Issues",
  "/admin/command": "Issue Command",
  "/admin/audit": "Audit Log",
  "/admin/analytics": "Analytics",
  "/admin/staff-desk": "Staff Desk",
};

const OPEN_STATUSES = ["submitted", "acknowledged", "in_progress", "pending_review"];
// dir = default direction; click the active sort again to flip it
const SORTS = [
  { id: "urgency", label: "Urgency", dir: "desc", desc: "Most urgent first", asc: "Least urgent first" },
  { id: "createdAt", label: "Reported", dir: "desc", desc: "Newest reports first", asc: "Oldest reports first" },
  { id: "priority", label: "Priority", dir: "desc", desc: "Critical first", asc: "Low first" },
  { id: "category", label: "Category", dir: "asc", desc: "Category Z–A", asc: "Category A–Z" },
  { id: "title", label: "Title", dir: "asc", desc: "Title Z–A", asc: "Title A–Z" },
];
const SORT_DIR = Object.fromEntries(SORTS.map((o) => [o.id, o.dir]));

// the value each row is ranked by, shown on the row
function readout(key, issue) {
  if (key === "urgency") return ["Window", slaOf(issue).label];
  if (key === "createdAt") return ["Filed", ago(issue.createdAt)];
  if (key === "priority") return ["Priority", PRIORITY_LABEL[issue.priority] || issue.priority];
  if (key === "category") return ["Category", CATEGORY_LABEL[issue.category] || issue.category];
  return ["Title", (issue.title || "?").charAt(0).toUpperCase()];
}

// list rows with each fresh receipt back where its issue stood
function withReceipts(rows, receipts, places) {
  const out = [...rows];
  receipts.forEach((r) => {
    const at = places.find((x) => x.id === r.id)?.idx ?? 0;
    out.splice(Math.min(at, out.length), 0, { receipt: r });
  });
  return out;
}

function ManageAssignments() {
  useNames(); // names follow each person's current display name
  const user = useAuth();
  const issues = useIssues();
  const { roster } = useFieldRoster();
  const location = useLocation();
  const navigate = useNavigate();
  const tick = useMinute();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [lens, setLens] = useState("unowned"); // unowned | owned | ready | gaps | all
  const [sortKey, setSortKey] = useState("urgency");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(6);
  const [modalId, setModalId] = useState(null);
  const [fileId, setFileId] = useState(null);
  const [confirmOff, setConfirmOff] = useState(null);
  const [flash, setFlash] = useState(null);
  const [target, setTarget] = useState(null); // { id, from, at, done? }
  const scrolledRef = useRef(0);
  const originRef = useRef(null); // the page the admin came from, kept for this visit

  const open = useMemo(() => issues.filter((i) => i.status !== "resolved"), [issues]);

  const stats = useMemo(() => {
    const live = roster.filter((p) => availability(p).ok);
    const free = live.reduce((s, p) => s + Math.max(0, CAPACITY - p.load), 0);
    const unowned = open.filter((i) => !i.assignedTo);
    const unstaffed = unowned.filter((i) => !bestFor(roster, i));
    const gapLines = [...new Set(unstaffed.map((i) => expertiseLabel(expertiseForCategory(i.category))))];
    const mismatched = open.filter((i) => mismatchOf(i, roster)).length;
    return {
      unowned: unowned.length, owned: open.length - unowned.length, free, cap: live.length * CAPACITY,
      people: live.length, ready: unowned.length - unstaffed.length,
      unstaffed: unstaffed.length, mismatched, gaps: unstaffed.length + mismatched, gapLines,
    };
  }, [open, roster]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const list = open.filter((issue) => {
      if (lens === "owned" && !issue.assignedTo) return false;
      if (["unowned", "ready"].includes(lens) && issue.assignedTo) return false;
      if (lens === "ready" && !bestFor(roster, issue)) return false;
      if (lens === "gaps") {
        const unstaffed = !issue.assignedTo && !bestFor(roster, issue);
        if (!unstaffed && !mismatchOf(issue, roster)) return false;
      }
      if (status !== "all" && issue.status !== status) return false;
      if (category !== "all" && issue.category !== category) return false;
      if (!needle) return true;
      return `${issue.id} ${issue.title} ${issue.ward} ${issue.assignedTo || ""} ${CATEGORY_LABEL[issue.category] || ""}`.toLowerCase().includes(needle);
    });
    // each comparator is written for its default direction; the other direction flips it
    const flip = sortDir === SORT_DIR[sortKey] ? 1 : -1;
    list.sort((a, b) => {
      let d;
      if (sortKey === "urgency") d = urgencyCompare(a, b);
      else if (sortKey === "createdAt") d = new Date(b.createdAt) - new Date(a.createdAt);
      else if (sortKey === "priority") d = (PRIORITY_RANK[b.priority] || 0) - (PRIORITY_RANK[a.priority] || 0);
      else if (sortKey === "category") d = (CATEGORY_LABEL[a.category] || "").localeCompare(CATEGORY_LABEL[b.category] || "");
      else d = a.title.localeCompare(b.title);
      return d * flip || a.id.localeCompare(b.id);
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, roster, lens, status, category, search, sortKey, sortDir, tick]);

  useEffect(() => { setPage(1); }, [search, status, category, lens, sortKey, sortDir, size]);
  const listRef = useRef(null);
  useGlide(listRef, `${sortKey}-${sortDir}`);
  useHoverFx(listRef); // light + rail only: these rows aren't one big button
  useEffect(() => {
    if (!flash) return undefined;
    const t = setTimeout(() => setFlash(null), 2600);
    return () => clearTimeout(t);
  }, [flash]);

  /* ---------- target lock ---------- */
  // put the lens and filters where the issue lives
  const focusOn = (id, from = null, open = false) => {
    const issue = issues.find((i) => i.id === id);
    if (!issue) return;
    if (issue.status === "resolved") {
      setFlash({ id, text: `${id} is already closed` });
      return;
    }
    setSearch("");
    setStatus("all");
    setCategory("all");
    setSortKey("urgency");
    setSortDir("desc");
    setLens(mismatchOf(issue, roster) ? "gaps" : issue.assignedTo ? "owned" : "unowned");
    setFileId(null);
    setConfirmOff(null);
    setTarget({ id, from, at: Date.now() });
    if (open) setModalId(id);
  };

  // arrival from an issue file (route state), then wipe the state so Back/reload doesn't re-lock
  useEffect(() => {
    const st = location.state;
    if (!st?.target) return;
    navigate(location.pathname, { replace: true, state: null });
    if (st.from && st.from !== location.pathname) originRef.current = st.from;
    focusOn(st.target, originRef.current, Boolean(st.open));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  // jump to the page that holds the target (runs after the filter reset above)
  const targetIndex = target ? filtered.findIndex((i) => i.id === target.id) : -1;
  useEffect(() => {
    if (!target || targetIndex < 0) return;
    setPage(Math.floor(targetIndex / size) + 1);
  }, [target, targetIndex, size]);

  // glide to the row once per lock
  useEffect(() => {
    if (!target || targetIndex < 0 || scrolledRef.current === target.at) return;
    const t = setTimeout(() => {
      const row = document.querySelector(`[data-issue="${target.id}"]`);
      if (!row) return;
      scrolledRef.current = target.at;
      row.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 120);
    return () => clearTimeout(t);
  });

  // a finished target lets go on its own
  useEffect(() => {
    if (!target?.done) return undefined;
    const t = setTimeout(() => setTarget(null), 6000);
    return () => clearTimeout(t);
  }, [target]);

  // Enter = open the console for the target, Esc = release (before the lens deck sees Esc)
  useEffect(() => {
    if (!target) return undefined;
    const onKey = (e) => {
      const tag = (e.target.tagName || "").toLowerCase();
      if (["input", "select", "textarea", "button"].includes(tag) || document.querySelector("[aria-modal='true']")) return;
      if (e.key === "Escape") { e.stopImmediatePropagation(); setTarget(null); }
      if (e.key === "Enter" && !target.done) { e.preventDefault(); setModalId(target.id); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [target]);

  const targetIssue = target ? issues.find((i) => i.id === target.id) || null : null;

  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const safePage = Math.min(page, pages);
  const slice = filtered.slice((safePage - 1) * size, safePage * size);
  const modalIssue = issues.find((i) => i.id === modalId) || null;
  const fileIssue = issues.find((i) => i.id === fileId) || null;

  const [receipts, addReceipt] = useReceipts();
  const placeRef = useRef([]); // where each dispatched row stood, so its receipt appears in place
  const dispatch = (issue, name, offExpertise = false) => {
    placeRef.current = [...placeRef.current.filter((x) => x.id !== issue.id), { id: issue.id, idx: Math.max(0, slice.findIndex((x) => x.id === issue.id)) }];
    dispatchWithReceipt({ issue, to: name, user, note: offExpertise ? "off-expertise" : "", roster, cap: CAPACITY, onReceipt: addReceipt });
  };

  const handleAssign = ({ staffName, priority, offExpertise }) => {
    if (!modalIssue) return;
    const moved = staffName !== modalIssue.assignedTo;
    if (moved) dispatch(modalIssue, staffName, offExpertise);
    if (moved && target && target.id === modalIssue.id) setTarget((t) => (t ? { ...t, done: staffName } : t));
    if (priority && priority !== modalIssue.priority) {
      setPriority(modalIssue.id, priority, user.name, user.role);
      if (!moved) setFlash({ id: modalIssue.id, text: `${modalIssue.id} priority set to ${PRIORITY_LABEL[priority] || priority}` });
    }
  };

  const unassign = (issue) => {
    const undo = assignIssue(issue.id, null, user.name, user.role);
    setConfirmOff(null);
    if (undo) showUndo(`${issue.id} back in the dispatch queue`, undo, "send");
  };

  const filters = search || status !== "all" || category !== "all" || lens !== "unowned" || sortKey !== "urgency" || sortDir !== "desc";
  const reset = () => { setSearch(""); setStatus("all"); setCategory("all"); setLens("unowned"); setSortKey("urgency"); setSortDir("desc"); };
  const EMPTY = {
    unowned: [Sparkles, "Dispatch queue is clear", "Every open issue has an owner. Lock On the field to reassign."],
    ready: [Sparkles, "Nothing ready to dispatch", "No unowned issue has a free match right now. Check Expertise gaps."],
    gaps: [Sparkles, "No expertise gaps", "Every unowned issue has a free right-skill crew, and every owner has the right expertise."],
    owned: [Sparkles, "Nothing on the field", "No open issue has an owner yet."],
    all: [Sparkles, "No open issues", "The board is clear."],
  };
  // filters that can never match together get an explanation instead of "no match"
  const STATUS_NAME = (STATUS_LABEL[status] || status).toLowerCase();
  const empty = (() => {
    if (search || category !== "all") return [FileSearch, "No issue matches", "Change the search or category, or release the lens."];
    if (["unowned", "ready"].includes(lens) && ["in_progress", "pending_review"].includes(status)) {
      return [Filter, `No unowned issue is ${STATUS_NAME}`, "An issue without an owner sits at Submitted or Acknowledged. Set status to All, Submitted or Acknowledged."];
    }
    if (lens === "owned" && status === "submitted") {
      return [Filter, "No owned issue is submitted", "Dispatch moves an issue to Acknowledged. Set status to All, or pick a later stage."];
    }
    if (status !== "all") return [FileSearch, `No ${STATUS_NAME} issue in this lens`, "Set status to All to see the whole lens."];
    return EMPTY[lens] || EMPTY.all;
  })();
  const EmptyIcon = empty[0];

  return (
    <Command>
      <CommandHead crumb="ASSIGN ISSUES" title="Assign Issues" sub="Dispatch acknowledges an issue. The field moves it to In Progress. You confirm the close from the issue file.">
        {flash ? <span className="ac-live" style={{ color: "#047857" }}><Check size={12} /> {flash.text}</span> : null}
      </CommandHead>

      <LensDeck
        value={lens}
        onChange={setLens}
        base="unowned"
        readout={`${filtered.length} of ${open.length} open issues`}
        tiles={[
          { id: "unowned", icon: Inbox, label: "Awaiting dispatch", value: stats.unowned, sub: "Open issues with no owner", meter: open.length ? (stats.unowned / open.length) * 100 : 0, tone: stats.unowned ? "amber" : "green" },
          { id: "owned", icon: Send, label: "On the field", value: stats.owned, sub: "Owned and in motion", meter: open.length ? (stats.owned / open.length) * 100 : 0 },
          { id: "ready", icon: Gauge, label: "Free capacity", lens: "Ready to dispatch", value: stats.free, sub: `${stats.people} people · ${stats.ready} issue${stats.ready === 1 ? "" : "s"} ready`, meter: stats.cap ? (stats.free / stats.cap) * 100 : 0, tone: "green" },
          { id: "gaps", icon: Radar, label: "Expertise gaps", value: stats.gaps, sub: stats.gaps ? `${stats.mismatched} mismatched · ${stats.unstaffed} unstaffed` : "Right skill on every issue", meter: open.length ? (stats.gaps / open.length) * 100 : 0, tone: stats.gaps ? "red" : "green" },
        ]}
      />

      {target && targetIssue ? (
        <div className={`ac-targetbar${target.done ? " done" : ""}`} role="status">
          <span className="ac-targetbar-ic"><Crosshair size={15} /></span>
          <span className="ac-targetbar-copy">
            <em>{target.done ? "Dispatched" : "Target locked"}</em>
            <b>{targetIssue.id}</b>
            <span>
              {targetIssue.title}
              {target.done ? ` · now with ${target.done}` : targetIssue.assignedTo ? ` · with ${nameFor(targetIssue.assignedTo)}` : " · no owner yet"}
            </span>
          </span>
          <span className="ac-targetbar-acts">
            {!target.done && targetIndex < 0 ? (
              <button type="button" className="ac-btn sm" onClick={() => focusOn(target.id, target.from)}><LocateFixed size={12} /> Relocate</button>
            ) : null}
            {!target.done ? (
              <button type="button" className="ac-btn sm primary" onClick={() => setModalId(target.id)}>
                <Send size={12} /> {targetIssue.assignedTo ? "Reassign now" : "Dispatch now"} <kbd>↵</kbd>
              </button>
            ) : null}
            {target.from ? (
              <button type="button" className="ac-btn sm" onClick={() => navigate(target.from)}>
                <CornerUpLeft size={12} /> Back to {FROM_LABEL[target.from] || "previous page"}
              </button>
            ) : null}
            <button type="button" className="ac-btn sm ghost" onClick={() => setTarget(null)}>Release <kbd>Esc</kbd></button>
          </span>
        </div>
      ) : null}

      <div className="ac-toolbar">
        <div className="grow"><SearchBox value={search} onChange={setSearch} placeholder="Search ID, title, zone, category or owner" /></div>
        <Select label="Category" value={category} onChange={setCategory} options={[{ id: "all", label: "All" }, ...Object.entries(CATEGORY_LABEL).map(([id, label]) => ({ id, label }))]} />
        <Seg value={lens} onChange={setLens} label="Owner" options={[{ id: "unowned", label: "No owner", count: stats.unowned }, { id: "owned", label: "Owned", count: stats.owned }, { id: "all", label: "All open", count: open.length }]} />
      </div>

      <div className="ac-filterline">
        <Chips value={status} onChange={setStatus} items={[{ id: "all", label: "All status" }, ...OPEN_STATUSES.map((s) => ({ id: s, label: STATUS_LABEL[s], count: open.filter((i) => i.status === s).length }))]} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <SortBar options={SORTS} value={sortKey} dir={sortDir} onChange={(id, dir) => { setSortKey(id); setSortDir(dir); }} />
          {filters ? <button type="button" className="ac-btn sm" onClick={reset}><RotateCcw size={12} /> Reset</button> : null}
        </div>
      </div>

      <ResultLine total={filtered.length} of={open.length} page={safePage} size={size} noun="open issues" />

      {!slice.length && !receipts.length ? (
        <Empty icon={EmptyIcon} title={empty[1]} sub={empty[2]} />
      ) : (
        <div className={`ac-list${target && !target.done && targetIndex >= 0 ? " targeting" : ""}`} ref={listRef} key={`${safePage}-${size}-${lens}`}>
          {withReceipts(slice, receipts, placeRef.current).map((issue, i) => {
            if (issue.receipt) return <DispatchReceipt key={issue.receipt.key} receipt={issue.receipt} variant="row" />;
            const pick = bestFor(roster, issue);
            const ownerRow = roster.find((p) => p.name === issue.assignedTo);
            const need = expertiseLabel(expertiseForCategory(issue.category));
            const off = mismatchOf(issue, roster);
            const locked = target && !target.done && target.id === issue.id;
            const [rl, rv] = readout(sortKey, issue);
            return (
              <article
                key={issue.id}
                data-issue={issue.id}
                data-glide={issue.id}
                data-fx
                className={`ac-row r-${issue.status}${off ? " offx" : ""}${locked ? " target" : ""}${flash?.id === issue.id ? " flash" : ""}`}
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
                    <button type="button" className="ac-link ac-id" onClick={() => setFileId(issue.id)}>{issue.id}</button>
                    <span className="ac-dot">·</span>
                    <span><MapPin size={11} style={{ verticalAlign: -1 }} /> {issue.ward}</span>
                    <span className="ac-dot">·</span>
                    <span>{formatDateTime(issue.createdAt)}</span>
                  </div>
                  <h4>{issue.title}</h4>
                  <div className="ac-row-meta">
                    <StatusPill status={issue.status} />
                    <PriorityPill priority={issue.priority} />
                    <SlaMeter issue={issue} />
                    {off ? (
                      <span className="ac-tag red" title={`${issue.assignedTo} is ${off.hasLabel}; this issue needs ${off.needLabel}`}><AlertTriangle size={9} /> Off-expertise · {off.hasLabel} on {off.needLabel} work</span>
                    ) : (
                      <span className="ac-tag violet"><Zap size={9} /> Needs {need}</span>
                    )}
                  </div>
                </div>
                <div className="ac-row-side">
                  <SortChip key={sortKey} label={rl} value={rv} tone={sortKey === "urgency" ? slaOf(issue).state : ""} />
                  {issue.assignedTo ? (
                    <span className="ac-owner">
                      <Avatar name={nameFor(issue.assignedTo)} size={28} dot={ownerRow ? ownerRow.onDuty : undefined} />
                      {nameFor(issue.assignedTo)}
                      {ownerRow ? <small style={{ font: "600 11px var(--ac-mono)", color: "#94a3b8" }}>{ownerRow.load}/{CAPACITY}</small> : <span className="ac-tag red">Not on roster</span>}
                    </span>
                  ) : pick ? (
                    <span className="ac-suggest"><Sparkles size={11} /> {nameFor(pick.person.name)} · {expertiseLabel(pick.person.expertise)} · {pick.person.load}/{CAPACITY}</span>
                  ) : (
                    <span className="ac-suggest none">No free {need} · use Whole field</span>
                  )}

                  {confirmOff === issue.id ? (
                    <div className="ac-row-actions">
                      <span style={{ fontSize: 12, color: "#b91c1c", fontWeight: 600 }}>Take {issue.assignedTo.split(" ")[0]} off this?</span>
                      <button type="button" className="ac-btn sm ghost-red" onClick={() => unassign(issue)}><UserMinus size={12} /> Unassign</button>
                      <button type="button" className="ac-btn sm" onClick={() => setConfirmOff(null)}><X size={12} /> Keep</button>
                    </div>
                  ) : (
                    <div className="ac-row-actions">
                      {!issue.assignedTo && pick ? (
                        <button type="button" className="ac-btn sm primary" onClick={() => dispatch(issue, pick.person.name)}>
                          <Send size={12} /> Dispatch to {pick.person.name.split(" ")[0]}
                        </button>
                      ) : null}
                      {off ? (
                        <button type="button" className={`ac-btn sm fix${locked ? " glow" : ""}`} onClick={() => setModalId(issue.id)} title={pick ? `Best right-skill match: ${pick.person.name}` : `No free ${off.needLabel} right now`}>
                          <Wrench size={12} /> Fix · {pick ? pick.person.name.split(" ")[0] : `find ${off.needLabel}`}
                        </button>
                      ) : (
                        <button type="button" className={`ac-btn sm${!issue.assignedTo && !pick ? " primary" : ""}${locked ? " glow" : ""}`} onClick={() => setModalId(issue.id)}>
                          {issue.assignedTo ? <><RefreshCw size={12} /> Reassign</> : <><Users size={12} /> {pick ? "Choose" : "Pick someone"}</>}
                        </button>
                      )}
                      {issue.assignedTo ? (
                        <button type="button" className="ac-btn sm ghost-red" onClick={() => setConfirmOff(issue.id)} title="Unassign">
                          <UserMinus size={12} />
                        </button>
                      ) : null}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Pager page={safePage} pages={pages} total={filtered.length} size={size} onPage={setPage} onSize={setSize} sizes={[6, 9, 12]} />

      {stats.mismatched && lens !== "gaps" ? (
        <div className="ac-banner">
          <span><AlertTriangle size={15} /> {stats.mismatched} open issue{stats.mismatched === 1 ? " is" : "s are"} with someone of the wrong expertise.</span>
          <button type="button" className="ac-btn sm" onClick={() => setLens("gaps")}>Show gaps</button>
        </div>
      ) : null}
      {stats.unstaffed ? (
        <div className="ac-banner">
          <span><Radar size={15} /> {stats.unstaffed} unowned issue{stats.unstaffed === 1 ? " has" : "s have"} no free {stats.gapLines.join(" / ")} on the field.</span>
          <Link to="/admin/staff-desk" className="ac-btn sm">Open Staff Desk</Link>
        </div>
      ) : null}

      <StaffAssignModal isOpen={Boolean(modalIssue)} onClose={() => setModalId(null)} issue={modalIssue} onAssign={handleAssign} />
      <IssueDetailsDrawer issue={fileIssue} onClose={() => setFileId(null)} />
    </Command>
  );
}

export default ManageAssignments;