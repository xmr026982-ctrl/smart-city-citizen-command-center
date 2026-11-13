import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FileText, Activity, Siren, CheckCircle2, Plus, RotateCcw, FileSearch, Sparkles, Ban } from "lucide-react";
import CitizenReportDrawer from "../../components/issues/citizen/CitizenReportDrawer";
import { readFileParam } from "../../utils/fileLink";
import { useLockOpen } from "../../hooks/useLockOpen";
import {
  LensDeck, SearchBox, Select, ResultLine, Pager, Empty, SortBar, useGlide, useHoverFx, ago,
} from "../../components/issues/admin/CommandKit";
import { Citizen, CitizenHead, ReportRow, useCitizenDesk } from "../../components/issues/citizen/CitizenKit";
import { CATEGORY_LABEL } from "../../constants/issueCategories";
import { slaOf, urgencyCompare, span } from "../../utils/sla";

/* ------------------------------------------------------------------
   My Reports: every report this citizen filed, with where it is in its
   journey and whether the city is keeping its promise. The tile deck
   locks one lens at a time: everything (home), still open, past the
   promise, resolved. Search, category and four sorts (click again to
   flip). A row opens the report drawer. Arriving with { open: id }
   (Report Issue's "Track this report") opens that report straight away.
------------------------------------------------------------------- */

const SORTS = [
  { id: "createdAt", label: "Newest", dir: "desc", desc: "Newest first", asc: "Oldest first" },
  { id: "updatedAt", label: "Updated", dir: "desc", desc: "Recently moved first", asc: "Longest without news first" },
  { id: "promise", label: "Promise", dir: "desc", desc: "Closest to the promise first", asc: "Most time left first" },
  { id: "title", label: "Title", dir: "asc", desc: "Title Z–A", asc: "Title A–Z" },
];
const SORT_DIR = Object.fromEntries(SORTS.map((o) => [o.id, o.dir]));

function readout(key, issue) {
  const s = slaOf(issue);
  if (key === "promise") return ["Promise", s.state === "closed" ? "Done" : s.state === "over" ? `${span(-s.left)} late` : `${span(s.left)} left`, s.state];
  if (key === "updatedAt") return ["Moved", ago(issue.updatedAt)];
  if (key === "title") return ["Title", (issue.title || "?").charAt(0).toUpperCase()];
  return ["Filed", ago(issue.createdAt)];
}

