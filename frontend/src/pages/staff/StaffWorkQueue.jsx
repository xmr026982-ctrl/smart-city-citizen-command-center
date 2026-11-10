import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Inbox, MapPinned, Zap, UserX, Siren, MapPin, Calendar, RotateCcw, FileSearch, ArrowUpRight, Sparkles, CheckCircle2 } from "lucide-react";
import IssueDetailsDrawer from "../../components/issues/shared/IssueDetailsDrawer";
import {
  LensDeck, SearchBox, Select, Chips, ResultLine, Pager, CatGlyph, StatusPill, PriorityPill, SlaMeter, Avatar, Empty,
  SortBar, SortChip, RankBadge, useGlide, useHoverFx, FxLayer, ago,
} from "../../components/issues/admin/CommandKit";
import { Field, FieldHead, useFieldDesk } from "../../components/issues/staff/FieldKit";
import { CATEGORY_LABEL } from "../../constants/issueCategories";
import { STATUS_LABEL } from "../../constants/issueStatuses";
import { PRIORITY_LABEL } from "../../constants/issuePriorities";
import { WARDS } from "../../constants/issueConstants";
import { expertiseForCategory, expertiseLabel } from "../../config/expertise";
import { slaOf, PRIORITY_RANK, urgencyCompare } from "../../utils/sla";
import { formatDate } from "../../utils/formatDate";
import { nameFor, useNames } from "../../store/profileStore";

/* ------------------------------------------------------------------
   City Intake: the open city board, read-only for the field. What is
   coming, where, and whether it is your kind of work. Dispatch is
   command's call; the field reads the board here and moves its own
   work on Assigned Work.
   The tile deck locks one lens at a time: whole open board (home), your
   zone, your expertise line, no owner yet, breached. Search, zone and
   category stack on top. Rows on you carry an "On you" tag.
------------------------------------------------------------------- */

const OPEN = ["submitted", "acknowledged", "in_progress", "pending_review"];
const SORTS = [
  { id: "urgency", label: "Urgency", dir: "desc", desc: "Most urgent first", asc: "Least urgent first" },
  { id: "createdAt", label: "Reported", dir: "desc", desc: "Newest reports first", asc: "Oldest reports first" },
  { id: "updatedAt", label: "Updated", dir: "desc", desc: "Recently moved first", asc: "Longest untouched first" },
  { id: "priority", label: "Priority", dir: "desc", desc: "Critical first", asc: "Low first" },
];
const SORT_DIR = Object.fromEntries(SORTS.map((o) => [o.id, o.dir]));

function readout(key, issue) {
  if (key === "urgency") return ["Window", slaOf(issue).label];
  if (key === "createdAt") return ["Filed", ago(issue.createdAt)];
  if (key === "updatedAt") return ["Moved", ago(issue.updatedAt)];
  return ["Priority", PRIORITY_LABEL[issue.priority] || issue.priority];
}

