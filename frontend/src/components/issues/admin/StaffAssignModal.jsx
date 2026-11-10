import { useEffect, useMemo, useRef, useState } from "react";
import { X, Zap, MapPin, Radar, Sparkles, Send, Lock, Users, AlertTriangle, Flame, CornerUpLeft } from "lucide-react";
import { CATEGORY_LABEL } from "../../../constants/issueCategories";
import { ISSUE_PRIORITIES, PRIORITY_LABEL } from "../../../constants/issuePriorities";
import { expertiseLabel } from "../../../config/expertise";
import { useFieldRoster, rankCandidates, CAPACITY } from "../../../store/fieldRoster";
import { CatGlyph, Avatar, SlaMeter, Seg, SearchBox, StatusPill } from "./CommandKit";
import { windowFor } from "../../../store/slaPolicyStore";
import { nameFor } from "../../../store/profileStore";

/* ------------------------------------------------------------------
   Dispatch console. Picks a field operative for one issue from the
   live Staff Desk roster: right expertise first, then same zone, on
   duty, lightest load. People awaiting uplink or at capacity are
   shown but locked, with the reason. Picking someone with the wrong
   expertise is allowed but flagged: the button turns into
   "Dispatch anyway" and the audit line is tagged off-expertise.
   Changing the priority also changes the service window (from the
   Service Windows table); the footer shows the change before it's made.
------------------------------------------------------------------- */

