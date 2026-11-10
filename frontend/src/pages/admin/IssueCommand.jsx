import { useEffect, useMemo, useRef, useState } from "react";
import { setTopTag } from "../../store/topbarContext";
import { useMinute } from "../../hooks/useMinute";
import { Link, useNavigate } from "react-router-dom";
import {
  Layers, Send, Siren, ShieldCheck, CheckCircle2, ArrowRight, Radar, Users, Activity,
  MapPinned, Gauge, ClipboardCheck, FileText, Shield, UserCog, Inbox, Flame,
  Zap, MapPin, Check, Hourglass, Ban, MessageSquareWarning,
} from "lucide-react";
import IssueDetailsDrawer from "../../components/issues/shared/IssueDetailsDrawer";
import StaffAssignModal from "../../components/issues/admin/StaffAssignModal";
import LensWatch from "../../components/issues/admin/LensWatch";
import PolicyEventDrawer, { isPolicyEvent } from "../../components/issues/admin/PolicyEventDrawer";
import {
  Command, CommandHead, LensDeck, Panel, CatGlyph, PriorityPill, SlaMeter, Avatar, Empty, ago,
} from "../../components/issues/admin/CommandKit";
import { WARDS } from "../../constants/issueConstants";
import { useAuth } from "../../store/authStore";
import { setPriority, useAudit, useIssues, useAllIssues, openRequest, possibleDuplicates } from "../../store/issueStore";
import { RequestCard } from "../../components/issues/shared/RemovalKit";
import { useReceipts, dispatchWithReceipt, DispatchReceipt } from "../../components/issues/shared/DispatchKit";
import { useFieldRoster, bestFor, mismatchOf, CAPACITY } from "../../store/fieldRoster";
import { isAwaiting, uplinkPhase } from "../../store/staffDeskStore";
import { slaOf, urgencyCompare } from "../../utils/sla";
import "../../styles/issue-command-x.css";
import { nameFor, namesIn, useNames } from "../../store/profileStore";

/* ------------------------------------------------------------------
   Issue Command: the admin hub. What needs a decision right now.
   Tiles (lens deck) → zone lens (focuses the whole board on one zone)
   → dispatch queue beside the decision queue and SLA watch
   → field force beside the command trace.
------------------------------------------------------------------- */

const KIND_ICON = { filed: FileText, dispatch: Send, status: Activity, priority: Flame, desk: UserCog, request: MessageSquareWarning, removal: Ban };

// when an issue was confirmed closed (not its last update: a note on a closed file moves updatedAt)
const closedAt = (issue) => [...(issue.timeline || [])].reverse().find((t) => t.status === "resolved")?.at || issue.updatedAt;

/* seconds tick, only while something on screen needs it (live SLA countdowns) */
function useSecond(on) {
  const [t, setT] = useState(() => Date.now());
  useEffect(() => {
    if (!on) return undefined;
    const id = setInterval(() => setT(Date.now()), 1000);
    return () => clearInterval(id);
  }, [on]);
  return t;
}

// "1h 04m 09s" for a window that is close to running out
function clockLeft(hours) {
  const s = Math.max(0, Math.floor(hours * 3600));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return d ? `${d}d ${pad(h)}h ${pad(m)}m` : `${h}h ${pad(m)}m ${pad(sec)}s`;
}

function LiveWindow({ issue }) {
  const sla = slaOf(issue);
  if (sla.state === "over") return <span className="icx-clock over" title={`Service window ${sla.total}h`}><Siren size={11} /><b>{sla.label}</b></span>;
  if (sla.state === "warn") return <span className="icx-clock warn" title={`Service window ${sla.total}h`}><Hourglass size={11} /><b>{clockLeft(sla.left)}</b><em>left</em></span>;
  return <SlaMeter issue={issue} compact />;
}

const DISPATCH_MAX = 5;