function StaffWorkQueue() {
  useNames(); // names follow each person's current display name
  const { user, issues, me, tick } = useFieldDesk();
  const [query, setQuery] = useState("");
  const [ward, setWard] = useState("all");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [lens, setLens] = useState("all"); // all | zone | line | unowned | breached
  const [sortKey, setSortKey] = useState("urgency");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [fileId, setFileId] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();

  // arrival from an old /staff/issues/:id link ({ open }): open the file once, then wipe the state
  useEffect(() => {
    const st = location.state;
    if (!st?.open) return;
    setFileId(st.open);
    navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  const zone = me?.zone || null;
  const line = me?.expertise || null;
  const open = useMemo(() => issues.filter((i) => i.status !== "resolved"), [issues]);
  const isLine = (issue) => Boolean(line) && expertiseForCategory(issue.category) === line;

  const stats = useMemo(() => ({
    open: open.length,
    zone: zone ? open.filter((i) => i.ward === zone).length : 0,
    line: line ? open.filter((i) => expertiseForCategory(i.category) === line).length : 0,
    unowned: open.filter((i) => !i.assignedTo).length,
    breached: open.filter((i) => slaOf(i).state === "over").length,
    mine: open.filter((i) => i.assignedTo === user?.name).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [open, zone, line, user?.name, tick]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = open.filter((issue) => {
      if (lens === "zone" && issue.ward !== zone) return false;
      if (lens === "line" && !isLine(issue)) return false;
      if (lens === "unowned" && issue.assignedTo) return false;
      if (lens === "breached" && slaOf(issue).state !== "over") return false;
      if (ward !== "all" && issue.ward !== ward) return false;
      if (category !== "all" && issue.category !== category) return false;
      if (status !== "all" && issue.status !== status) return false;
      if (!needle) return true;
      return `${issue.id} ${issue.title} ${issue.location} ${issue.ward} ${CATEGORY_LABEL[issue.category] || ""} ${issue.assignedTo || ""}`.toLowerCase().includes(needle);
    });
    const flip = sortDir === SORT_DIR[sortKey] ? 1 : -1;
    list.sort((a, b) => {
      let d;
      if (sortKey === "urgency") d = urgencyCompare(a, b);
      else if (sortKey === "createdAt" || sortKey === "updatedAt") d = new Date(b[sortKey]) - new Date(a[sortKey]);
      else d = (PRIORITY_RANK[b.priority] || 0) - (PRIORITY_RANK[a.priority] || 0);
      return d * flip || a.id.localeCompare(b.id);
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lens, zone, line, ward, category, status, query, sortKey, sortDir, tick]);

  useEffect(() => { setPage(1); }, [query, ward, category, status, lens, sortKey, sortDir, size]);

  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const safePage = Math.min(page, pages);
  const slice = filtered.slice((safePage - 1) * size, safePage * size);
  const fileIssue = issues.find((i) => i.id === fileId) || null;

  const listRef = useRef(null);
  useGlide(listRef, `${sortKey}-${sortDir}`);
  useHoverFx(listRef);

  // a zone lens and the zone filter would fight: picking the lens clears the filter
  const pickLens = (id) => { setLens(id); if (id === "zone") setWard("all"); };
  const filters = query || ward !== "all" || category !== "all" || status !== "all" || lens !== "all" || sortKey !== "urgency" || sortDir !== "desc";
  const reset = () => { setQuery(""); setWard("all"); setCategory("all"); setStatus("all"); setLens("all"); setSortKey("urgency"); setSortDir("desc"); };

  const EMPTY = {
    all: [Sparkles, "The city board is clear", "No open issue anywhere right now."],
    zone: [CheckCircle2, `Nothing open in ${zone || "your zone"}`, "Your zone has no open issue right now."],
    line: [CheckCircle2, `No open ${line ? expertiseLabel(line) : "line"} work`, "Nothing on the board needs your expertise right now."],
    unowned: [CheckCircle2, "Every open issue has an owner", "Command has dispatched the whole board."],
    breached: [CheckCircle2, "No breached issue", "Every open issue is inside its service window."],
  };
  const empty = query || ward !== "all" || category !== "all" || status !== "all"
    ? [FileSearch, "No issue matches", "Change a filter, release the lens or clear the search."]
    : EMPTY[lens] || EMPTY.all;
  const EmptyIcon = empty[0];

  const tiles = [
    { id: "all", icon: Inbox, label: "Open board", lens: "Whole open board", value: stats.open, sub: `${stats.mine} of them on you`, meter: 100 },
    { id: "zone", icon: MapPinned, label: zone ? `${zone}` : "Your zone", lens: zone ? `Zone · ${zone}` : "Your zone", value: stats.zone, sub: "Open in your zone", meter: stats.open ? (stats.zone / stats.open) * 100 : 0 },
    { id: "line", icon: Zap, label: line ? `${expertiseLabel(line)} line` : "Your line", lens: line ? `${expertiseLabel(line)} work` : "Your line", value: stats.line, sub: "Needs your expertise", meter: stats.open ? (stats.line / stats.open) * 100 : 0, tone: "cyan" },
    { id: "unowned", icon: UserX, label: "No owner", value: stats.unowned, sub: "Waiting for command's dispatch", meter: stats.open ? (stats.unowned / stats.open) * 100 : 0, tone: "amber" },
    { id: "breached", icon: Siren, label: "Breached", value: stats.breached, sub: "Past their service window", meter: stats.open ? (stats.breached / stats.open) * 100 : 0, tone: stats.breached ? "red" : "green" },
  ].filter((t) => (t.id === "zone" ? zone : t.id === "line" ? line : true));

  return (
    <Field>
      <FieldHead crumb="CITY INTAKE" title="City Intake" sub="The open city board, most urgent first. Read only: command dispatches, and you move your own work on Assigned Work." me={me} tick={tick} />

      <LensDeck value={lens} onChange={pickLens} readout={`${filtered.length} of ${open.length} open issues`} tiles={tiles} />

      <div className="ac-toolbar">
        <div className="grow"><SearchBox value={query} onChange={setQuery} placeholder="Search ID, title, place, zone or owner" /></div>
        <Select label="Zone" value={ward} onChange={(v) => { setWard(v); if (lens === "zone" && v !== "all") setLens("all"); }} options={[{ id: "all", label: "All zones" }, ...WARDS.map((w) => ({ id: w.name, label: w.name }))]} />
        <Select label="Category" value={category} onChange={setCategory} options={[{ id: "all", label: "All" }, ...Object.entries(CATEGORY_LABEL).map(([id, label]) => ({ id, label }))]} />
      </div>

      <div className="ac-filterline">
        <Chips value={status} onChange={setStatus} items={[{ id: "all", label: "All open", count: open.length }, ...OPEN.map((s) => ({ id: s, label: STATUS_LABEL[s], count: open.filter((i) => i.status === s).length }))]} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <SortBar options={SORTS} value={sortKey} dir={sortDir} onChange={(id, dir) => { setSortKey(id); setSortDir(dir); }} />
          {filters ? <button type="button" className="ac-btn sm" onClick={reset}><RotateCcw size={12} /> Reset</button> : null}
        </div>
      </div>

      <ResultLine total={filtered.length} of={open.length} page={safePage} size={size} noun="open issues" />

      {!slice.length ? (
        <Empty icon={EmptyIcon} title={empty[1]} sub={empty[2]} />
      ) : (
        <div className="ac-list" ref={listRef} key={`${safePage}-${size}-${lens}`}>
          {slice.map((issue, i) => {
            const sla = slaOf(issue);
            const onMe = issue.assignedTo === user?.name;
            const [rl, rv] = readout(sortKey, issue);
            return (
              <button
                key={issue.id}
                data-glide={issue.id}
                data-fx
                type="button"
                className={`ac-row click r-${issue.status}${sla.state === "over" ? " breach" : ""}`}
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
                    <span className="ac-dot">·</span>
                    <span>{CATEGORY_LABEL[issue.category] || issue.category}</span>
                    <span className="ac-row-go">Open file <ArrowUpRight size={11} /></span>
                  </div>
                  <h4>{issue.title}</h4>
                  <div className="ac-row-meta">
                    <StatusPill status={issue.status} />
                    <PriorityPill priority={issue.priority} />
                    <SlaMeter issue={issue} />
                    {onMe ? <span className="ac-tag violet">On you</span> : isLine(issue) ? <span className="ac-tag violet"><Zap size={9} /> Your line</span> : null}
                    {zone && issue.ward === zone && !onMe ? <span className="ac-tag">Your zone</span> : null}
                  </div>
                </div>
                <div className="ac-row-side">
                  <SortChip key={sortKey} label={rl} value={rv} tone={sortKey === "urgency" ? sla.state : ""} />
                  {issue.assignedTo ? (
                    <span className="ac-owner"><Avatar name={nameFor(issue.assignedTo)} size={26} /> {onMe ? "You" : nameFor(issue.assignedTo)}</span>
                  ) : (
                    <span className="ac-owner none">No owner</span>
                  )}
                  <span className="ac-when"><Calendar size={10} style={{ verticalAlign: -1 }} /> <b>{formatDate(issue.createdAt)}</b> · moved {ago(issue.updatedAt)}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <Pager page={safePage} pages={pages} total={filtered.length} size={size} onPage={setPage} onSize={setSize} sizes={[6, 10, 15]} />

      <IssueDetailsDrawer issue={fileIssue} onClose={() => setFileId(null)} />
    </Field>
  );
}

export default StaffWorkQueue;
