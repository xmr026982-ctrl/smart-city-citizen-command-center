import { useEffect, useMemo, useState } from "react";
import { Play, ShieldCheck, CheckCircle2, Crosshair, CornerUpLeft, LocateFixed, Check, AlertTriangle } from "lucide-react";
import { Command, LiveChip } from "../admin/CommandKit";
import { readFileParam } from "../../../utils/fileLink";
import { useAuth } from "../../../store/authStore";
import { useIssues, useAudit } from "../../../store/issueStore";
import { useFieldRoster, CAPACITY } from "../../../store/fieldRoster";
import { useMinute } from "../../../hooks/useMinute";
import { fieldMoves, startWork } from "../../../services/issueService";
import "../../../styles/field-command.css";

/* ------------------------------------------------------------------
   Field kit: the parts every staff Issue Management page shares.
   Pages are built from the admin Command kit (same layout, motion and
   controls) inside <Field>, which turns the whole desk teal.
------------------------------------------------------------------- */

export const FIELD_FROM = {
  "/staff/operations": "Operations",
  "/staff/assigned": "Assigned Work",
  "/staff/queue": "City Intake",
  "/staff/performance": "Field Load",
};

/* the field user, their roster record (rank, expertise, zone, duty) and their issues */

export function useFieldDesk() {
  const user = useAuth();
  const issues = useIssues();
  const audit = useAudit();
  const { roster } = useFieldRoster();
  const tick = useMinute();

  const name = user?.displayName || user?.name || "";

  // serverId is the backend MongoDB user ID.
  const staffIds = useMemo(
    () =>
      [user?.serverId, user?._id, user?.id]
        .filter(Boolean)
        .map(String),
    [user?.serverId, user?._id, user?.id]
  );

  const me = useMemo(
    () => roster.find((p) => p.name === name) || null,
    [roster, name]
  );

  const mine = useMemo(
    () =>
      issues.filter((issue) => {
        // Prefer stable account IDs whenever the backend provides one.
        if (issue.assignedToId) {
          return staffIds.includes(String(issue.assignedToId));
        }

        // Compatibility fallback for older/local issues without an ID.
        return Boolean(
          name &&
          String(issue.assignedTo || "").trim().toLowerCase() ===
            name.trim().toLowerCase()
        );
      }),
    [issues, staffIds, name]
  );

  return { user, issues, audit, roster, me, mine, tick };
}

export function Field({ children }) {
  return <Command className="fld">{children}</Command>;
}

export function FieldHead({ crumb, title, sub, me, tick, children }) {
  return (
    <header className="ac-head">
      <div>
        <h1>{title}</h1>
        {sub ? <p className="ac-sub">{sub}</p> : null}
      </div>
      <div className="ac-head-tools">
        {children}
      </div>
    </header>
  );
}

/* a short confirmation line in the head after a move ("ISS-2411 started") */
export function useFlash(ms = 2600) {
  const [flash, setFlash] = useState(null);
  useEffect(() => {
    if (!flash) return undefined;
    const t = setTimeout(() => setFlash(null), ms);
    return () => clearTimeout(t);
  }, [flash, ms]);
  return [flash, setFlash];
}

export function FlashChip({ flash, fallback = "" }) {
  if (!flash) return fallback ? <LiveChip label={fallback} /> : null;
  return (
    <span className="ac-live" style={{ color: flash.tone === "warn" ? "#b45309" : "#047857" }}>
      {flash.tone === "warn" ? <AlertTriangle size={12} /> : <Check size={12} />} {flash.text}
    </span>
  );
}

/* The move a field operative can make on an issue, as buttons.
   Start happens at once. Request close and Recall open their gate door
   (a note or a reason is required), via onRequestClose / onWithdraw. */
export function FieldMoves({ issue, user, onRequestClose, onWithdraw, onMoved, glow = false, compact = false }) {
  const can = fieldMoves(issue, user);
  const run = (fn, text) => {
    const res = fn(issue.id, user);
    onMoved?.(res.ok ? { id: issue.id, text } : { id: issue.id, text: res.reason, tone: "warn" });
  };
  if (can.done) return <span className="fc-done"><CheckCircle2 size={12} /> Closed</span>;
  if (!can.mine) return null;
  if (can.start) {
    return (
      <button type="button" className={`ac-btn sm primary${glow ? " glow" : ""}`} onClick={() => run(startWork, `${issue.id} started · on site`)}>
        <Play size={12} /> Start work
      </button>
    );
  }
  if (can.requestClose) {
    return (
      <button type="button" className={`ac-btn sm fc-close${glow ? " glow" : ""}`} onClick={() => onRequestClose?.(issue.id)}>
        <ShieldCheck size={12} /> Request close
      </button>
    );
  }
  if (can.withdraw) {
    return (
      <>
        <span className="fc-wait"><i />{compact ? "With command" : "Waiting on command"}</span>
        <button type="button" className={`ac-btn sm ghost${glow ? " glow" : ""}`} title="Take the close request back, with a reason, and keep working" onClick={() => onWithdraw?.(issue.id)}>
          <CornerUpLeft size={12} /> Recall
        </button>
      </>
    );
  }
  return null;
}

