import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { readFileParam } from "../../utils/fileLink";
import { useLockOpen } from "../../hooks/useLockOpen";
import LockMarks from "../../components/ui/LockMarks";
import { useMinute } from "../../hooks/useMinute";
import {
  Layers, Inbox, Siren, AlertTriangle, MapPin, Calendar, RotateCcw, FileSearch, UserX, Flame, ArrowUpRight,
} from "lucide-react";
import IssueDetailsDrawer from "../../components/issues/shared/IssueDetailsDrawer";
import {
  Command, CommandHead, LensDeck, SearchBox, Select, Chips, ResultLine, Pager, CatGlyph,
  StatusPill, PriorityPill, SlaMeter, Avatar, Empty, ago, SortBar, SortChip, RankBadge, useGlide, useHoverFx, FxLayer,
} from "../../components/issues/admin/CommandKit";
import { CATEGORY_LABEL } from "../../constants/issueCategories";
import { STATUS_LABEL, ISSUE_STATUSES } from "../../constants/issueStatuses";
import { PRIORITY_LABEL } from "../../constants/issuePriorities";
import { WARDS } from "../../constants/issueConstants";
import { useIssues, useAllIssues } from "../../store/issueStore";
import { useFieldRoster, mismatchOf } from "../../store/fieldRoster";
import { slaOf, PRIORITY_RANK, urgencyCompare } from "../../utils/sla";
import { formatDate } from "../../utils/formatDate";
import { nameFor, useNames } from "../../store/profileStore";

/* ------------------------------------------------------------------
   All Issues: the full ledger. The tile deck locks one lens at a time
   (everything / no owner / breached / critical open). Search, zone,
   category, priority and status filters stack on top of the lens.
   Seven sorts (click the active one again to flip it; every row shows
   its rank and the value it is sorted by, and rows glide into place),
   pager, and the issue file drawer on click. Hover scan: a light follows
   the cursor, the status rail glows, brackets close in, "Open file" shows.
------------------------------------------------------------------- */

const SORTS = [
  { id: "urgency", label: "Urgency", dir: "desc", desc: "Most urgent first", asc: "Least urgent first" },
  { id: "createdAt", label: "Reported", dir: "desc", desc: "Newest reports first", asc: "Oldest reports first" },
  { id: "updatedAt", label: "Updated", dir: "desc", desc: "Recently updated first", asc: "Longest untouched first" },
  { id: "priority", label: "Priority", dir: "desc", desc: "Critical first", asc: "Low first" },
  { id: "category", label: "Category", dir: "asc", desc: "Category Z–A", asc: "Category A–Z" },
  { id: "title", label: "Title", dir: "asc", desc: "Title Z–A", asc: "Title A–Z" },
  { id: "status", label: "Status", dir: "desc", desc: "Furthest along first", asc: "Newest stage first" },
];

// the value each row is ranked by, shown on the row
function readout(key, issue) {
  if (key === "urgency") return ["Window", slaOf(issue).label];
  if (key === "createdAt") return ["Filed", ago(issue.createdAt)];
  if (key === "updatedAt") return ["Touched", ago(issue.updatedAt)];
  if (key === "priority") return ["Priority", PRIORITY_LABEL[issue.priority] || issue.priority];
  if (key === "category") return ["Category", CATEGORY_LABEL[issue.category] || issue.category];
  if (key === "status") return ["Stage", STATUS_LABEL[issue.status] || issue.status];
  return ["Title", (issue.title || "?").charAt(0).toUpperCase()];
}

