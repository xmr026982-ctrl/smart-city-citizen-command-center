import { useMemo, useState } from "react";
import {
  Hourglass, Siren, Gauge, Layers, ShieldAlert, Minus, Plus, RotateCcw, Save, Check, AlertTriangle, ScrollText,
  ArrowUpRight, Crosshair,
} from "lucide-react";
import IssueDetailsDrawer from "../../components/issues/shared/IssueDetailsDrawer";
import PolicyEventDrawer from "../../components/issues/admin/PolicyEventDrawer";
import LensWatch from "../../components/issues/admin/LensWatch";
import {
  Command, CommandHead, LensDeck, Panel, CatGlyph, PriorityPill, Empty, ago,
} from "../../components/issues/admin/CommandKit";
import { CATEGORY_LABEL, ISSUE_CATEGORIES } from "../../constants/issueCategories";
import { PRIORITY_LABEL } from "../../constants/issuePriorities";
import { useAuth } from "../../store/authStore";
import { logEvent, useAudit, useIssues } from "../../store/issueStore";
import {
  usePolicy, savePolicy, windowFor, policyProblems, policyDiff, HOUR_STEPS, DEFAULT_POLICY,
} from "../../store/slaPolicyStore";
import { useMinute } from "../../hooks/useMinute";
import { slaOf, span } from "../../utils/sla";
import "../../styles/service-windows.css";

/* ------------------------------------------------------------------
   Service Windows: command's deadline table. One window per priority,
   plus an optional ceiling per category for dangerous work. Edits are a
   draft until saved; the save bar shows exactly what changes, refuses a
   table where a higher priority gets more time than a lower one, and
   says how many running issues keep their current window (the table
   never rewrites windows already running). Every save is logged.
------------------------------------------------------------------- */

const PRIORITIES = ["critical", "high", "medium", "low"];
const MEANS = {
  critical: "Danger to life or property right now",
  high: "Serious disruption to a street or block",
  medium: "Real problem, no immediate danger",
  low: "Wear, upkeep and cosmetic issues",
};
const LABELS = { ...PRIORITY_LABEL, ...CATEGORY_LABEL };

// next stop up or down the hour ladder (snaps values that are off the ladder)
function step(hours, dir) {
  if (dir > 0) return HOUR_STEPS.find((h) => h > hours) ?? hours;
  return [...HOUR_STEPS].reverse().find((h) => h < hours) ?? hours;
}

function Stepper({ value, onChange, disabled = false, label }) {
  const lo = value <= HOUR_STEPS[0];
  const hi = value >= HOUR_STEPS[HOUR_STEPS.length - 1];
  return (
    <div className={`sw-step${disabled ? " off" : ""}`} role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(step(value, -1))} disabled={disabled || lo} aria-label={`Less time for ${label}`}><Minus size={13} /></button>
      <span key={value}><b>{span(value)}</b>{value >= 24 ? <em>{value}h</em> : null}</span>
      <button type="button" onClick={() => onChange(step(value, 1))} disabled={disabled || hi} aria-label={`More time for ${label}`}><Plus size={13} /></button>
    </div>
  );
}