/* Target bar: names the locked issue and what can be done with it. */
export function TargetBar({ target, issue, user, onPage, onRequestClose, onWithdraw, onMoved, onRelocate, onBack, onRelease }) {
  const done = target.done;
  return (
    <div className={`ac-targetbar${done ? " done" : ""}`} role="status" key={target.at}>
      <span className="ac-targetbar-ic">{done ? <CheckCircle2 size={15} /> : <Crosshair size={15} />}</span>
      <span className="ac-targetbar-copy">
        <em>{done ? "Moved" : "Target locked"}</em>
        <b>{issue.id}</b>
        <span>{issue.title}{done ? <strong style={{ color: "#047857", fontWeight: 650 }}> · {done}</strong> : null}</span>
      </span>
      <span className="ac-targetbar-acts">
        {!done && !onPage ? (
          <button type="button" className="ac-btn sm" onClick={onRelocate}><LocateFixed size={12} /> Relocate</button>
        ) : null}
        {!done ? <FieldMoves issue={issue} user={user} onRequestClose={onRequestClose} onWithdraw={onWithdraw} onMoved={onMoved} /> : null}
        {target.from ? (
          <button type="button" className="ac-btn sm" onClick={onBack}><CornerUpLeft size={12} /> Back to {FIELD_FROM[target.from] || "previous page"}</button>
        ) : null}
        <button type="button" className="ac-btn sm ghost" onClick={onRelease}>Release <kbd>Esc</kbd></button>
      </span>
    </div>
  );
}

/* Capacity reactor: tick ring lit by open files out of CAPACITY. */
const TICKS = 48;
const RING = 2 * Math.PI * 52;
export function LoadReactor({ load, label = "Capacity used" }) {
  const util = Math.min(100, Math.round((load / CAPACITY) * 100));
  const lit = Math.round((util / 100) * TICKS);
  const heat = util >= 84 ? " hot" : util >= 60 ? " warm" : "";
  return (
    <div className={`ac-reactor${heat}`} title={`${load} of ${CAPACITY} open slots in use`}>
      <svg viewBox="0 0 140 140" aria-hidden="true">
        <defs>
          <linearGradient id="fcReactorGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" style={{ stopColor: "var(--rc)" }} />
            <stop offset="100%" style={{ stopColor: "var(--rc2)" }} />
          </linearGradient>
        </defs>
        <g className="ticks">
          {Array.from({ length: TICKS }, (_, i) => {
            const a = (i / TICKS) * Math.PI * 2 - Math.PI / 2;
            const r2 = i % 4 === 0 ? 69 : 66;
            return (
              <line
                key={i}
                x1={70 + 61 * Math.cos(a)} y1={70 + 61 * Math.sin(a)}
                x2={70 + r2 * Math.cos(a)} y2={70 + r2 * Math.sin(a)}
                className={i < lit ? "on" : ""}
                style={i < lit ? { animationDelay: `${i * 16}ms` } : undefined}
              />
            );
          })}
        </g>
        <circle className="track" cx="70" cy="70" r="52" />
        <circle className="arc" cx="70" cy="70" r="52" style={{ stroke: "url(#fcReactorGrad)" }} strokeDasharray={`${(util / 100) * RING} ${RING}`} transform="rotate(-90 70 70)" />
        <circle className="orbit" cx="70" cy="70" r="43" />
      </svg>
      <div className="core">
        <strong>{load}<small>/{CAPACITY}</small></strong>
        <em>{label}</em>
      </div>
    </div>
  );
}

/* Target lock shared by the field list pages: arrival with { target, from } in
   the route state, lens + page jump, glide to the row, Enter / Esc, auto release
   once the issue moved. Same rules as the Reassign lock on Assign Issues. */
export function useTargetLock({ location, navigate, issues, focus, onMiss }) {
  const [target, setTarget] = useState(null); // { id, from, at, base, done? }

  useEffect(() => {
    // ?file=ISS-… (utils/fileLink.js) locks on the same way as a { target } hand-off
    const file = readFileParam(location.search);
    const st = file ? { target: file.id, from: file.from } : location.state;
    if (!st?.target) return;
    navigate(location.pathname, { replace: true, state: null });
    const issue = issues.find((i) => i.id === st.target);
    if (!issue) { onMiss?.(st.target); return; } // closed or not on the list: open the file without a lock
    focus(issue);
    setTarget({ id: issue.id, from: st.from && st.from !== location.pathname ? st.from : null, at: Date.now(), base: issue.status });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  // the issue moved since the lock: say what happened, then let go
  const current = target ? issues.find((i) => i.id === target.id) : null;
  const moved = target && current && current.status !== target.base;
  useEffect(() => {
    if (!moved || target.done) return;
    const text = { in_progress: target.base === "pending_review" ? "back in progress" : "started · on site", pending_review: "close requested · waiting on command", resolved: "closed by command", acknowledged: "back to Acknowledged" }[current.status] || "moved";
    setTarget((t) => (t ? { ...t, done: text } : t));
  }, [moved, current?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!target?.done) return undefined;
    const t = setTimeout(() => setTarget(null), 6000);
    return () => clearTimeout(t);
  }, [target]);

  // the issue left this desk (reassigned away, removed): drop the lock
  useEffect(() => {
    if (target && !current) setTarget(null);
  }, [target, current]);

  return [target, setTarget, current];
}