function AllIssues() {
  useNames(); // names follow each person's current display name
  const issues = useIssues();
  const everything = useAllIssues(); // a link can point at a removed file (merged, dismissed); it still opens
  const { roster } = useFieldRoster();
  const location = useLocation();
  const navigate = useNavigate();
  const tick = useMinute();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(["submitted", "acknowledged", "in_progress", "pending_review", "resolved"].includes(location.state?.status) ? location.state.status : "all");
  const [ward, setWard] = useState(location.state?.ward || "all");
  const [category, setCategory] = useState("all");
  const [priority, setPriorityFilter] = useState("all");
  const [lens, setLens] = useState(["unowned", "breached", "critical"].includes(location.state?.lens) ? location.state.lens : "all"); // all | unowned | breached | critical
  const [sortKey, setSortKey] = useState("urgency");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [selectedId, setSelectedId] = useState(null);

  // arrivals: a zone tile on Issue Command ({ ward }) or an old /admin/issues/:id link ({ open }).
  // Applied once, then the state is wiped so a reload or Back doesn't re-apply it.
  // a file link clears the filters, then locks onto the row and opens it (hooks/useLockOpen)
  const [arrival, setArrival] = useState(null);
  useEffect(() => {
    const file = readFileParam(location.search);
    const st = location.state;
    const id = file?.id || st?.open || null;
    if (!id && !st?.ward) return;
    if (id) {
      setQuery(""); setStatus("all"); setWard("all"); setCategory("all"); setPriorityFilter("all"); setLens("all");
      setSortKey("urgency"); setSortDir("desc");
      setArrival({ id, at: Date.now() });
    } else if (st.ward) setWard(st.ward);
    navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  const stats = useMemo(() => {
    const open = issues.filter((i) => i.status !== "resolved");
    return {
      total: issues.length,
      open: open.length,
      unowned: open.filter((i) => !i.assignedTo).length,
      breached: open.filter((i) => slaOf(i).state === "over").length,
      critical: open.filter((i) => i.priority === "critical").length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issues, tick]);

  const statusCounts = useMemo(() => {
    const c = { all: issues.length };
    ISSUE_STATUSES.forEach((s) => { c[s] = issues.filter((i) => i.status === s).length; });
    return c;
  }, [issues]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = issues.filter((issue) => {
      const open = issue.status !== "resolved";
      if (lens === "unowned" && (issue.assignedTo || !open)) return false;
      if (lens === "breached" && slaOf(issue).state !== "over") return false;
      if (lens === "critical" && (issue.priority !== "critical" || !open)) return false;
      if (status !== "all" && issue.status !== status) return false;
      if (ward !== "all" && issue.ward !== ward) return false;
      if (category !== "all" && issue.category !== category) return false;
      if (priority !== "all" && issue.priority !== priority) return false;
      if (!needle) return true;
      const hay = `${issue.id} ${issue.title} ${issue.location} ${issue.ward} ${CATEGORY_LABEL[issue.category] || ""} ${issue.assignedTo || ""} ${issue.reportedBy || ""}`.toLowerCase();
      return hay.includes(needle);
    });
    const dir = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      if (sortKey === "urgency") return sortDir === "desc" ? urgencyCompare(a, b) : urgencyCompare(b, a);
      if (sortKey === "createdAt" || sortKey === "updatedAt") return (new Date(a[sortKey]) - new Date(b[sortKey])) * dir;
      if (sortKey === "priority") return ((PRIORITY_RANK[a.priority] || 0) - (PRIORITY_RANK[b.priority] || 0)) * dir;
      if (sortKey === "category") return (CATEGORY_LABEL[a.category] || "").localeCompare(CATEGORY_LABEL[b.category] || "") * dir;
      if (sortKey === "status") return (ISSUE_STATUSES.indexOf(a.status) - ISSUE_STATUSES.indexOf(b.status)) * dir;
      return a.title.localeCompare(b.title) * dir;
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issues, query, status, ward, category, priority, lens, sortKey, sortDir, tick]);

  useEffect(() => { setPage(1); }, [query, status, ward, category, priority, lens, sortKey, sortDir, size]);

  const lockOpen = useLockOpen({ list: filtered, size, setPage, open: setSelectedId });
  useEffect(() => { if (arrival) lockOpen.arm(arrival.id); }, [arrival]); // eslint-disable-line react-hooks/exhaustive-deps

  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const safePage = Math.min(page, pages);
  const slice = filtered.slice((safePage - 1) * size, safePage * size);
  const selected = everything.find((i) => i.id === selectedId) || null;

  const pickSort = (id, dir) => { setSortKey(id); setSortDir(dir); };
  const listRef = useRef(null);
  useGlide(listRef, `${sortKey}-${sortDir}`);
  useHoverFx(listRef);

  const filtered_ = status !== "all" || ward !== "all" || category !== "all" || priority !== "all" || lens !== "all" || query || sortKey !== "urgency" || sortDir !== "desc";
  const reset = () => { setStatus("all"); setWard("all"); setCategory("all"); setPriorityFilter("all"); setLens("all"); setQuery(""); setSortKey("urgency"); setSortDir("desc"); };

  return (
    <Command>
      <CommandHead crumb="ALL ISSUES" title="All Issues" sub="Every civic issue on the board, most urgent first. Lock a tile to focus the ledger. Open any row for the full issue file.">
      </CommandHead>

      <LensDeck
        value={lens}
        onChange={setLens}
        readout={`${filtered.length} of ${issues.length} issues`}
        tiles={[
          { id: "all", icon: Layers, label: "On record", lens: "Everything", value: stats.total, sub: `${stats.open} still open`, meter: stats.total ? (stats.open / stats.total) * 100 : 0 },
          { id: "unowned", icon: Inbox, label: "No owner", value: stats.unowned, sub: "Waiting for dispatch", meter: stats.open ? (stats.unowned / stats.open) * 100 : 0, tone: "amber" },
          { id: "breached", icon: Siren, label: "SLA breached", value: stats.breached, sub: "Past their service window", meter: stats.open ? (stats.breached / stats.open) * 100 : 0, tone: "red" },
          { id: "critical", icon: AlertTriangle, label: "Critical open", value: stats.critical, sub: "Highest priority, still open", meter: stats.open ? (stats.critical / stats.open) * 100 : 0, tone: "red" },
        ]}
      />

      <div className="ac-toolbar">
        <div className="grow"><SearchBox value={query} onChange={setQuery} placeholder="Search ID, title, place, zone, owner or reporter" /></div>
        <Select label="Zone" value={ward} onChange={setWard} options={[{ id: "all", label: "All zones" }, ...WARDS.map((w) => ({ id: w.name, label: w.name }))]} />
        <Select label="Category" value={category} onChange={setCategory} options={[{ id: "all", label: "All" }, ...Object.entries(CATEGORY_LABEL).map(([id, label]) => ({ id, label }))]} />
        <Select label="Priority" value={priority} onChange={setPriorityFilter} options={[{ id: "all", label: "All" }, { id: "critical", label: "Critical" }, { id: "high", label: "High" }, { id: "medium", label: "Medium" }, { id: "low", label: "Low" }]} />
      </div>

      <div className="ac-filterline">
        <Chips
          value={status}
          onChange={setStatus}
          items={[{ id: "all", label: "All", count: statusCounts.all }, ...ISSUE_STATUSES.map((s) => ({ id: s, label: STATUS_LABEL[s], count: statusCounts[s] }))]}
        />
        <Chips
          value={lens}
          onChange={(v) => setLens(v === lens ? "all" : v)}
          items={[
            { id: "unowned", label: "No owner", icon: UserX, tone: "amber", count: stats.unowned },
            { id: "breached", label: "Breached", icon: Flame, tone: "red", count: stats.breached },
          ]}
        />
      </div>

      <div className="ac-filterline">
        <SortBar options={SORTS} value={sortKey} dir={sortDir} onChange={pickSort} />
        {filtered_ ? <button type="button" className="ac-btn sm" onClick={reset}><RotateCcw size={12} /> Reset filters</button> : null}
      </div>

      <ResultLine total={filtered.length} of={issues.length} page={safePage} size={size} noun="issues" />

      {!slice.length ? (
        <Empty icon={FileSearch} title="No issue matches" sub="Change a filter, release the lens or clear the search." />
      ) : (
        <div className={`ac-list${lockOpen.lockedId ? " targeting" : ""}`} ref={listRef} key={`${safePage}-${size}-${lens}`}>
          {slice.map((issue, i) => {
            const sla = slaOf(issue);
            const off = mismatchOf(issue, roster);
            const [rl, rv] = readout(sortKey, issue);
            return (
              <button
                key={issue.id}
                data-glide={issue.id}
                data-fx
                type="button"
                className={`ac-row click r-${issue.status}${sla.state === "over" ? " breach" : ""}${off ? " offx" : ""}${lockOpen.lockedId === issue.id ? " target" : ""}`}
                style={{ animationDelay: `${i * 30}ms` }}
                onClick={() => setSelectedId(issue.id)}
              >
                {lockOpen.lockedId === issue.id ? <LockMarks /> : null}
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
                    {off ? <span className="ac-tag red" title={`${issue.assignedTo} is ${off.hasLabel}; this issue needs ${off.needLabel}`}><AlertTriangle size={9} /> Off-expertise · {off.hasLabel}</span> : null}
                  </div>
                </div>
                <div className="ac-row-side">
                  <SortChip key={sortKey} label={rl} value={rv} tone={sortKey === "urgency" ? sla.state : ""} />
                  {issue.assignedTo ? (
                    <span className="ac-owner"><Avatar name={nameFor(issue.assignedTo)} size={26} /> {nameFor(issue.assignedTo)}</span>
                  ) : (
                    <span className="ac-owner none">{issue.status === "resolved" ? "Closed" : "No owner"}</span>
                  )}
                  <span className="ac-when"><Calendar size={10} style={{ verticalAlign: -1 }} /> <b>{formatDate(issue.createdAt)}</b> · updated {ago(issue.updatedAt)}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <Pager page={safePage} pages={pages} total={filtered.length} size={size} onPage={setPage} onSize={setSize} sizes={[6, 10, 15]} />

      <IssueDetailsDrawer issue={selected} onClose={() => { setSelectedId(null); lockOpen.closed(); }} />
    </Command>
  );
}

export default AllIssues;