import { useEffect, useMemo, useRef, useState } from "react";
import {
  FolderOpen, CheckCircle2, Timer, AlertTriangle, ClipboardCheck, BadgeCheck, MapPin, Zap, Gauge, ShieldCheck,
  Activity, RotateCcw, FileSearch, ArrowUpRight, Calendar, Contact,
} from "lucide-react";
import IssueDetailsDrawer from "../../components/issues/shared/IssueDetailsDrawer";
import {
  LensDeck, Panel, ResultLine, Pager, CatGlyph, StatusPill, PriorityPill, SlaMeter, Avatar, Empty, CAT_META,
  SortBar, SortChip, RankBadge, useGlide, useHoverFx, FxLayer, ago,
} from "../../components/issues/admin/CommandKit";
import { Field, FieldHead, LoadReactor, useFieldDesk } from "../../components/issues/staff/FieldKit";
import { CATEGORY_LABEL } from "../../constants/issueCategories";
import { PRIORITY_LABEL } from "../../constants/issuePriorities";
import { expertiseLabel } from "../../config/expertise";
import { RANKS } from "../../store/staffDeskStore";
import { CAPACITY } from "../../store/fieldRoster";
import { slaOf, span, fieldCloseHours, PRIORITY_RANK } from "../../utils/sla";
import { formatDate } from "../../utils/formatDate";
import { nameFor, useNames } from "../../store/profileStore";

/* ------------------------------------------------------------------
   Field Load: your record. Times here run on the field's clock: from the
   report to your last close request, not to command's confirm
   (utils/sla fieldCloseHours), so a slow confirm never makes you late.
   Who you are on the field (rank ladder,
   expertise, zone, badge), how you close (close rate, inside-window
   rate, average time to close), your capacity and category mix, and
   the trace of every issue that was ever on you on this board.
   The tile deck locks one lens on the trace: everything (home), open,
   closed, closed inside the window, closed late.
------------------------------------------------------------------- */

const SORTS = [
  { id: "updatedAt", label: "Updated", dir: "desc", desc: "Recently moved first", asc: "Longest untouched first" },
  { id: "createdAt", label: "Reported", dir: "desc", desc: "Newest reports first", asc: "Oldest reports first" },
  { id: "took", label: "Time to close", dir: "asc", desc: "Slowest close first", asc: "Fastest close first" },
  { id: "priority", label: "Priority", dir: "desc", desc: "Critical first", asc: "Low first" },
];
const SORT_DIR = Object.fromEntries(SORTS.map((o) => [o.id, o.dir]));

// closed inside its service window? null = still open or no window set
function inWindow(issue) {
  const took = fieldCloseHours(issue);
  if (took === null || !Number(issue.slaHours)) return null;
  return took <= Number(issue.slaHours);
}

function readout(key, issue) {
  if (key === "updatedAt") return ["Moved", ago(issue.updatedAt)];
  if (key === "createdAt") return ["Filed", ago(issue.createdAt)];
  if (key === "took") { const t = fieldCloseHours(issue); return ["Closed in", t === null ? "Open" : span(t)]; }
  return ["Priority", PRIORITY_LABEL[issue.priority] || issue.priority];
}

