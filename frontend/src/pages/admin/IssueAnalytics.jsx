import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMinute } from "../../hooks/useMinute";
import {
  Percent, Timer, ShieldCheck, Send, GitBranch, Gauge, MapPinned, Users, Trophy, Layers, Flame, MousePointerClick, ArrowRight,
} from "lucide-react";
import {
  Command, CommandHead, LensDeck, Panel, Seg, CatGlyph, Avatar, CAT_META,
} from "../../components/issues/admin/CommandKit";
import { CATEGORY_LABEL } from "../../constants/issueCategories";
import { ISSUE_STATUSES, STATUS_LABEL } from "../../constants/issueStatuses";
import { ISSUE_PRIORITIES, PRIORITY_LABEL } from "../../constants/issuePriorities";
import { WARDS } from "../../constants/issueConstants";
import { EXPERTISE, expertiseForCategory, expertiseLabel } from "../../config/expertise";
import { useIssues } from "../../store/issueStore";
import { useFieldRoster, availability, CAPACITY } from "../../store/fieldRoster";
import { isAwaiting } from "../../store/staffDeskStore";
import { slaOf, span, resolveHours, urgencyCompare } from "../../utils/sla";
import IssueDetailsDrawer from "../../components/issues/shared/IssueDetailsDrawer";
import LensWatch from "../../components/issues/admin/LensWatch";
import "../../styles/analytics-x.css";
import { nameFor, useNames } from "../../store/profileStore";

/* ------------------------------------------------------------------
   Analytics: close rate, time to resolve, SLA compliance, dispatch
   coverage, the status pipeline, category and zone pressure,
   expertise demand vs field capacity, and the field leaderboard.
------------------------------------------------------------------- */

const RANGES = [
  { id: "all", label: "All time" },
  { id: "30", label: "30 days" },
  { id: "7", label: "7 days" },
];

const STATUS_FILL = {
  submitted: "linear-gradient(90deg, #94a3b8, #cbd5e1)",
  acknowledged: "linear-gradient(90deg, #7c3aed, #a78bfa)",
  in_progress: "linear-gradient(90deg, #f59e0b, #fbbf24)",
  pending_review: "linear-gradient(90deg, #06b6d4, #67e8f9)",
  resolved: "linear-gradient(90deg, #10b981, #34d399)",
};
const PRIORITY_FILL = {
  low: "linear-gradient(90deg, #94a3b8, #cbd5e1)",
  medium: "linear-gradient(90deg, #6366f1, #a5b4fc)",
  high: "linear-gradient(90deg, #f97316, #fdba74)",
  critical: "linear-gradient(90deg, #ef4444, #fca5a5)",
};

const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);

