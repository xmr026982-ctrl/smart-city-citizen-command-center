import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Bookmark, Activity, Users, RotateCcw, FileSearch, Plus, FileText } from "lucide-react";
import CitizenReportDrawer from "../../components/issues/citizen/CitizenReportDrawer";
import { readFileParam } from "../../utils/fileLink";
import { useLockOpen } from "../../hooks/useLockOpen";
import {
  LensDeck, SearchBox, ResultLine, Pager, Empty, SortBar, useGlide, useHoverFx, ago,
} from "../../components/issues/admin/CommandKit";
import { Citizen, CitizenHead, ReportRow, useCitizenDesk } from "../../components/issues/citizen/CitizenKit";
import { CATEGORY_LABEL } from "../../constants/issueCategories";
import { isSupporter, affected } from "../../services/citizenService";
import { slaOf, urgencyCompare, span } from "../../utils/sla";

/* ------------------------------------------------------------------
   Saved: the reports this citizen keeps an eye on, in two kinds.
   - Your reports you saved (the bookmark in a report's drawer).
   - Other citizens' reports you follow: you followed one, or said
     "this affects me too" when reporting.
   Lens deck: everything, your saved reports, followed, still open.
   Same search, sorts, pager and drawer as My Reports.
------------------------------------------------------------------- */

const SORTS = [
  { id: "updatedAt", label: "Updated", dir: "desc", desc: "Recently moved first", asc: "Longest without news first" },
  { id: "promise", label: "Promise", dir: "desc", desc: "Closest to the promise first", asc: "Most time left first" },
  { id: "affected", label: "Affected", dir: "desc", desc: "Most citizens affected first", asc: "Fewest affected first" },
];
const SORT_DIR = Object.fromEntries(SORTS.map((o) => [o.id, o.dir]));

function readout(key, issue) {
  const s = slaOf(issue);
  if (key === "promise") return ["Promise", s.state === "closed" ? "Done" : s.state === "over" ? `${span(-s.left)} late` : `${span(s.left)} left`, s.state];
  if (key === "affected") return ["Affected", affected(issue)];
  return ["Moved", ago(issue.updatedAt)];
}