function ServiceWindows() {
  const user = useAuth();
  const issues = useIssues();
  const audit = useAudit();
  const policy = usePolicy();
  const tick = useMinute();
  const [lens, setLens] = useState("open"); // open (home) | over | warn | fast | cell
  const [openId, setOpenId] = useState(null); // issue file
  const [logEvent_, setLogEvent] = useState(null); // change-log entry file
  const [cell, setCell] = useState(null); // { p, c } window-map cell lens
  const [draft, setDraft] = useState(policy);
  // the live table changed (another command desk saved, or a reconnect re-read it):
  // an untouched draft follows it; a draft being edited is kept, and its save bar
  // then shows the difference against the new table
  const [base, setBase] = useState(policy);
  if (policy !== base) {
    setBase(policy);
    if (policyDiff(base, draft).length === 0) setDraft(policy);
  }
  const [saved, setSaved] = useState("");

  const open = useMemo(() => issues.filter((i) => i.status !== "resolved"), [issues]);
  const stats = useMemo(() => {
    const states = open.map((i) => slaOf(i).state);
    return {
      open: open.length,
      over: states.filter((s) => s === "over").length,
      warn: states.filter((s) => s === "warn").length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tick]);

  // the shortest promise in the live table, and where it comes from
  const fastest = useMemo(() => {
    let best = { h: Infinity, label: "", p: null, c: null };
    PRIORITIES.forEach((p) => ISSUE_CATEGORIES.forEach((c) => {
      const h = windowFor(p, c, policy);
      if (h < best.h) best = { h, p, c, label: h < policy.priority[p] ? `${CATEGORY_LABEL[c]} ceiling` : PRIORITY_LABEL[p] };
    }));
    return best;
  }, [policy]);

  // the lens list: issues behind the tile (or the window-map cell) that is locked
  const watch = useMemo(() => {
    const rank = (i) => slaOf(i).left;
    let out = [];
    if (lens === "open") out = open;
    else if (lens === "over") out = open.filter((i) => slaOf(i).state === "over");
    else if (lens === "warn") out = open.filter((i) => slaOf(i).state === "warn");
    else if (lens === "fast") out = open.filter((i) => Number(i.slaHours) === fastest.h);
    else if (lens === "cell" && cell) out = open.filter((i) => i.priority === cell.p && i.category === cell.c);
    return [...out].sort((a, b) => rank(a) - rank(b));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lens, cell, open, fastest, tick]);

  const LENS = {
    open: { kicker: "Lens · open board", icon: Layers, title: "Every issue on a running window", empty: "The board is clear" },
    over: { kicker: "Lens · breached", icon: Siren, title: "Past their window, most late first", empty: "Nothing is late" },
    warn: { kicker: "Lens · at risk", icon: Gauge, title: "Under 30% of the window left", empty: "Nothing is close to its deadline" },
    fast: { kicker: "Lens · fastest window", icon: Hourglass, title: `On the ${span(fastest.h)} promise (${fastest.label})`, empty: `No open issue runs on ${span(fastest.h)}` },
    cell: { kicker: "Lens · window map", icon: Crosshair, title: cell ? `${PRIORITY_LABEL[cell.p]} · ${CATEGORY_LABEL[cell.c]} · ${span(windowFor(cell.p, cell.c, policy))}` : "", empty: "No open issue in this cell" },
  };


  const diff = policyDiff(policy, draft, LABELS);
  const problems = policyProblems(draft);
  const dirty = diff.length > 0;
  // running issues whose window would differ under the draft: they keep their current one
  const keep = useMemo(
    () => (dirty ? open.filter((i) => windowFor(i.priority, i.category, draft) !== i.slaHours).length : 0),
    [dirty, open, draft]
  );
  const history = useMemo(() => audit.filter((e) => e.kind === "priority" && /^Service windows changed/.test(e.action)).slice(0, 6), [audit]);

  const setPri = (k, v) => { setSaved(""); setDraft((d) => ({ ...d, priority: { ...d.priority, [k]: v } })); };
  const setCap = (k, v) => {
    setSaved("");
    setDraft((d) => {
      const ceilings = { ...d.ceilings };
      if (v === null) delete ceilings[k]; else ceilings[k] = v;
      return { ...d, ceilings };
    });
  };

  const save = () => {
    if (!dirty || problems.length) return;
    const res = savePolicy(draft);
    if (!res.ok) return;
    const done = `Saved · ${diff.length} change${diff.length === 1 ? "" : "s"}`;
    if (!res.saving) {
      // without the server, this browser keeps the log; with it, the server writes the audit entry
      logEvent({ actor: user?.name, role: "admin", action: `Service windows changed: ${diff.join(" · ")}`, kind: "priority", topic: "windows", changes: diff });
      setSaved(done);
      return;
    }
    setSaved("Saving…");
    res.saving.then((r) => setSaved(r.ok ? done : r.message));
  };
  const discard = () => { setDraft(policy); setSaved(""); };
  const defaults = () => { setDraft(DEFAULT_POLICY); setSaved(""); };
  const isDefault = policyDiff(DEFAULT_POLICY, draft).length === 0;

  return (
    <Command>
      <CommandHead crumb="SERVICE WINDOWS" title="Service Windows" sub="How long the city gives itself to fix an issue. Set a window for each priority, and cap dangerous categories. Windows already running keep their time.">
        {saved ? <span className="ac-live" style={{ color: "#047857" }}><Check size={12} /> {saved}</span> : null}
      </CommandHead>

      <LensDeck
        value={lens === "cell" ? "open" : lens}
        base="open"
        onChange={(v) => { setCell(null); setLens(v); }}
        readout={`${watch.length} issue${watch.length === 1 ? "" : "s"}`}
        tiles={[
          { id: "open", icon: Layers, label: "Open board", lens: "Everything running", value: stats.open, sub: "Issues on a running window", meter: 100 },
          { id: "over", icon: Siren, label: "Breached now", lens: "Breached", value: stats.over, sub: "Past their window", meter: stats.open ? (stats.over / stats.open) * 100 : 0, tone: stats.over ? "red" : "green" },
          { id: "warn", icon: Gauge, label: "At risk", lens: "At risk", value: stats.warn, sub: "Under 30% of the window left", meter: stats.open ? (stats.warn / stats.open) * 100 : 0, tone: "amber" },
          { id: "fast", icon: Hourglass, label: "Fastest window", lens: "Fastest window", value: span(fastest.h), sub: `${fastest.label} · shortest city promise`, meter: 100, tone: "cyan" },
        ]}
      />

      {lens !== "open" ? (
        <LensWatch
          kicker={LENS[lens].kicker}
          icon={LENS[lens].icon}
          title={LENS[lens].title}
          items={watch}
          empty={LENS[lens].empty}
          emptyIcon={Check}
          onOpen={setOpenId}
          more="open All Issues for the full ledger"
        />
      ) : null}

      <div className="ac-row-even">
        <Panel kicker="Priority windows" icon={Hourglass} title="Time to fix, by priority">
          <div className="sw-list">
            {PRIORITIES.map((k) => {
              const n = open.filter((i) => i.priority === k).length;
              const changed = draft.priority[k] !== policy.priority[k];
              return (
                <div key={k} className={`sw-row${changed ? " changed" : ""}${lens === "fast" && fastest.p === k && fastest.label === PRIORITY_LABEL[k] ? " fastest" : ""}`}>
                  <div className="sw-row-copy">
                    <PriorityPill priority={k} />
                    <p>{MEANS[k]}</p>
                    <small>{n} open issue{n === 1 ? "" : "s"} on this priority</small>
                  </div>
                  <Stepper value={draft.priority[k]} onChange={(v) => setPri(k, v)} label={PRIORITY_LABEL[k]} />
                </div>
              );
            })}
          </div>
          <ol className="sw-rules">
            <li><b>1</b>An issue's window is its priority's time, capped by its category ceiling.</li>
            <li><b>2</b>The clock runs from the moment the citizen reports it.</li>
            <li><b>3</b>A priority change recalculates the window from that same report time.</li>
            <li><b>4</b>Saving the table never changes a window that is already running.</li>
          </ol>
        </Panel>

        <Panel kicker="Category ceilings" icon={ShieldAlert} title="Caps for dangerous work">
          <p className="sw-help">A ceiling caps the window for a category, whatever its priority. Use it where waiting is dangerous.</p>
          <div className="sw-list">
            {ISSUE_CATEGORIES.map((k) => {
              const cap = draft.ceilings[k];
              const on = Boolean(cap);
              const capped = on ? PRIORITIES.filter((p) => draft.priority[p] > cap).length : 0;
              const changed = (draft.ceilings[k] || 0) !== (policy.ceilings[k] || 0);
              return (
                <div key={k} className={`sw-row cat${on ? "" : " idle"}${changed ? " changed" : ""}${lens === "fast" && fastest.c === k && fastest.label.endsWith("ceiling") ? " fastest" : ""}`}>
                  <div className="sw-row-copy">
                    <span className="sw-cat"><CatGlyph category={k} size={28} /><b>{CATEGORY_LABEL[k]}</b></span>
                    <small>{on ? (capped ? `Caps ${capped} priorit${capped === 1 ? "y" : "ies"} at ${span(cap)}` : "No priority runs longer, no effect now") : "No ceiling"}</small>
                  </div>
                  <div className="sw-cap">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={on}
                      aria-label={`${CATEGORY_LABEL[k]} ceiling`}
                      className={`sw-switch${on ? " on" : ""}`}
                      onClick={() => setCap(k, on ? null : Math.min(12, draft.priority.critical * 2))}
                    >
                      <i />
                    </button>
                    <Stepper value={cap || 12} onChange={(v) => setCap(k, v)} disabled={!on} label={`${CATEGORY_LABEL[k]} ceiling`} />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      <section className={`sw-bar${dirty ? " dirty" : ""}${problems.length ? " bad" : ""}`} aria-live="polite">
        <div className="sw-bar-copy">
          {problems.length ? (
            <>
              <strong><AlertTriangle size={14} /> This table can't be saved</strong>
              <ul>{problems.map((p) => <li key={p}>{p.charAt(0).toUpperCase() + p.slice(1)}.</li>)}</ul>
            </>
          ) : dirty ? (
            <>
              <strong>{diff.length} unsaved change{diff.length === 1 ? "" : "s"}</strong>
              <ul>{diff.map((d) => <li key={d}>{d}</li>)}</ul>
              <p>Applies to new reports and priority changes. {keep ? `${keep} open issue${keep === 1 ? "" : "s"} keep their current window.` : "No running window is affected."}</p>
            </>
          ) : (
            <>
              <strong>The table is live</strong>
              <p>Every new report and every priority change takes its window from here.</p>
            </>
          )}
        </div>
        <div className="sw-bar-acts">
          {!isDefault ? <button type="button" className="ac-btn sm ghost" onClick={defaults}><RotateCcw size={12} /> Defaults</button> : null}
          <button type="button" className="ac-btn" onClick={discard} disabled={!dirty}>Discard</button>
          <button type="button" className="ac-btn primary" onClick={save} disabled={!dirty || problems.length > 0}><Save size={14} /> Save changes</button>
        </div>
      </section>

      <div className="ac-row2">
        <Panel kicker="Window map" icon={Layers} title={dirty ? "What the draft gives each issue" : "What each issue gets"}>
          <div className="sw-map" role="table" aria-label="Window by priority and category">
            <div className="sw-map-row head" role="row">
              <span role="columnheader" />
              {ISSUE_CATEGORIES.map((c) => <span key={c} role="columnheader" title={CATEGORY_LABEL[c]}><CatGlyph category={c} size={24} /></span>)}
            </div>
            {PRIORITIES.map((p) => (
              <div key={p} className="sw-map-row" role="row">
                <span role="rowheader"><PriorityPill priority={p} /></span>
                {ISSUE_CATEGORIES.map((c) => {
                  const h = windowFor(p, c, draft);
                  const capped = h < draft.priority[p];
                  const changed = h !== windowFor(p, c, policy);
                  const n = open.filter((i) => i.priority === p && i.category === c).length;
                  const on = lens === "cell" && cell?.p === p && cell?.c === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      role="cell"
                      className={`${capped ? "cap" : ""}${changed ? " changed" : ""}${on ? " on" : ""}${n ? " live" : ""}`}
                      title={`${PRIORITY_LABEL[p]} · ${CATEGORY_LABEL[c]}: ${h}h${capped ? " (ceiling)" : ""} · ${n} open`}
                      onClick={() => { if (on) { setLens("open"); setCell(null); } else { setCell({ p, c }); setLens("cell"); } }}
                    >
                      {span(h)}
                      {n ? <em>{n}</em> : null}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="ac-legend">
            <span><i className="sw-key cap" />Capped by a ceiling</span>
            <span><i className="sw-key changed" />Changed in the draft</span>
            <span><i className="sw-key live" />Open issues (count in the corner) · click a cell</span>
          </div>
        </Panel>

        <Panel kicker="Change log" icon={ScrollText} title="Who changed the table">
          {!history.length ? (
            <Empty icon={ScrollText} title="No changes yet" sub="Every save is logged here and in the Audit Log." />
          ) : (
            <div className="ac-trace">
              {history.map((e) => (
                <button key={e.id} type="button" className="ac-trace-row k-priority sw-log" onClick={() => setLogEvent(e)} title="Open the change">
                  <span className="ac-trace-ic"><Hourglass size={14} /></span>
                  <div style={{ minWidth: 0 }}>
                    <p>{e.action.replace(/^Service windows changed: /, "")}</p>
                    <small>{e.actor}</small>
                  </div>
                  <span className="when">{ago(e.at)} <ArrowUpRight size={10} /></span>
                </button>
              ))}
            </div>
          )}
        </Panel>
      </div>
      <IssueDetailsDrawer issue={issues.find((i) => i.id === openId) || null} onClose={() => setOpenId(null)} />
      <PolicyEventDrawer event={logEvent_} onClose={() => setLogEvent(null)} />
    </Command>
  );
}

export default ServiceWindows;