function StaffPerformance() {
  useNames(); // names follow each person's current display name
  const { issues, me, mine, tick } = useFieldDesk();
  const [lens, setLens] = useState("all"); // all | open | closed | inside | late
  const [sortKey, setSortKey] = useState("updatedAt");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(6);
  const [fileId, setFileId] = useState(null);

  const rec = useMemo(() => {
    const open = mine.filter((i) => i.status !== "resolved");
    const closed = mine.filter((i) => i.status === "resolved");
    const timed = closed.filter((i) => inWindow(i) !== null);
    const inside = timed.filter((i) => inWindow(i));
    const took = closed.map(fieldCloseHours).filter((h) => h !== null);
    const closedAt = (i) => [...(i.timeline || [])].reverse().find((t) => t.status === "resolved")?.at;
    return {
      open: open.length,
      closed: closed.length,
      // career total: every confirmed close, including history from before this board's records
      career: me ? Math.max(me.closed, closed.length) : closed.length,
      week: closed.filter((i) => closedAt(i) && Date.now() - new Date(closedAt(i)) <= 7 * 864e5).length,
      inside: inside.length,
      late: timed.length - inside.length,
      timed: timed.length,
      breachedOpen: open.filter((i) => slaOf(i).state === "over").length,
      closeRate: mine.length ? Math.round((closed.length / mine.length) * 100) : 0,
      insideRate: timed.length ? Math.round((inside.length / timed.length) * 100) : 0,
      avg: took.length ? took.reduce((s, h) => s + h, 0) / took.length : null,
      fastest: took.length ? Math.min(...took) : null,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mine, me, tick]);
  const earlier = rec.career - rec.closed; // closes from before this board kept records (no files here)

  const cats = useMemo(() => {
    const rows = Object.keys(CATEGORY_LABEL).map((key) => ({
      key, label: CATEGORY_LABEL[key],
      n: mine.filter((i) => i.category === key).length,
      closed: mine.filter((i) => i.category === key && i.status === "resolved").length,
    })).filter((r) => r.n);
    const max = Math.max(1, ...rows.map((r) => r.n));
    return rows.map((r) => ({ ...r, w: (r.n / max) * 100 })).sort((a, b) => b.n - a.n);
  }, [mine]);

  const list = useMemo(() => {
    const out = mine.filter((i) => {
      if (lens === "open") return i.status !== "resolved";
      if (lens === "closed") return i.status === "resolved";
      if (lens === "inside") return inWindow(i) === true;
      if (lens === "late") return inWindow(i) === false;
      return true;
    });
    const flip = sortDir === SORT_DIR[sortKey] ? 1 : -1;
    out.sort((a, b) => {
      let d;
      if (sortKey === "took") {
        const ta = fieldCloseHours(a); const tb = fieldCloseHours(b);
        d = (ta === null ? Infinity : ta) - (tb === null ? Infinity : tb);
        if (Number.isNaN(d)) d = 0; // both open
      } else if (sortKey === "priority") d = (PRIORITY_RANK[b.priority] || 0) - (PRIORITY_RANK[a.priority] || 0);
      else d = new Date(b[sortKey]) - new Date(a[sortKey]);
      return d * flip || a.id.localeCompare(b.id);
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mine, lens, sortKey, sortDir, tick]);

  useEffect(() => { setPage(1); }, [lens, sortKey, sortDir, size]);
  const pages = Math.max(1, Math.ceil(list.length / size));
  const safePage = Math.min(page, pages);
  const slice = list.slice((safePage - 1) * size, safePage * size);
  const fileIssue = issues.find((i) => i.id === fileId) || null;

  const listRef = useRef(null);
  useGlide(listRef, `${sortKey}-${sortDir}`);
  useHoverFx(listRef);

  // a closed lens brings "time to close" with it
  const pickLens = (id) => {
    setLens(id);
    if (["closed", "inside", "late"].includes(id)) { setSortKey("took"); setSortDir("asc"); }
    else if (sortKey === "took") { setSortKey("updatedAt"); setSortDir("desc"); }
  };
  const filters = lens !== "all" || sortKey !== "updatedAt" || sortDir !== "desc";
  const reset = () => { setLens("all"); setSortKey("updatedAt"); setSortDir("desc"); };
  const rankAt = me ? RANKS.indexOf(me.rank) : -1;

  const EMPTY = {
    all: [ClipboardCheck, "Nothing on your record yet", "Issues show here once command dispatches work to you."],
    open: [CheckCircle2, "Nothing open on you", "Everything on your record is closed."],
    closed: [Timer, "No closed work yet", "Issues show here once command confirms your close."],
    inside: [Timer, "No close inside its window yet", "Closes that beat the service window show here."],
    late: [CheckCircle2, "No late closes", "Every close on your record was inside its window."],
  };
  const empty = EMPTY[lens] || EMPTY.all;
  const EmptyIcon = empty[0];

  return (
    <Field>
      <FieldHead crumb="FIELD LOAD" title="Field Load" sub="Your record on the field: how you close, how fast, and against which windows. Lock a tile to trace it." me={me} tick={tick} />

      <LensDeck
        value={lens}
        onChange={pickLens}
        readout={`${list.length} of ${mine.length} on your record`}
        tiles={[
          { id: "all", icon: FolderOpen, label: "On your record", lens: "Everything", value: mine.length, sub: `${rec.closeRate}% closed`, meter: rec.closeRate },
          { id: "open", icon: ClipboardCheck, label: "Open", value: rec.open, sub: rec.breachedOpen ? `${rec.breachedOpen} breached` : "None breached", meter: mine.length ? (rec.open / mine.length) * 100 : 0, tone: rec.breachedOpen ? "red" : "amber" },
          { id: "closed", icon: CheckCircle2, label: "Closed", lens: "Closed files", value: rec.career, sub: `${rec.week} this week · career total`, meter: rec.closeRate, tone: "green" },
          { id: "inside", icon: Timer, label: "Inside window", value: `${rec.insideRate}%`, lens: "Closed inside window", sub: `${rec.inside} of ${rec.timed} timed closes`, meter: rec.insideRate, tone: "cyan" },
          { id: "late", icon: AlertTriangle, label: "Closed late", value: rec.late, sub: rec.avg === null ? "No closes yet" : `Avg close ${span(rec.avg)}`, meter: rec.timed ? (rec.late / rec.timed) * 100 : 0, tone: rec.late ? "red" : "green" },
        ]}
      />

      <div className="ac-row3">
        <Panel kicker="Field identity" icon={Contact} title={me ? me.rank : "Not on the roster"}>
          {me ? (
            <>
              <div className="fc-id">
                <Avatar name={nameFor(me.name)} size={52} dot={me.onDuty} />
                <div className="fc-id-copy">
                  <strong>{nameFor(me.name)}{me.verified ? <BadgeCheck size={15} color="#14b8a6" /> : null}</strong>
                  <em>{expertiseLabel(me.expertise)}</em>
                  <small><MapPin size={11} /> {me.zone}</small>
                </div>
              </div>
              <div className="fc-ladder" role="img" aria-label={`Rank ${rankAt + 1} of ${RANKS.length}: ${me.rank}`}>
                {RANKS.map((r, i) => (
                  <span key={r} className={`${i < rankAt ? "past" : ""}${i === rankAt ? " on" : ""}`} title={r}>
                    <i style={{ height: 8 + i * 4 }} />
                    <b>{String(i + 1).padStart(2, "0")}</b>
                  </span>
                ))}
              </div>
              <div className="fc-facts">
                <div><em>Badge</em><b>{me.verified ? "Verified" : "Unverified"}</b></div>
                <div><em>Experience</em><b>{me.experience || "—"}</b></div>
                <div><em>Since</em><b>{me.uplinkedAt ? formatDate(me.uplinkedAt) : "—"}</b></div>
              </div>
            </>
          ) : (
            <Empty icon={Contact} title="No roster record" sub="Your rank and zone show once command adds you to the field." />
          )}
        </Panel>

        <Panel kicker="Service record" icon={ShieldCheck} title={rec.timed ? `${rec.insideRate}% closed inside the window` : "No timed closes yet"}>
          <div className="ac-gauge">
            <div className="ac-ring" style={{ width: 128, height: 128 }}>
              <svg viewBox="0 0 120 120" aria-hidden="true">
                <defs>
                  <linearGradient id="fcRingGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#14b8a6" />
                    <stop offset="100%" stopColor="#34d399" />
                  </linearGradient>
                </defs>
                <circle className="bg" cx="60" cy="60" r="50" fill="none" strokeWidth="11" />
                <circle className="fg" cx="60" cy="60" r="50" fill="none" strokeWidth="11" strokeLinecap="round" strokeDasharray={`${(rec.insideRate / 100) * 314} 314`} />
              </svg>
              <div><strong>{rec.insideRate}%</strong><em>in window</em></div>
            </div>
            <div className="ac-gauge-stats">
              <div><div><span>Close rate</span><b>{rec.closeRate}%</b></div><span className="bar green"><i style={{ width: `${rec.closeRate}%` }} /></span></div>
              <div><div><span>Closed late</span><b>{rec.late} of {rec.timed}</b></div><span className="bar amber"><i style={{ width: `${rec.timed ? (rec.late / rec.timed) * 100 : 0}%` }} /></span></div>
              <div><div><span>Fastest close</span><b>{rec.fastest === null ? "—" : span(rec.fastest)}</b></div></div>
            </div>
          </div>
        </Panel>

        <Panel kicker="Capacity" icon={Gauge} title={`${rec.open} of ${CAPACITY} slots in use`}>
          <div className="fc-cap">
            <LoadReactor load={rec.open} label="In use" />
            <div className="ac-readout">
              <div><span>Open</span><b>{rec.open}</b></div>
              <div className={rec.breachedOpen ? "amber" : ""}><span>Breached</span><b>{rec.breachedOpen}</b></div>
              <div><span>Closed · career</span><b>{rec.career}</b></div>
            </div>
          </div>
        </Panel>
      </div>

      <Panel kicker="Category pressure" icon={Activity} title="What you work on">
        {!cats.length ? (
          <Empty icon={Activity} title="No work yet" sub="Your work by category shows here." />
        ) : (
          <div className="ac-catbars">
            {cats.map((c) => (
              <div key={c.key} className="ac-catbar" style={{ "--c": (CAT_META[c.key] || CAT_META.other).color }}>
                <CatGlyph category={c.key} size={30} />
                <div>
                  <b>{c.label}</b>
                  <span className="bar"><i style={{ width: `${Math.max(2, c.w)}%` }} /></span>
                </div>
                <span className="n">{c.closed}/{c.n} closed</span>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <div className="ac-filterline">
        <SortBar options={SORTS} value={sortKey} dir={sortDir} onChange={(id, dir) => { setSortKey(id); setSortDir(dir); }} />
        {filters ? <button type="button" className="ac-btn sm" onClick={reset}><RotateCcw size={12} /> Reset</button> : null}
      </div>

      <ResultLine total={list.length} of={mine.length} page={safePage} size={size} noun="issues on your record" />
      {["closed", "inside", "late"].includes(lens) && earlier > 0 ? (
        <p className="fc-career">
          {rec.closed} closed file{rec.closed === 1 ? "" : "s"} on this board · <b>{rec.career} in your career</b>. {earlier} earlier close{earlier === 1 ? "" : "s"} count in the total but have no files here, so they aren't in this list or the timing figures.
        </p>
      ) : null}

      {!slice.length ? (
        <Empty icon={lens === "all" ? EmptyIcon : FileSearch} title={empty[1]} sub={empty[2]} />
      ) : (
        <div className="ac-list" ref={listRef} key={`${safePage}-${size}-${lens}`}>
          {slice.map((issue, i) => {
            const win = inWindow(issue);
            const [rl, rv] = readout(sortKey, issue);
            return (
              <button
                key={issue.id}
                data-glide={issue.id}
                data-fx
                type="button"
                className={`ac-row click r-${issue.status}${slaOf(issue).state === "over" ? " breach" : ""}`}
                style={{ animationDelay: `${i * 30}ms` }}
                onClick={() => setFileId(issue.id)}
              >
                <FxLayer brackets />
                <CatGlyph category={issue.category} size={40} />
                <div className="ac-row-main">
                  <div className="ac-row-top">
                    <RankBadge n={(safePage - 1) * size + i + 1} />
                    <span className="ac-id">{issue.id}</span>
                    <span className="ac-dot">·</span>
                    <span><MapPin size={11} style={{ verticalAlign: -1 }} /> {issue.ward}</span>
                    <span className="ac-row-go">Open file <ArrowUpRight size={11} /></span>
                  </div>
                  <h4>{issue.title}</h4>
                  <div className="ac-row-meta">
                    <StatusPill status={issue.status} />
                    <PriorityPill priority={issue.priority} />
                    <SlaMeter issue={issue} />
                    {win === true ? <span className="ac-tag green"><Zap size={9} /> Inside window</span> : null}
                    {win === false ? <span className="ac-tag red"><AlertTriangle size={9} /> Closed late</span> : null}
                  </div>
                </div>
                <div className="ac-row-side">
                  <SortChip key={sortKey} label={rl} value={rv} tone={win === false && sortKey === "took" ? "over" : win && sortKey === "took" ? "closed" : ""} />
                  <span className="ac-when"><Calendar size={10} style={{ verticalAlign: -1 }} /> <b>{formatDate(issue.createdAt)}</b> · moved {ago(issue.updatedAt)}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <Pager page={safePage} pages={pages} total={list.length} size={size} onPage={setPage} onSize={setSize} sizes={[6, 9, 12]} />

      <IssueDetailsDrawer issue={fileIssue} onClose={() => setFileId(null)} />
    </Field>
  );
}

export default StaffPerformance;