// queue rows with each fresh receipt back at the place its issue held
function queueRows(list, receipts, order) {
  const rows = list.map((issue) => ({ issue }));
  receipts.forEach((r) => {
    const at = order.find((o) => o.id === r.id)?.idx ?? 0;
    rows.splice(Math.min(Math.max(0, at), rows.length), 0, { receipt: r });
  });
  return rows;
}
const WATCH_MAX = 5;
const GATE_MAX = 2;

function IssueCommand() {
  useNames(); // names follow each person's current display name
  const user = useAuth();
  const navigate = useNavigate();
  const issues = useIssues();
  const everything = useAllIssues(); // disputes sit on dismissed issues, off the board
  const audit = useAudit();
  const { roster, requests } = useFieldRoster();
  const tick = useMinute(); // keeps windows, breach counts and zone heat live
  const [selectedId, setSelectedId] = useState(null);
  const [policyEvent, setPolicyEvent] = useState(null);
  const [dispatchId, setDispatchId] = useState(null);
  const [flash, setFlash] = useState(null);
  const [zone, setZone] = useState(() => (WARDS.some((w) => w.name === window.history.state?.usr?.zone) ? window.history.state.usr.zone : null)); // page-wide zone lens
  useEffect(() => {
    if (!flash) return undefined;
    const t = setTimeout(() => setFlash(null), 2600);
    return () => clearTimeout(t);
  }, [flash]);

  // the zone lens shows in the top bar ("Issue Command · Shyambazar")
  useEffect(() => { setTopTag(zone); }, [zone]);
  useEffect(() => () => setTopTag(null), []);

  // Esc also releases the zone lens (the tile lens handles its own Esc)
  useEffect(() => {
    if (!zone) return undefined;
    const onKey = (e) => {
      if (e.key !== "Escape" || document.querySelector("[aria-modal='true']")) return;
      setZone(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zone]);

  const selected = everything.find((i) => i.id === selectedId) || null;
  // citizen and field requests waiting on command (withdraw, dispute, flag as invalid)
  const asks = useMemo(
    () => everything.filter((i) => openRequest(i) && (!zone || i.ward === zone)).sort((a, b) => new Date(openRequest(a).at) - new Date(openRequest(b).at)),
    [everything, zone]
  );
  const dispatching = issues.find((i) => i.id === dispatchId) || null;

  // the zone strip always reads the whole city; everything else reads the zone in focus
  const cityOpen = useMemo(() => issues.filter((i) => i.status !== "resolved"), [issues]);
  const scope = useMemo(() => (zone ? issues.filter((i) => i.ward === zone) : issues), [issues, zone]);

  const board = useMemo(() => {
    const open = scope.filter((i) => i.status !== "resolved");
    const unassigned = open.filter((i) => !i.assignedTo).sort(urgencyCompare);
    const breached = open.filter((i) => slaOf(i).state === "over");
    const atRisk = open.filter((i) => ["over", "warn"].includes(slaOf(i).state)).sort(urgencyCompare);
    const gate = open.filter((i) => i.status === "pending_review").sort(urgencyCompare);
    const resolved = scope.filter((i) => i.status === "resolved");
    const week = resolved.filter((i) => (Date.now() - new Date(closedAt(i))) / 864e5 <= 7);
    return { open, unassigned, breached, atRisk, gate, resolved, week };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, tick]);

  const zones = useMemo(() => {
    const rows = WARDS.map((w) => {
      const open = cityOpen.filter((i) => i.ward === w.name);
      const over = open.filter((i) => slaOf(i).state === "over").length;
      const crew = roster.filter((p) => p.zone === w.name && !isAwaiting(p) && p.onDuty).length;
      return { name: w.name, open: open.length, over, crew };
    });
    const max = Math.max(1, ...rows.map((r) => r.open + r.over * 2));
    return rows.map((r) => ({ ...r, heat: (r.open + r.over * 2) / max }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityOpen, roster, tick]);
  const hottest = zones.reduce((a, b) => (b.over > a.over || (b.over === a.over && b.heat > a.heat) ? b : a), zones[0]);

  const force = useMemo(() => {
    const live = roster.filter((p) => !isAwaiting(p));
    const awaiting = roster.filter(isAwaiting);
    const stalled = awaiting.filter((p) => ["stalled", "failed"].includes(uplinkPhase(p))).length;
    const onDuty = live.filter((p) => p.onDuty);
    const load = live.reduce((s, p) => s + p.load, 0);
    const cap = live.length * CAPACITY;
    return { roster: roster.length, live: live.length, awaiting: awaiting.length, stalled, onDuty: onDuty.length, load, cap, util: cap ? Math.round((load / cap) * 100) : 0 };
  }, [roster]);

  // the watch list counts down to the second while anything in it is close to its window
  // the side column shares its height with the dispatch queue: fewer watch rows while requests wait
  const waiting = board.gate.length + asks.length;
  const watchMax = waiting ? WATCH_MAX - 2 : WATCH_MAX;
  const watch = board.atRisk.slice(0, watchMax);
  useSecond(watch.some((i) => slaOf(i).state === "warn"));

  // command trace: rows that arrive after the page opened slide in
  const seen = useRef(null);
  const trace = audit.slice(0, 6);
  if (seen.current === null) seen.current = new Set(trace.map((e) => e.id));
  const fresh = trace.filter((e) => !seen.current.has(e.id)).map((e) => e.id);
  useEffect(() => { trace.forEach((e) => seen.current.add(e.id)); });

  const openTrace = (e) => {
    if (isPolicyEvent(e)) setPolicyEvent(e);
    else if (e.issueId) setSelectedId(e.issueId);
    else if (e.subject?.id) navigate("/admin/staff-desk", { state: { target: e.subject.id, from: "/admin/command" } });
    else navigate("/admin/audit");
  };

  const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);

  // tile lenses: the hub stays home; any other tile lists the issues behind it
  const [lens, setLens] = useState("open");
  const lensItems = lens === "dispatch" ? board.unassigned
    : lens === "breached" ? [...board.breached].sort(urgencyCompare)
      : lens === "gate" ? board.gate
        : lens === "week" ? [...board.week].sort((a, b) => new Date(closedAt(b)) - new Date(closedAt(a)))
          : board.open;
  const where = zone ? ` · ${zone}` : "";
  const LENS_COPY = {
    open: { kicker: "Lens", icon: Layers, title: "", empty: "" },
    dispatch: { kicker: `Lens · awaiting dispatch${where}`, icon: Inbox, title: "No crew yet, most urgent first", empty: "Every open issue has a crew" },
    breached: { kicker: `Lens · window breached${where}`, icon: Siren, title: "Past their service window, most overdue first", empty: "Nothing is past its window" },
    gate: { kicker: `Lens · close requests${where}`, icon: ShieldCheck, title: "Field asked to close · confirm or send back", empty: "No close request is waiting" },
    week: { kicker: `Lens · resolved this week${where}`, icon: CheckCircle2, title: "Confirmed closed in the last 7 days", empty: "Nothing closed this week yet" },
  };

  // dispatch: the row turns into a receipt in place, with an Undo notice
  const [receipts, addReceipt] = useReceipts();
  const queueOrder = useRef([]);
  const send = (issue, to, note = "") => {
    const idx = board.unassigned.findIndex((i) => i.id === issue.id);
    queueOrder.current = [...queueOrder.current.filter((q) => q.id !== issue.id), { id: issue.id, idx }];
    return dispatchWithReceipt({ issue, to, user, note, roster, cap: CAPACITY, onReceipt: addReceipt });
  };

  const handleAssign = ({ staffName, priority, offExpertise }) => {
    if (!dispatching) return;
    const moved = staffName !== dispatching.assignedTo;
    if (moved) send(dispatching, staffName, offExpertise ? "off-expertise" : "");
    if (priority && priority !== dispatching.priority) setPriority(dispatching.id, priority, user.name, user.role);
    if (!moved) setFlash(`${dispatching.id} priority updated`);
  };

  const quickDispatch = (issue) => {
    const pick = bestFor(roster, issue);
    if (!pick) { setDispatchId(issue.id); return; }
    send(issue, pick.person.name);
  };

  const queueMore = board.unassigned.length - DISPATCH_MAX;
  const watchMore = board.atRisk.length - watchMax;

  return (
    <Command>
      <CommandHead crumb="ISSUE COMMAND" title="Issue Command" sub="What needs a decision now: dispatch, service windows, close requests and field strength across Kolkata.">
        {flash ? <span className="ac-live" style={{ color: "#047857" }}><Check size={12} /> {flash}</span> : null}
      </CommandHead>

      <LensDeck
        value={lens}
        base="open"
        onChange={setLens}
        readout={`${lensItems.length} issue${lensItems.length === 1 ? "" : "s"}`}
        tiles={[
          { id: "open", icon: Layers, label: "Open board", lens: "Command hub", value: board.open.length, sub: zone ? `${scope.length} on record in ${zone}` : `${issues.length} on record`, meter: pct(board.open.length, scope.length) },
          { id: "dispatch", icon: Inbox, label: "Awaiting dispatch", lens: "Awaiting dispatch", value: board.unassigned.length, sub: board.unassigned.length ? "No crew yet" : "Every issue has a crew", meter: pct(board.unassigned.length, board.open.length), tone: board.unassigned.length ? "amber" : "green" },
          { id: "breached", icon: Siren, label: "Window breached", lens: "Window breached", value: board.breached.length, sub: `${board.atRisk.length - board.breached.length} more at risk`, meter: pct(board.breached.length, board.open.length), tone: board.breached.length ? "red" : "green" },
          { id: "gate", icon: ShieldCheck, label: "Close requests", lens: "Close requests", value: board.gate.length, sub: "Field asked to close", meter: pct(board.gate.length, board.open.length), tone: "cyan" },
          { id: "week", icon: CheckCircle2, label: "Resolved · 7 days", lens: "Resolved this week", value: board.week.length, sub: `${board.resolved.length} resolved in total`, meter: pct(board.resolved.length, scope.length), tone: "green" },
        ]}
      />

      <section className={`icx-zones${zone ? " focused" : ""}`} aria-label="Zone lens">
        <header>
          <p className="ac-kicker"><MapPinned size={12} /> Zone lens</p>
          {zone ? (
            <button type="button" className="icx-zone-release" onClick={() => setZone(null)}>
              <i /> Showing <b>{zone}</b><span className="sep" />{board.open.length} open<span className="sep" />Clear <kbd>Esc</kbd>
            </button>
          ) : (
            <span className="icx-zone-hint">Pick a zone to focus the whole board</span>
          )}
        </header>
        <div className="icx-zone-row">
          {zones.map((z) => (
            <button
              key={z.name}
              type="button"
              aria-pressed={zone === z.name}
              className={`icx-zone${zone === z.name ? " on" : ""}${zone && zone !== z.name ? " dim" : ""}${z.over && hottest && z.name === hottest.name ? " hot" : ""}`}
              style={{ "--heat": z.heat.toFixed(2) }}
              onClick={() => setZone((cur) => (cur === z.name ? null : z.name))}
            >
              <span className="icx-zone-top"><b>{z.name}</b><strong>{z.open}</strong></span>
              <small>{z.over ? <span className="hot">{z.over} breached</span> : <span className="calm">On track</span>}<span className="dot">·</span>{z.crew} crew</small>
              <span className="heat"><i style={{ width: `${Math.max(6, z.heat * 100)}%` }} /></span>
            </button>
          ))}
        </div>
      </section>

      {lens !== "open" ? (
        <LensWatch
          kicker={LENS_COPY[lens].kicker}
          icon={LENS_COPY[lens].icon}
          title={LENS_COPY[lens].title}
          items={lensItems}
          empty={LENS_COPY[lens].empty}
          emptyIcon={Check}
          onOpen={setSelectedId}
          side={lens === "week" ? (i) => `closed ${ago(closedAt(i))}` : lens === "dispatch" ? (i) => ago(i.createdAt) : undefined}
          more="open All Issues for the full ledger"
        />
      ) : null}

      <div className="icx-main">
        <Panel
          className="icx-dispatch"
          kicker="Dispatch queue"
          icon={Send}
          title={board.unassigned.length ? `${board.unassigned.length} issue${board.unassigned.length === 1 ? "" : "s"} need${board.unassigned.length === 1 ? "s" : ""} a crew` : "Queue clear"}
          action={<Link to="/admin/assignments" className="ac-link">Open dispatch <ArrowRight size={13} /></Link>}
        >
          {!board.unassigned.length && !receipts.length ? (
            <Empty icon={CheckCircle2} title="All clear" sub={zone ? `Every open issue in ${zone} has a crew.` : "New reports land here first."} />
          ) : (
            <div className="ac-mini icx-queue">
              {queueRows(board.unassigned.slice(0, DISPATCH_MAX), receipts, queueOrder.current).map((row) => {
                if (row.receipt) return <DispatchReceipt key={row.receipt.key} receipt={row.receipt} />;
                const issue = row.issue;
                const pick = bestFor(roster, issue);
                return (
                  <div key={issue.id} className="ac-mini-row icx-qrow" role="button" tabIndex={0} onClick={() => setSelectedId(issue.id)} onKeyDown={(e) => e.key === "Enter" && setSelectedId(issue.id)}>
                    <CatGlyph category={issue.category} size={32} />
                    <div style={{ minWidth: 0 }}>
                      <strong>{issue.title}</strong>
                      <small>
                        <span className="ac-id">{issue.id}</span><span className="ac-dot">·</span><MapPin size={10} /> {issue.ward}
                        <PriorityPill priority={issue.priority} />
                        {possibleDuplicates(issue, issues).length ? <span className="ac-tag amber" title={`Same category, ${possibleDuplicates(issue, issues)[0].m} m from ${possibleDuplicates(issue, issues)[0].issue.id}`}>Possible duplicate</span> : null}
                        {pick ? <span className="ac-suggest"><Zap size={10} /> {nameFor(pick.person.name)} · {pick.person.load}/{CAPACITY}</span> : <span className="ac-suggest none">No free match</span>}
                      </small>
                    </div>
                    <div className="ac-mini-side">
                      <LiveWindow issue={issue} />
                      <button
                        type="button"
                        className="ac-btn sm primary"
                        onClick={(e) => { e.stopPropagation(); quickDispatch(issue); }}
                        title={pick ? `Dispatch to ${nameFor(pick.person.name)}` : "Pick a crew"}
                      >
                        <Send size={12} /> {pick ? "Dispatch" : "Pick"}
                      </button>
                    </div>
                  </div>
                );
              })}
              {queueMore > 0 ? (
                <Link to="/admin/assignments" className="icx-more">+{queueMore} more in queue <ArrowRight size={12} /></Link>
              ) : null}
            </div>
          )}
        </Panel>

        <div className="icx-side">
          <Panel
            className={`icx-decide${board.gate.length || asks.length ? "" : " idle"}`}
            kicker="Decision queue"
            icon={ClipboardCheck}
            title={board.gate.length || asks.length ? "Awaiting your decision" : "Nothing awaiting you"}
            action={board.gate.length + asks.length ? <span className="icx-count">{board.gate.length + asks.length}</span> : null}
          >
            {board.gate.length || asks.length ? (
              <div className="ac-mini">
                {asks.slice(0, GATE_MAX).map((issue) => <RequestCard key={issue.id} issue={issue} user={user} onOpen={setSelectedId} />)}
                {asks.length > GATE_MAX ? <p className="icx-idle-line">+{asks.length - GATE_MAX} more requests · open each file to decide</p> : null}
                {board.gate.slice(0, Math.max(0, GATE_MAX - Math.min(asks.length, GATE_MAX))).map((issue) => (
                  <button key={issue.id} type="button" className="ac-mini-row" onClick={() => setSelectedId(issue.id)}>
                    <Avatar name={issue.assignedTo} size={30} />
                    <div style={{ minWidth: 0 }}>
                      <strong>{issue.title}</strong>
                      <small><span className="ac-id">{issue.id}</span><span className="ac-dot">·</span>{nameFor(issue.assignedTo)} asked to close {ago(issue.updatedAt)}</small>
                    </div>
                    <span className="ac-btn sm"><Shield size={12} /> Review</span>
                  </button>
                ))}
                {board.gate.length > GATE_MAX ? <button type="button" className="icx-more" onClick={() => setLens("gate")}>+{board.gate.length - GATE_MAX} more requests <ArrowRight size={12} /></button> : null}
              </div>
            ) : (
              <p className="icx-idle-line"><ShieldCheck size={13} /> Close requests and citizen requests land here.</p>
            )}
          </Panel>

          <Panel className="icx-watch" kicker="SLA watch" icon={Siren} title={board.atRisk.length ? "Overdue and at risk" : "All windows healthy"} action={<Link to="/admin/queue" state={zone ? { ward: zone } : undefined} className="ac-link">Ledger <ArrowRight size={13} /></Link>}>
            {!board.atRisk.length ? (
              <Empty icon={Gauge} title="All clear" sub="Issues appear here when under 30% of their window is left." />
            ) : (
              <div className="ac-mini">
                {watch.map((issue) => (
                  <button key={issue.id} type="button" className={`ac-mini-row icx-wrow ${slaOf(issue).state}`} onClick={() => setSelectedId(issue.id)}>
                    <CatGlyph category={issue.category} size={30} />
                    <div style={{ minWidth: 0 }}>
                      <strong>{issue.title}</strong>
                      <small>
                        <span className="ac-id">{issue.id}</span><span className="ac-dot">·</span>
                        {issue.assignedTo ? <>{nameFor(issue.assignedTo)}</> : <span style={{ color: "#b45309", fontWeight: 600 }}>No crew</span>}
                        {mismatchOf(issue, roster) ? <span className="ac-tag red">Off-expertise</span> : null}
                      </small>
                    </div>
                    <LiveWindow issue={issue} />
                  </button>
                ))}
                {watchMore > 0 ? <button type="button" className="icx-more" onClick={() => setLens("breached")}>+{watchMore} more on watch <ArrowRight size={12} /></button> : null}
              </div>
            )}
          </Panel>
        </div>
      </div>

      <div className="icx-lower">
        <Panel className="icx-force" kicker="Field force" icon={Users} title={`${force.live} uplinked · ${force.onDuty} on duty`} action={<Link to="/admin/staff-desk" className="ac-link">Staff Desk <ArrowRight size={13} /></Link>}>
          <ForceReactor force={force} requests={requests.length} />
        </Panel>

        <Panel className="icx-trace" kicker="Command trace" icon={Radar} title="Latest actions" action={<Link to="/admin/audit" className="ac-link">Full log <ArrowRight size={13} /></Link>}>
          <div className="ac-trace">
            {trace.map((e) => {
              const Icon = isPolicyEvent(e) ? Hourglass : KIND_ICON[e.kind] || Activity;
              return (
                <button key={e.id} type="button" className={`ac-trace-row icx-trow k-${e.kind || "status"}${fresh.includes(e.id) ? " fresh" : ""}`} onClick={() => openTrace(e)}>
                  <span className="ac-trace-ic"><Icon size={14} /></span>
                  <div style={{ minWidth: 0 }}>
                    <p>{namesIn(e.action)}</p>
                    <small>{nameFor(e.actor)} · {e.role}</small>
                  </div>
                  <span className="when">{ago(e.at)}<ArrowRight size={11} className="go" /></span>
                </button>
              );
            })}
          </div>
        </Panel>
      </div>

      <IssueDetailsDrawer issue={selected} onClose={() => setSelectedId(null)} />
      <PolicyEventDrawer event={policyEvent} onClose={() => setPolicyEvent(null)} />
      <StaffAssignModal isOpen={Boolean(dispatching)} issue={dispatching} onClose={() => setDispatchId(null)} onAssign={handleAssign} />
    </Command>
  );
}

/* Field force reactor: tick ring lit by capacity used, a live readout,
   one split bar for the whole roster, and a stalled-uplink alert. */
const TICKS = 48;
const C = 2 * Math.PI * 52;

function ForceReactor({ force, requests }) {
  const lit = Math.round((force.util / 100) * TICKS);
  const heat = force.util >= 85 ? " hot" : force.util >= 60 ? " warm" : "";
  const split = [
    { id: "on", label: "On duty", n: force.onDuty },
    { id: "off", label: "Off duty", n: force.live - force.onDuty },
    { id: "wait", label: "Awaiting uplink", n: force.awaiting - force.stalled },
    { id: "stall", label: "Stalled", n: force.stalled },
  ];

  return (
    <div className="ac-forcex">
      <div className="ac-forcex-top">
        <div className={`ac-reactor${heat}`} title={`${force.load} of ${force.cap} open slots in use`}>
          <svg viewBox="0 0 140 140" aria-hidden="true">
            <defs>
              <linearGradient id="acReactorGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" style={{ stopColor: "var(--rc)" }} />
                <stop offset="100%" style={{ stopColor: "var(--rc2)" }} />
              </linearGradient>
            </defs>
            <g className="ticks">
              {Array.from({ length: TICKS }, (_, i) => {
                const a = (i / TICKS) * Math.PI * 2 - Math.PI / 2;
                const r1 = 61;
                const r2 = i % 4 === 0 ? 69 : 66;
                return (
                  <line
                    key={i}
                    x1={70 + r1 * Math.cos(a)} y1={70 + r1 * Math.sin(a)}
                    x2={70 + r2 * Math.cos(a)} y2={70 + r2 * Math.sin(a)}
                    className={i < lit ? "on" : ""}
                    style={i < lit ? { animationDelay: `${i * 16}ms` } : undefined}
                  />
                );
              })}
            </g>
            <circle className="track" cx="70" cy="70" r="52" />
            <circle className="arc" cx="70" cy="70" r="52" strokeDasharray={`${(force.util / 100) * C} ${C}`} transform="rotate(-90 70 70)" />
            <circle className="orbit" cx="70" cy="70" r="43" />
          </svg>
          <div className="core">
            <strong>{force.util}<small>%</small></strong>
            <em>Capacity used</em>
          </div>
        </div>

        <div className="ac-readout">
          <Link to="/admin/staff" state={{ lens: "loaded" }} title="Staff Management · carrying work"><span>Open load</span><b>{force.load}<em>/{force.cap}</em></b></Link>
          <Link to="/admin/staff" state={{ lens: "on" }} title="Staff Management · on duty"><span>On duty</span><b>{force.onDuty}<em>/{force.live}</em></b></Link>
          <Link to="/admin/staff-desk" state={{ tab: "field", uplinkOnly: true }} className={force.awaiting ? "amber" : ""} title="Staff Desk · awaiting uplink"><span>Uplink wait</span><b>{force.awaiting}</b></Link>
          <Link to="/admin/staff-desk" state={{ tab: "queue" }} className={requests ? "amber" : ""} title="Staff Desk · clearance queue"><span>Clearance</span><b>{requests}</b></Link>
        </div>
      </div>

      <div className="ac-split" role="img" aria-label={split.map((s) => `${s.label} ${s.n}`).join(", ")}>
        {split.filter((s) => s.n > 0).map((s) => (
          <i key={s.id} className={s.id} style={{ flexGrow: s.n }} title={`${s.label}: ${s.n}`} />
        ))}
      </div>
      <div className="ac-split-legend">
        {split.map((s) => (
          <span key={s.id} className={s.id}><i />{s.label}<b>{s.n}</b></span>
        ))}
      </div>

      {force.stalled ? (
        <Link to="/admin/staff-desk" state={{ tab: "field", uplinkOnly: true }} className="ac-alert-chip">
          <i /> {force.stalled} uplink{force.stalled === 1 ? "" : "s"} stalled <ArrowRight size={12} />
        </Link>
      ) : null}
    </div>
  );
}

export default IssueCommand;