function MyReports() {
  const { user, mine, offBoard, everything, tick } = useCitizenDesk();
  const location = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [lens, setLens] = useState("all"); // all | open | late | resolved
  const [sortKey, setSortKey] = useState("createdAt");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(6);
  const [openId, setOpenId] = useState(null);

  // arrival with ?file= or { open }: clear the filters, lock onto the report, open it (hooks/useLockOpen).
  // The state is wiped so Back / reload doesn't reopen it.
  const [arrival, setArrival] = useState(null);
  useEffect(() => {
    const id = readFileParam(location.search)?.id || location.state?.open;
    if (!id) return;
    setQuery(""); setCategory("all"); setLens("all"); setSortKey("createdAt"); setSortDir("desc");
    setArrival({ id, at: Date.now() });
    navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  const stats = useMemo(() => {
    const open = mine.filter((i) => i.status !== "resolved");
    return {
      all: mine.length,
      open: open.length,
      late: open.filter((i) => slaOf(i).state === "over").length,
      resolved: mine.length - open.length,
      removed: offBoard.length,
      affected: mine.reduce((s, i) => s + (i.supporters || []).length, 0),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mine, offBoard, tick]);

  const list = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const pool = lens === "removed" ? offBoard : lens === "all" ? [...mine, ...offBoard] : mine;
    const out = pool.filter((i) => {
      const open = i.status !== "resolved";
      if (lens === "open" && !open) return false;
      if (lens === "late" && (!open || slaOf(i).state !== "over")) return false;
      if (lens === "resolved" && open) return false;
      if (category !== "all" && i.category !== category) return false;
      if (!needle) return true;
      return `${i.id} ${i.title} ${i.location} ${i.ward} ${CATEGORY_LABEL[i.category] || ""}`.toLowerCase().includes(needle);
    });
    const flip = sortDir === SORT_DIR[sortKey] ? 1 : -1;
    out.sort((a, b) => {
      let d;
      if (sortKey === "promise") d = urgencyCompare(a, b);
      else if (sortKey === "title") d = a.title.localeCompare(b.title);
      else d = new Date(b[sortKey]) - new Date(a[sortKey]);
      return d * flip || a.id.localeCompare(b.id);
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mine, offBoard, query, category, lens, sortKey, sortDir, tick]);

  useEffect(() => { setPage(1); }, [query, category, lens, sortKey, sortDir, size]);
  const lockOpen = useLockOpen({ list, size, setPage, open: setOpenId });
  useEffect(() => { if (arrival) lockOpen.arm(arrival.id); }, [arrival]); // eslint-disable-line react-hooks/exhaustive-deps
  const pages = Math.max(1, Math.ceil(list.length / size));
  const safePage = Math.min(page, pages);
  const slice = list.slice((safePage - 1) * size, safePage * size);
  const listRef = useRef(null);
  useGlide(listRef, `${sortKey}-${sortDir}`);
  useHoverFx(listRef);

  const open = everything.find((i) => i.id === openId) || null;
  const filters = query || category !== "all" || lens !== "all" || sortKey !== "createdAt" || sortDir !== "desc";
  const reset = () => { setQuery(""); setCategory("all"); setLens("all"); setSortKey("createdAt"); setSortDir("desc"); };

  const EMPTY = {
    all: [Sparkles, "You haven't reported anything yet", "When you spot a problem in the city, report it and follow it here."],
    open: [CheckCircle2, "Nothing open", "Every report you filed has been resolved."],
    late: [CheckCircle2, "Nothing is late", "The city is inside its promise on every open report of yours."],
    resolved: [Activity, "Nothing resolved yet", "Reports show here once the city confirms the fix."],
    removed: [CheckCircle2, "Nothing withdrawn or dismissed", "Reports you withdraw, or the city dismisses, are kept here."],
  };
  const empty = query || category !== "all" ? [FileSearch, "No report matches", "Change the search or category, or release the lens."] : EMPTY[lens] || EMPTY.all;
  const EmptyIcon = empty[0];

  return (
    <Citizen>
      <CitizenHead crumb="MY REPORTS" title="My Reports" sub="Everything you reported, where it is now, and whether the city is keeping its promise.">
        <Link to="/citizen/report" className="ac-btn primary"><Plus size={14} /> Report an issue</Link>
      </CitizenHead>

      <LensDeck
        value={lens}
        onChange={setLens}
        readout={`${list.length} of ${mine.length + offBoard.length} reports`}
        tiles={[
          { id: "all", icon: FileText, label: "Your reports", lens: "Everything", value: stats.all, sub: stats.affected ? `${stats.affected} other citizen${stats.affected === 1 ? "" : "s"} joined them` : "Filed by you", meter: 100 },
          { id: "open", icon: Activity, label: "Still open", value: stats.open, sub: "Received, queued or being fixed", meter: stats.all ? (stats.open / stats.all) * 100 : 0, tone: "amber" },
          { id: "late", icon: Siren, label: "Past the promise", value: stats.late, sub: stats.late ? "The city is late on these" : "The city is on time", meter: stats.open ? (stats.late / stats.open) * 100 : 0, tone: stats.late ? "red" : "green" },
          { id: "resolved", icon: CheckCircle2, label: "Resolved", value: stats.resolved, sub: "Fixed and verified by the city", meter: stats.all ? (stats.resolved / stats.all) * 100 : 0, tone: "green" },
          { id: "removed", icon: Ban, label: "Off the board", lens: "Off the board", value: stats.removed, sub: stats.removed ? "Kept with their reasons" : "None", meter: stats.all + stats.removed ? (stats.removed / (stats.all + stats.removed)) * 100 : 0, tone: "cyan" },
        ]}
      />

      <div className="ac-toolbar">
        <div className="grow"><SearchBox value={query} onChange={setQuery} placeholder="Search ID, title, place or zone" /></div>
        <Select label="Category" value={category} onChange={setCategory} options={[{ id: "all", label: "All" }, ...Object.entries(CATEGORY_LABEL).map(([id, label]) => ({ id, label }))]} />
      </div>

      <div className="ac-filterline">
        <SortBar options={SORTS} value={sortKey} dir={sortDir} onChange={(id, dir) => { setSortKey(id); setSortDir(dir); }} />
        {filters ? <button type="button" className="ac-btn sm" onClick={reset}><RotateCcw size={12} /> Reset</button> : null}
      </div>

      <ResultLine total={list.length} of={mine.length + offBoard.length} page={safePage} size={size} noun="reports" />

      {!slice.length ? (
        <Empty icon={EmptyIcon} title={empty[1]} sub={empty[2]} />
      ) : (
        <div className={`ac-list${lockOpen.lockedId ? " targeting" : ""}`} ref={listRef} key={`${safePage}-${size}-${lens}`}>
          {slice.map((issue, i) => (
            <ReportRow key={issue.id} issue={issue} index={i} rank={(safePage - 1) * size + i + 1} readout={readout(sortKey, issue)} onOpen={setOpenId} saved={(issue.savedBy || []).includes(user?.id)} locked={lockOpen.lockedId === issue.id} />
          ))}
        </div>
      )}

      <Pager page={safePage} pages={pages} total={list.length} size={size} onPage={setPage} onSize={setSize} sizes={[6, 9, 12]} />

      <CitizenReportDrawer issue={open} onClose={() => { setOpenId(null); lockOpen.closed(); }} />
    </Citizen>
  );
}

export default MyReports;