function IssueAnalytics() {
  useNames(); // names follow each person's current display name
  const all = useIssues();
  const { roster } = useFieldRoster();
  const [range, setRange] = useState("all");
  const [lens, setLens] = useState("all"); // no lens until a tile is picked
  const [openId, setOpenId] = useState(null);
  const tick = useMinute();

  const issues = useMemo(() => {
    if (range === "all") return all;
    const days = Number(range);
    return all.filter((i) => (Date.now() - new Date(i.createdAt)) / 864e5 <= days);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, range, tick]);

  const s = useMemo(() => {
    const total = issues.length;
    const resolved = issues.filter((i) => i.status === "resolved");
    const open = issues.filter((i) => i.status !== "resolved");
    const times = resolved.map(resolveHours).filter((h) => h !== null);
    const avg = times.length ? times.reduce((a, b) => a + b, 0) / times.length : 0;
    const onTime = resolved.filter((i) => {
      const h = resolveHours(i);
      return h !== null && (!i.slaHours || h <= i.slaHours);
    }).length;
    const owned = open.filter((i) => i.assignedTo).length;
    const breached = open.filter((i) => slaOf(i).state === "over").length;
    return {
      total, resolved: resolved.length, open: open.length, avg, onTime,
      closeRate: pct(resolved.length, total),
      compliance: pct(onTime, resolved.length),
      coverage: pct(owned, open.length),
      breached, owned,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issues, tick]);

  // tile lenses: each KPI lists the issues behind its number (in the chosen range)
  const lensItems = useMemo(() => {
    const resolved = issues.filter((i) => i.status === "resolved");
    const open = issues.filter((i) => i.status !== "resolved");
    const rh = (i) => resolveHours(i) ?? -1;
    if (lens === "close") return [...resolved].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    if (lens === "time") return [...resolved].sort((a, b) => rh(b) - rh(a));
    if (lens === "sla") return resolved.filter((i) => { const h = resolveHours(i); return h !== null && i.slaHours && h > i.slaHours; }).sort((a, b) => rh(b) - rh(a));
    if (lens === "cover") return open.filter((i) => !i.assignedTo).sort(urgencyCompare);
    if (lens === "breach") return open.filter((i) => slaOf(i).state === "over").sort(urgencyCompare);
    const [kind, val] = lens.split(":");
    if (kind === "st") return issues.filter((i) => i.status === val).sort(urgencyCompare);
    if (kind === "pr") return issues.filter((i) => i.priority === val).sort(urgencyCompare);
    if (kind === "cat") return open.filter((i) => i.category === val).sort(urgencyCompare);
    if (kind === "zone") return open.filter((i) => i.ward === val).sort(urgencyCompare);
    // trade demand reads the whole board, like the panel it comes from
    if (kind === "trade") return all.filter((i) => i.status !== "resolved" && !i.assignedTo && expertiseForCategory(i.category) === val).sort(urgencyCompare);
    return [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, issues, lens, tick]);
  const LENS_COPY = {
    close: { kicker: "close rate", icon: Percent, title: "Resolved issues, latest first", empty: "Nothing resolved in this range" },
    time: { kicker: "time to resolve", icon: Timer, title: "Slowest resolutions first", empty: "Nothing resolved in this range" },
    sla: { kicker: "SLA compliance", icon: ShieldCheck, title: "Closed after the promise", empty: "Every close was inside its window" },
    cover: { kicker: "dispatch coverage", icon: Send, title: "Open issues with no owner", empty: "Every open issue has an owner" },
    breach: { kicker: "breached now", icon: Flame, title: "Open and past the window", empty: "Nothing is past its window" },
  };
  const [kind, val] = lens.split(":");
  const drill = ["st", "pr", "cat", "zone", "trade"].includes(kind);
  if (kind === "st") LENS_COPY[lens] = { kicker: `pipeline · ${STATUS_LABEL[val]}`, icon: GitBranch, title: `Every issue at ${STATUS_LABEL[val]}, most urgent first`, empty: "No issue at this stage" };
  if (kind === "pr") LENS_COPY[lens] = { kicker: `priority · ${PRIORITY_LABEL[val]}`, icon: Layers, title: `${PRIORITY_LABEL[val]} priority, most urgent first`, empty: "No issue at this priority" };
  if (kind === "cat") LENS_COPY[lens] = { kicker: `category · ${CATEGORY_LABEL[val]}`, icon: Layers, title: `Open ${CATEGORY_LABEL[val]} issues`, empty: "No open issue in this category" };
  if (kind === "zone") LENS_COPY[lens] = { kicker: `zone · ${val}`, icon: MapPinned, title: `Open issues in ${val}, breaches first`, empty: "No open issue in this zone" };
  if (kind === "trade") LENS_COPY[lens] = { kicker: `demand · ${expertiseLabel(val)}`, icon: Users, title: `${expertiseLabel(val)} work with no crew yet`, empty: "Every open job in this trade has a crew" };
  const DrillIcon = drill ? LENS_COPY[lens].icon : Layers;
  const pickDrill = (id) => setLens((cur) => (cur === id ? "all" : id));
  const on = (id) => (lens === id ? " on" : drill ? " dim" : "");

  // Esc releases a drill lens too (the tile deck handles its own tiles)
  useEffect(() => {
    if (!drill) return undefined;
    const onKey = (e) => {
      if (e.key !== "Escape" || document.querySelector("[aria-modal='true']")) return;
      setLens("all");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drill]);

  const pipeline = ISSUE_STATUSES.map((st) => ({ id: st, label: STATUS_LABEL[st], n: issues.filter((i) => i.status === st).length }));
  const pipeMax = Math.max(1, ...pipeline.map((p) => p.n));

  const prio = ISSUE_PRIORITIES.map((p) => ({ id: p, label: PRIORITY_LABEL[p], n: issues.filter((i) => i.priority === p).length })).reverse();
  const prioMax = Math.max(1, ...prio.map((p) => p.n));

  const cats = Object.keys(CATEGORY_LABEL)
    .map((k) => ({ key: k, label: CATEGORY_LABEL[k], n: issues.filter((i) => i.category === k).length, open: issues.filter((i) => i.category === k && i.status !== "resolved").length }))
    .filter((c) => c.n > 0)
    .sort((a, b) => b.n - a.n);
  const catMax = Math.max(1, ...cats.map((c) => c.n));

  const zones = WARDS.map((w) => {
    const z = issues.filter((i) => i.ward === w.name);
    const open = z.filter((i) => i.status !== "resolved");
    return { name: w.name, total: z.length, open: open.length, over: open.filter((i) => slaOf(i).state === "over").length, closed: z.length - open.length };
  });
  const zoneMax = Math.max(1, ...zones.map((z) => z.open + z.over * 2));

  // demand (open issues needing each expertise) vs free capacity of available crews
  const supply = EXPERTISE.map((e) => {
    const demand = all.filter((i) => i.status !== "resolved" && expertiseForCategory(i.category) === e.id).length;
    const crew = roster.filter((p) => p.expertise === e.id && availability(p).ok);
    const cap = crew.reduce((sum) => sum + CAPACITY, 0);
    const used = crew.reduce((sum, p) => sum + p.load, 0);
    return { id: e.id, label: e.label, demand, crew: crew.length, cap, free: cap - used };
  });
  const supplyMax = Math.max(1, ...supply.map((r) => Math.max(r.demand, r.cap)));

  const board = roster
    .filter((p) => !isAwaiting(p))
    .map((p) => {
      const mine = issues.filter((i) => i.assignedTo === p.name && i.status === "resolved");
      const times = mine.map(resolveHours).filter((h) => h !== null);
      return { ...p, done: mine.length, avg: times.length ? times.reduce((a, b) => a + b, 0) / times.length : null };
    })
    .sort((a, b) => b.done - a.done || b.closed - a.closed)
    .slice(0, 6);

  return (
    <Command>
      <CommandHead crumb="ANALYTICS" title="Issue Intelligence" sub="How fast the city closes issues, where the pressure is, and whether the field has the right people for it.">
        <span className="anx-hint"><MousePointerClick size={12} /> Tap any measure, bar or zone to see the issues behind it</span>
        <Seg value={range} onChange={setRange} options={RANGES} label="Range" />
      </CommandHead>

      <LensDeck
        value={lens}
        onChange={setLens}
        readout={`${lensItems.length} issue${lensItems.length === 1 ? "" : "s"} · ${RANGES.find((r) => r.id === range)?.label}`}
        tiles={[
          { id: "close", icon: Percent, label: "Close rate", lens: "Resolved issues", value: `${s.closeRate}%`, sub: `${s.resolved} of ${s.total} resolved`, meter: s.closeRate, tone: "green" },
          { id: "time", icon: Timer, label: "Time to resolve", lens: "Slowest resolutions", value: s.resolved ? span(s.avg) : "—", sub: "Report to confirmed close", meter: s.resolved ? Math.min(100, (s.avg / 72) * 100) : 0, tone: "cyan" },
          { id: "sla", icon: ShieldCheck, label: "SLA compliance", lens: "Closed late", value: s.resolved ? `${s.compliance}%` : "—", sub: `${s.onTime} closed inside the window`, meter: s.compliance, tone: s.compliance >= 80 ? "green" : s.compliance >= 50 ? "amber" : "red" },
          { id: "cover", icon: Send, label: "Dispatch coverage", lens: "Unowned open issues", value: `${s.coverage}%`, sub: `${s.owned} of ${s.open} open issues owned`, meter: s.coverage },
          { id: "breach", icon: Flame, label: "Breached now", lens: "Breached now", value: s.breached, sub: "Open and past the window", meter: pct(s.breached, s.open), tone: s.breached ? "red" : "green" },
        ]}
      />

      {drill ? (
        <div className="ac-lensbar violet anx-drillbar" role="status">
          <span className="ac-lensbar-ic"><DrillIcon size={13} /></span>
          Lens locked <b>{LENS_COPY[lens].kicker}</b>
          <span className="sep" /><span className="read">{lensItems.length} issue{lensItems.length === 1 ? "" : "s"}</span>
          <button type="button" onClick={() => setLens("all")}>Release <kbd>Esc</kbd></button>
        </div>
      ) : null}

      {lens !== "all" ? (
        <LensWatch
          action={kind === "trade" && lensItems.length ? <Link to="/admin/assignments" className="ac-btn sm primary"><Send size={12} /> Assign <ArrowRight size={12} /></Link> : null}
          kicker={`Lens · ${LENS_COPY[lens].kicker}`}
          icon={LENS_COPY[lens].icon}
          title={LENS_COPY[lens].title}
          items={lensItems}
          empty={LENS_COPY[lens].empty}
          onOpen={setOpenId}
          side={lens === "close" || lens === "time" || lens === "sla" ? (i) => { const h = resolveHours(i); return h === null ? "—" : `${span(h)} to close`; } : undefined}
          more="switch the range or open All Issues"
        />
      ) : null}

      <div className="anx-top">
        <Panel kicker="Pipeline" icon={GitBranch} title="Where every issue sits">
          <div className="ac-funnel anx-bars">
            {pipeline.map((p) => (
              <button key={p.id} type="button" className={`ac-funnel-row anx-bar${on(`st:${p.id}`)}`} onClick={() => pickDrill(`st:${p.id}`)} disabled={!p.n} aria-pressed={lens === `st:${p.id}`}>
                <span>{p.label}</span>
                <span className="track"><i style={{ width: `${Math.max(2, (p.n / pipeMax) * 100)}%`, "--f": STATUS_FILL[p.id] }}>{p.n ? p.n : ""}</i></span>
                <span className="n">{pct(p.n, s.total)}%</span>
              </button>
            ))}
          </div>
          <div style={{ marginTop: 20 }}><p className="ac-kicker"><Layers size={12} /> Priority mix</p></div>
          <div className="ac-funnel anx-bars" style={{ marginTop: 10 }}>
            {prio.map((p) => (
              <button key={p.id} type="button" className={`ac-funnel-row anx-bar${on(`pr:${p.id}`)}`} onClick={() => pickDrill(`pr:${p.id}`)} disabled={!p.n} aria-pressed={lens === `pr:${p.id}`}>
                <span>{p.label}</span>
                <span className="track"><i style={{ width: `${Math.max(2, (p.n / prioMax) * 100)}%`, "--f": PRIORITY_FILL[p.id] }}>{p.n ? p.n : ""}</i></span>
                <span className="n">{pct(p.n, s.total)}%</span>
              </button>
            ))}
          </div>
        </Panel>

        <div className="anx-stack">
          <Panel kicker="Operational health" icon={Gauge} title="Resolution and coverage">
            <div className="ac-gauge">
              <div className="ac-ring" style={{ width: 128, height: 128 }}>
                <svg viewBox="0 0 120 120" aria-hidden="true">
                  <defs>
                    <linearGradient id="acRingGrad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#7c3aed" />
                      <stop offset="100%" stopColor="#34d399" />
                    </linearGradient>
                  </defs>
                  <circle className="bg" cx="60" cy="60" r="50" fill="none" strokeWidth="11" />
                  <circle className="fg" cx="60" cy="60" r="50" fill="none" strokeWidth="11" strokeLinecap="round" strokeDasharray={`${(s.closeRate / 100) * 314} 314`} />
                </svg>
                <div><strong>{s.closeRate}%</strong><em>close rate</em></div>
              </div>
              <div className="ac-gauge-stats">
                <div><div><span>SLA compliance</span><b>{s.compliance}%</b></div><span className="bar green"><i style={{ width: `${s.compliance}%` }} /></span></div>
                <div><div><span>Dispatch coverage</span><b>{s.coverage}%</b></div><span className="bar"><i style={{ width: `${s.coverage}%` }} /></span></div>
                <div><div><span>Breached share of open</span><b>{pct(s.breached, s.open)}%</b></div><span className="bar amber"><i style={{ width: `${pct(s.breached, s.open)}%` }} /></span></div>
              </div>
            </div>
          </Panel>

          <Panel kicker="Demand vs field" icon={Users} title="Do we have the right crews?">
            <div className="ac-supply">
              {supply.map((r) => {
                const waiting = all.filter((i) => i.status !== "resolved" && !i.assignedTo && expertiseForCategory(i.category) === r.id).length;
                return (
                  <button key={r.id} type="button" className={`ac-supply-row anx-bar${on(`trade:${r.id}`)}`} onClick={() => pickDrill(`trade:${r.id}`)} aria-pressed={lens === `trade:${r.id}`} title={waiting ? `${waiting} ${r.label} job${waiting === 1 ? "" : "s"} with no crew` : `${r.label}: every open job has a crew`}>
                    <span>{r.label}</span>
                    <span className="ac-supply-bars">
                      <span className="b demand"><i style={{ width: `${(r.demand / supplyMax) * 100}%` }} /></span>
                      <span className="b crew"><i style={{ width: `${(r.cap / supplyMax) * 100}%` }} /></span>
                    </span>
                    <span className={`ac-tag ${r.free <= 0 && r.demand ? "red" : r.free < 3 ? "amber" : "green"}`}>
                      {r.crew ? `${r.free} free · ${r.crew} crew` : r.demand ? "No crew" : "Idle"}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="ac-legend">
              <span><i style={{ background: "linear-gradient(90deg, #f59e0b, #ef4444)" }} />Open demand</span>
              <span><i style={{ background: "linear-gradient(90deg, #7c3aed, #a78bfa)" }} />Crew capacity ({CAPACITY} each)</span>
            </div>
          </Panel>
        </div>
      </div>

      <div className="anx-wide">
        <Panel kicker="Zone heat" icon={MapPinned} title="Open load and breaches by zone">
          <div className="ac-zones anx-zones">
            {zones.map((z) => {
              const heat = (z.open + z.over * 2) / zoneMax;
              return (
                <button key={z.name} type="button" className={`ac-zone anx-zone${on(`zone:${z.name}`)}`} style={{ "--heat": heat.toFixed(2) }} onClick={() => pickDrill(`zone:${z.name}`)} disabled={!z.open} aria-pressed={lens === `zone:${z.name}`}>
                  <b>{z.name}</b>
                  <strong>{z.open}</strong>
                  <small>{z.over ? <span className="hot">{z.over} breached</span> : null}<span>{z.closed} closed</span></small>
                  <span className="heat"><i style={{ width: `${Math.max(6, heat * 100)}%` }} /></span>
                </button>
              );
            })}
          </div>
        </Panel>

      </div>

      <div className="anx-low">
        <Panel kicker="Category pressure" icon={Layers} title="What the city reports">
          <div className="ac-catbars">
            {cats.map((c) => (
              <button key={c.key} type="button" className={`ac-catbar anx-bar${on(`cat:${c.key}`)}`} style={{ "--c": (CAT_META[c.key] || CAT_META.other).color }} onClick={() => pickDrill(`cat:${c.key}`)} disabled={!c.open} aria-pressed={lens === `cat:${c.key}`}>
                <CatGlyph category={c.key} size={30} />
                <div>
                  <b>{c.label}</b>
                  <span className="bar"><i style={{ width: `${Math.max(2, (c.n / catMax) * 100)}%` }} /></span>
                </div>
                <span className="n">{c.n} · {c.open} open</span>
              </button>
            ))}
          </div>
        </Panel>

        <Panel kicker="Field leaderboard" icon={Trophy} title="Most closed on this board">
          <div className="ac-board">
            {board.map((p, i) => (
              <div key={p.id} className="ac-board-row">
                <span className="rk">{String(i + 1).padStart(2, "0")}</span>
                <Avatar name={nameFor(p.name)} size={32} dot={p.onDuty} />
                <div style={{ minWidth: 0 }}>
                  <strong>{nameFor(p.name)}</strong>
                  <small>{expertiseLabel(p.expertise)} · {p.zone}</small>
                </div>
                <span className="num">{p.done}<em>{p.avg !== null ? `avg ${span(p.avg)}` : "—"}</em></span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <IssueDetailsDrawer issue={all.find((i) => i.id === openId) || null} onClose={() => setOpenId(null)} />
    </Command>
  );
}

export default IssueAnalytics;