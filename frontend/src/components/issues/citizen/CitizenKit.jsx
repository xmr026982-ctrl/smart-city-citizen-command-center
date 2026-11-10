import LockMarks from "../../ui/LockMarks";
import { useMemo } from "react";
import { MapPin, ArrowUpRight, Siren, Users, Calendar, Bookmark } from "lucide-react";
import { Command, FxLayer, CatGlyph, RankBadge, StatusPill, SlaMeter, SortChip, ago } from "../admin/CommandKit";
import { CATEGORY_LABEL } from "../../../constants/issueCategories";
import { publicStatus } from "../../../constants/issueStatuses";
import { slaOf } from "../../../utils/sla";
import { formatDate } from "../../../utils/formatDate";
import { useAuth } from "../../../store/authStore";
import { useIssues, useAllIssues } from "../../../store/issueStore";
import { useMinute } from "../../../hooks/useMinute";
import { isFollowing, isReporter, isSupporter, affected } from "../../../services/citizenService";
import "../../../styles/citizen-command.css";

/* ------------------------------------------------------------------
   Citizen kit: the parts every citizen Issue Management page shares.
   Pages are built from the same Command kit as the admin and field
   desks (layout, motion, controls), inside <Citizen>, which turns the
   whole desk cyan.
------------------------------------------------------------------- */

export function Citizen({ children }) {
  return <Command className="ctz">{children}</Command>;
}

export function CitizenHead({ crumb, title, sub, children }) {
  return (
    <header className="ac-head">
      <div>
        <h1>{title}</h1>
        {sub ? <p className="ac-sub">{sub}</p> : null}
      </div>
      {children ? <div className="ac-head-tools">{children}</div> : null}
    </header>
  );
}

/* the citizen, their own reports, the ones they saved and the ones they follow */
export function useCitizenDesk() {
  const user = useAuth();
  const issues = useIssues();
  const everything = useAllIssues();
  const tick = useMinute();
  const mine = useMemo(() => issues.filter((i) => isReporter(i, user)), [issues, user]);
  // own reports that left the board (withdrawn / dismissed) stay visible to their reporter
  const offBoard = useMemo(() => everything.filter((i) => i.removed && isReporter(i, user)), [everything, user]);
  const following = useMemo(
    () => issues.filter((i) => !isReporter(i, user) && (isFollowing(i, user) || isSupporter(i, user))),
    [issues, user]
  );
  const starred = useMemo(() => mine.filter((i) => isFollowing(i, user)), [mine, user]);
  return { user, issues, everything, mine, offBoard, following, starred, tick };
}

/* the citizen-facing service window: what was promised, in plain words */
export function promiseOf(issue) {
  const h = Number(issue.slaHours) || 0;
  if (!h) return "No window set";
  return h < 24 ? `within ${h} hours` : h % 24 ? `within ${Math.floor(h / 24)}d ${h % 24}h` : `within ${h / 24} day${h === 24 ? "" : "s"}`;
}

/* One report as a list row (My Reports, Following). Public facts only. */
export function ReportRow({ issue, rank, readout, onOpen, index = 0, tag, saved, locked = false }) {
  return (
    <button
      type="button"
      data-glide={issue.id}
      data-fx
      className={`ac-row click r-${publicStatus(issue.status)}${slaOf(issue).state === "over" ? " breach" : ""}${locked ? " target" : ""}`}
      style={{ animationDelay: `${index * 30}ms` }}
      onClick={() => onOpen(issue.id)}
    >
      {locked ? <LockMarks /> : null}
      <FxLayer brackets />
      <CatGlyph category={issue.category} size={40} />
      <div className="ac-row-main">
        <div className="ac-row-top">
          <RankBadge n={rank} />
          <span className="ac-id">{issue.id}</span>
          <span className="ac-dot">·</span>
          <span><MapPin size={11} style={{ verticalAlign: -1 }} /> {issue.ward}</span>
          <span className="ac-dot">·</span>
          <span>{CATEGORY_LABEL[issue.category] || issue.category}</span>
          <span className="ac-row-go">Open report <ArrowUpRight size={11} /></span>
        </div>
        <h4>{issue.title}</h4>
        <div className="ac-row-meta">
          {issue.removed ? (
            <span className={`ac-tag ${issue.removed.kind === "dismissed" ? "red" : ""}`}>{issue.removed.kind === "withdrawn" ? "Withdrawn" : "Dismissed"}</span>
          ) : (
            <>
              <StatusPill status={publicStatus(issue.status)} />
              <SlaMeter issue={issue} />
            </>
          )}
          {issue.danger ? <span className="ac-tag red"><Siren size={9} /> Danger</span> : null}
          {saved ? <span className="ac-tag violet"><Bookmark size={9} fill="currentColor" /> Saved</span> : null}
          {tag ? <span className="ac-tag violet">{tag}</span> : null}
        </div>
      </div>
      <div className="ac-row-side">
        {readout ? <SortChip label={readout[0]} value={readout[1]} tone={readout[2] || ""} /> : null}
        <span className="cz-affected" title="Citizens affected"><Users size={12} /> {affected(issue)} affected</span>
        <span className="ac-when"><Calendar size={10} style={{ verticalAlign: -1 }} /> <b>{formatDate(issue.createdAt)}</b> · updated {ago(issue.updatedAt)}</span>
      </div>
    </button>
  );
}