function SavedReports() {
  const { user, starred, following, issues, tick } = useCitizenDesk();
  const location = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [lens, setLens] = useState("all"); // all | mine | following | open
  const [sortKey, setSortKey] = useState("updatedAt");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(6);
  const [openId, setOpenId] = useState(null);

  // arrival with ?file= or { open }: clear the filters, lock onto the report, open it (hooks/useLockOpen)
  const [arrival, setArrival] = useState(null);
  useEffect(() => {
    const id = readFileParam(location.search)?.id || location.state?.open;
    if (!id) return;
    setQuery(""); setLens("all"); setSortKey("updatedAt"); setSortDir("desc");
    setArrival({ id, at: Date.now() });
    navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  const saved = useMemo(() => [...starred, ...following], [starred, following]);
  const mineIds = useMemo(() => new Set(starred.map((i) => i.id)), [starred]);

  const stats = useMemo(() => {
    const open = saved.filter((i) => i.status !== "resolved");
    return {
      all: saved.length,
      mine: starred.length,
      following: following.length,
      joined: following.filter((i) => isSupporter(i, user)).length,
      open: open.length,
    };
  }, [saved, starred, following, user]);

  const list = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const out = saved.filter((i) => {
      if (lens === "mine" && !mineIds.has(i.id)) return false;
      if (lens === "following" && mineIds.has(i.id)) return false;
      if (lens === "open" && i.status === "resolved") return false;
      if (!needle) return true;
      return `${i.id} ${i.title} ${i.location} ${i.ward} ${CATEGORY_LABEL[i.category] || ""}`.toLowerCase().includes(needle);
    });
    const flip = sortDir === SORT_DIR[sortKey] ? 1 : -1;
    out.sort((a, b) => {
      let d;
      if (sortKey === "promise") d = urgencyCompare(a, b);
      else if (sortKey === "affected") d = affected(b) - affected(a);
      else d = new Date(b.updatedAt) - new Date(a.updatedAt);
      return d * flip || a.id.localeCompare(b.id);
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved, mineIds, query, lens, sortKey, sortDir, tick]);

  useEffect(() => { setPage(1); }, [query, lens, sortKey, sortDir, size]);
  const lockOpen = useLockOpen({ list, size, setPage, open: setOpenId });
  useEffect(() => { if (arrival) lockOpen.arm(arrival.id); }, [arrival]); // eslint-disable-line react-hooks/exhaustive-deps
  const pages = Math.max(1, Math.ceil(list.length / size));
  const safePage = Math.min(page, pages);
  const slice = list.slice((safePage - 1) * size, safePage * size);
  const listRef = useRef(null);
  useGlide(listRef, `${sortKey}-${sortDir}`);
  useHoverFx(listRef);

  const open = issues.find((i) => i.id === openId) || null;
  const filters = query || lens !== "all" || sortKey !== "updatedAt" || sortDir !== "desc";
  const reset = () => { setQuery(""); setLens("all"); setSortKey("updatedAt"); setSortDir("desc"); };

  const EMPTY = {
    all: [Bookmark, "Nothing saved yet", "Open one of your reports and press Save, or choose \"Affects me too\" on someone else's report. They all gather here."],
    mine: [FileText, "None of your reports saved", "Open a report on My Reports and press Save to keep it here."],
    following: [Users, "You aren't following anyone's report", "When you report a problem someone already reported, choose \"Affects me too\" and you'll follow it here."],
    open: [Activity, "Nothing open", "Every report you saved has been resolved."],
  };
  const empty = query ? [FileSearch, "No report matches", "Change the search or release the lens."] : EMPTY[lens] || EMPTY.all;
  const EmptyIcon = empty[0];

  const tagOf = (issue) => {
    if (mineIds.has(issue.id)) return "Your report";
    return isSupporter(issue, user) ? "Affects you too" : "Following";
  };

  return (
    <Citizen>
      <CitizenHead crumb="SAVED" title="Saved" sub="Your reports you saved, and other citizens' reports you follow because they affect you too.">
        <Link to="/citizen/report" className="ac-btn"><Plus size={14} /> Report an issue</Link>
      </CitizenHead>

      <LensDeck
        value={lens}
        onChange={setLens}
        readout={`${list.length} of ${saved.length} saved`}
        tiles={[
          { id: "all", icon: Bookmark, label: "Saved", lens: "Everything", value: stats.all, sub: "Yours and the ones you follow", meter: 100 },
          { id: "mine", icon: FileText, label: "Your reports", value: stats.mine, sub: "Saved from My Reports", meter: stats.all ? (stats.mine / stats.all) * 100 : 0, tone: "cyan" },
          { id: "following", icon: Users, label: "Reports you follow", value: stats.following, sub: stats.following ? `${stats.joined} joined with "affects me too"` : "Other people's reports you follow", meter: stats.all ? (stats.following / stats.all) * 100 : 0, tone: "green" },
          { id: "open", icon: Activity, label: "Still open", value: stats.open, sub: "Received, queued or being fixed", meter: stats.all ? (stats.open / stats.all) * 100 : 0, tone: "amber" },
        ]}
      />

      <div className="ac-toolbar">
        <div className="grow"><SearchBox value={query} onChange={setQuery} placeholder="Search ID, title, place or zone" /></div>
      </div>
      <div className="ac-filterline">
        <SortBar options={SORTS} value={sortKey} dir={sortDir} onChange={(id, dir) => { setSortKey(id); setSortDir(dir); }} />
        {filters ? <button type="button" className="ac-btn sm" onClick={reset}><RotateCcw size={12} /> Reset</button> : null}
      </div>

      <ResultLine total={list.length} of={saved.length} page={safePage} size={size} noun="reports" />

      {!slice.length ? (
        <Empty icon={EmptyIcon} title={empty[1]} sub={empty[2]} />
      ) : (
        <div className={`ac-list${lockOpen.lockedId ? " targeting" : ""}`} ref={listRef} key={`${safePage}-${size}-${lens}`}>
          {slice.map((issue, i) => (
            <ReportRow key={issue.id} issue={issue} index={i} rank={(safePage - 1) * size + i + 1} readout={readout(sortKey, issue)} onOpen={setOpenId} tag={tagOf(issue)} locked={lockOpen.lockedId === issue.id} />
          ))}
        </div>
      )}

      <Pager page={safePage} pages={pages} total={list.length} size={size} onPage={setPage} onSize={setSize} sizes={[6, 9, 12]} />

      <CitizenReportDrawer issue={open} onClose={() => { setOpenId(null); lockOpen.closed(); }} closeOnUnsave />
    </Citizen>
  );
}

export default SavedReports;