function StaffAssignModal({ isOpen, onClose, issue, onAssign }) {
  const { roster } = useFieldRoster();
  const [query, setQuery] = useState("");
  const [staff, setStaff] = useState("");
  const [priority, setPriority] = useState("medium");
  const [scope, setScope] = useState("match");
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });

  const ranked = useMemo(() => rankCandidates(roster, issue), [roster, issue]);
  const best = ranked.find((c) => c.avail.ok && c.match) || null;

  useEffect(() => {
    if (!isOpen || !issue) return;
    setQuery("");
    setScope("match");
    setPriority(issue.priority || "medium");
    // reopening a wrong-skill assignment ("Fix") pre-selects the best right-skill match
    const current = ranked.find((c) => c.person.name === issue.assignedTo);
    setStaff(current && !current.match && best ? best.person.name : issue.assignedTo || best?.person.name || "");
    // only when a new issue opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, issue?.id]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => { if (e.key === "Escape") closeRef.current(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen || !issue) return null;

  const needle = query.trim().toLowerCase();
  const matchCount = ranked.filter((c) => c.match).length;
  const rows = ranked.filter((c) => {
    if (scope === "match" && !c.match) return false;
    if (!needle) return true;
    return [c.person.name, c.person.zone, c.person.rank, expertiseLabel(c.person.expertise)].join(" ").toLowerCase().includes(needle);
  });
  const chosen = ranked.find((c) => c.person.name === staff);
  const unchanged = staff === (issue.assignedTo || "") && priority === issue.priority;
  const owner = ranked.find((c) => c.person.name === issue.assignedTo);
  const ownerOff = Boolean(owner && !owner.match);
  const keep = staff === (issue.assignedTo || ""); // same owner: only the priority can change
  const off = Boolean(chosen && !chosen.match && !keep);
  // work in motion goes back to Acknowledged when the owner changes (see assignIssue)
  const restart = Boolean(chosen && !keep && issue.assignedTo && ["in_progress", "pending_review"].includes(issue.status));
  const needLabel = expertiseLabel(ranked[0]?.need);

  const confirm = () => {
    if (!chosen || !chosen.avail.ok) return;
    onAssign({ staffName: staff, priority, offExpertise: off, status: issue.status === "submitted" ? "acknowledged" : issue.status });
    onClose();
  };

  return (
    <div className="ac-veil" onClick={onClose}>
      <div className="ac-modal" role="dialog" aria-modal="true" aria-label="Dispatch" onClick={(e) => e.stopPropagation()}>
        <span className="ac-modal-scan" aria-hidden />
        <header className="ac-modal-head">
          <div>
            <p className="ac-crumb">DISPATCH <b>/</b> {issue.id}</p>
            <h3>{issue.assignedTo ? "Reassign field operative" : "Assign field operative"}</h3>
          </div>
          <button type="button" className="ac-x" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </header>

        <div className="ac-modal-issue">
          <CatGlyph category={issue.category} size={40} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <strong>{issue.title}</strong>
            <small>
              <MapPin size={11} /> {issue.ward} <span className="ac-dot">·</span> {CATEGORY_LABEL[issue.category] || issue.category}
              <span className="ac-dot">·</span> <StatusPill status={issue.status} />
            </small>
          </div>
          <SlaMeter issue={issue} compact />
        </div>

        <div className="ac-modal-need">
          <span className="ac-need-chip"><Radar size={12} /> Needs {needLabel}</span>
          {ownerOff ? <span className="ac-tag red"><AlertTriangle size={9} /> Now with {expertiseLabel(owner.person.expertise)}</span> : null}
          <Seg
            small
            label="Who to show"
            value={scope}
            onChange={setScope}
            options={[{ id: "match", label: "Right expertise", count: matchCount }, { id: "all", label: "Whole field", count: ranked.length }]}
          />
        </div>

        <div className="ac-modal-search">
          <SearchBox value={query} onChange={setQuery} placeholder="Search name, zone or rank" />
        </div>

        <div className="ac-cands">
          {!rows.length && (
            <div className="ac-empty">
              <span><Users size={20} /></span>
              <strong>{scope === "match" ? `No ${expertiseLabel(ranked[0]?.need)} crew on the field` : "No one matches"}</strong>
              <p>{scope === "match" ? "Switch to Whole field, or clear someone on the Staff Desk." : "Try another search."}</p>
            </div>
          )}
          {rows.map((c) => {
            const p = c.person;
            const pct = Math.min(100, Math.round((p.load / CAPACITY) * 100));
            const tone = pct >= 84 ? "hot" : pct >= 50 ? "mid" : "";
            const isBest = best && best.person.id === p.id;
            return (
              <button
                key={p.id}
                type="button"
                className={`ac-cand${c.match ? " match" : ""}${staff === p.name ? " on" : ""}`}
                disabled={!c.avail.ok}
                onClick={() => setStaff(p.name)}
                title={c.avail.ok ? undefined : c.avail.reason}
              >
                <Avatar name={nameFor(p.name)} size={40} tone={c.avail.code === "uplink" ? "amber" : "violet"} dot={c.avail.code === "uplink" ? undefined : p.onDuty} />
                <div style={{ minWidth: 0 }}>
                  <div className="ac-cand-name">
                    {nameFor(p.name)}
                    {isBest ? <span className="ac-tag best"><Sparkles size={10} /> Best match</span> : null}
                  </div>
                  <div className="ac-cand-sub">
                    <span>{p.rank}</span>
                    <span className={`ac-tag ${c.match ? "green" : ""}`}><Zap size={9} /> {expertiseLabel(p.expertise)}</span>
                    <span className={`ac-tag ${c.zone ? "violet" : ""}`}><MapPin size={9} /> {p.zone}</span>
                    {c.avail.code === "off" ? <span className="ac-tag amber">Off duty</span> : null}
                    {!c.avail.ok ? <span className={`ac-tag ${c.avail.code === "uplink" ? "amber" : "red"}`}><Lock size={9} /> {c.avail.reason}</span> : null}
                  </div>
                </div>
                <div className={`ac-load ${tone}`}>
                  <b>{p.load}/{CAPACITY}</b>
                  <span className="bar"><i style={{ width: `${Math.max(3, pct)}%` }} /></span>
                </div>
              </button>
            );
          })}
        </div>

        {off ? (
          <div className="ac-offwarn" role="alert">
            <AlertTriangle size={14} />
            <span><b>Off-expertise dispatch.</b> This issue needs {needLabel}. {chosen.person.name.split(" ")[0]} is {expertiseLabel(chosen.person.expertise)}. It will be flagged on the board and in the audit log.</span>
          </div>
        ) : null}

        {restart ? (
          <div className="ac-offwarn" role="note" style={{ color: "#5b21b6", background: "linear-gradient(135deg, #f5f3ff, #faf5ff)", borderColor: "rgba(124, 58, 237, .3)" }}>
            <CornerUpLeft size={14} style={{ color: "#7c3aed" }} />
            <span>
              {issue.status === "pending_review"
                ? <><b style={{ color: "#4c1d95" }}>{issue.assignedTo.split(" ")[0]}'s close request is withdrawn.</b> </>
                : null}
              The file goes back to Acknowledged so {chosen.person.name.split(" ")[0]} starts it fresh.
            </span>
          </div>
        ) : null}

        <footer className="ac-modal-foot">
          <div className="left">
            <span className="ac-sortlabel">Priority</span>
            <Seg small value={priority} onChange={setPriority} options={ISSUE_PRIORITIES.map((p) => ({ id: p, label: PRIORITY_LABEL[p] }))} />
            {priority !== issue.priority && issue.status !== "resolved" && windowFor(priority, issue.category) !== issue.slaHours ? (
              <span className="ac-sortread" title="The service window follows the priority (Service Windows), counted from the report time">
                <i />Window {issue.slaHours ? `${issue.slaHours}h` : "none"} → {windowFor(priority, issue.category)}h
              </span>
            ) : null}
          </div>
          <div className="left">
            <button type="button" className="ac-btn" onClick={onClose}>Cancel</button>
            <button type="button" className={`ac-btn ${off ? "anyway" : "primary"}`} onClick={confirm} disabled={!chosen || !chosen.avail.ok || unchanged}>
              {keep && chosen ? <Flame size={14} /> : off ? <AlertTriangle size={14} /> : <Send size={14} />}
              {!chosen
                ? "Pick someone"
                : keep
                  ? priority === issue.priority ? "No change" : `Set priority to ${PRIORITY_LABEL[priority]}`
                  : off ? `Dispatch anyway to ${chosen.person.name.split(" ")[0]}` : `Dispatch to ${chosen.person.name.split(" ")[0]}`}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default StaffAssignModal;