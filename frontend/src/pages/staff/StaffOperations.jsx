import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ClipboardCheck, Clock, HardHat, ShieldCheck, Siren, ArrowRight, Inbox, Gauge, Radar, Activity, MapPinned,
  Send, FileText, Flame, UserCog, CheckCircle2, Crosshair, MapPin, Sparkles,
} from "lucide-react";
import IssueDetailsDrawer from "../../components/issues/shared/IssueDetailsDrawer";
import GateDoor from "../../components/issues/shared/GateDoor";
import { Kpi, Panel, CatGlyph, PriorityPill, SlaMeter, StatusPill, Empty, CAT_META, ago } from "../../components/issues/admin/CommandKit";
import { Field, FieldHead, FlashChip, FieldMoves, LoadReactor, useFieldDesk, useFlash } from "../../components/issues/staff/FieldKit";
import { CATEGORY_LABEL } from "../../constants/issueCategories";
import { expertiseForCategory, expertiseLabel } from "../../config/expertise";
import { CAPACITY } from "../../store/fieldRoster";
import { slaOf, urgencyCompare } from "../../utils/sla";
import { nameFor, namesIn, useNames } from "../../store/profileStore";

/* ------------------------------------------------------------------
   Field Operations: the field hub. What needs you right now: your next
   moves (most urgent first, with the move on the row), your service
   windows, your capacity, your zone, command's replies on your work and
   the trace of everything that happened to it.
------------------------------------------------------------------- */

const KIND_ICON = { filed: FileText, dispatch: Send, status: Activity, priority: Flame, desk: UserCog };
const closedAt = (issue) => [...(issue.timeline || [])].reverse().find((t) => t.status === "resolved")?.at || issue.updatedAt;

function StaffOperations() {
  useNames(); // names follow each person's current display name
  const { user, issues, audit, me, mine, tick } = useFieldDesk();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [fileId, setFileId] = useState(null);
  const [gate, setGate] = useState(null); // { mode: "close" | "recall", id }
  const askClose = (id) => setGate({ mode: "close", id });
  const askRecall = (id) => setGate({ mode: "recall", id });
  const [flash, setFlash] = useFlash();

  const board = useMemo(() => {
    const open = mine.filter((i) => i.status !== "resolved").sort(urgencyCompare);
    const closed = mine.filter((i) => i.status === "resolved");
    return {
      open,
      queued: open.filter((i) => i.status === "acknowledged"),
      site: open.filter((i) => i.status === "in_progress"),
      gate: open.filter((i) => i.status === "pending_review"),
      breached: open.filter((i) => slaOf(i).state === "over"),
      atRisk: open.filter((i) => ["over", "warn"].includes(slaOf(i).state)),
      week: closed.filter((i) => (Date.now() - new Date(closedAt(i))) / 864e5 <= 7),
      closed,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mine, tick]);

  const zone = useMemo(() => {
    if (!me) return null;
    const open = issues.filter((i) => i.status !== "resolved" && i.ward === me.zone);
    return {
      name: me.zone,
      open: open.length,
      unowned: open.filter((i) => !i.assignedTo).length,
      over: open.filter((i) => slaOf(i).state === "over").length,
      line: open.filter((i) => !i.assignedTo && expertiseForCategory(i.category) === me.expertise).length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issues, me, tick]);

  // what command and the board did on your issues
  const mineIds = useMemo(() => new Set(mine.map((i) => i.id)), [mine]);
  const trace = useMemo(() => audit.filter((e) => e.issueId && mineIds.has(e.issueId)).slice(0, 8), [audit, mineIds]);
  const replies = useMemo(
    () => audit.filter((e) => e.role === "admin" && e.issueId && mineIds.has(e.issueId)).slice(0, 5),
    [audit, mineIds]
  );

  const cats = useMemo(() => {
    const rows = Object.keys(CATEGORY_LABEL).map((key) => ({ key, label: CATEGORY_LABEL[key], n: board.open.filter((i) => i.category === key).length })).filter((r) => r.n);
    const max = Math.max(1, ...rows.map((r) => r.n));
    return rows.map((r) => ({ ...r, w: (r.n / max) * 100 })).sort((a, b) => b.n - a.n);
  }, [board.open]);

  const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);
  const lock = (id) => navigate("/staff/assigned", { state: { target: id, from: pathname } });
  const fileIssue = issues.find((i) => i.id === fileId) || null;
  const gateIssue = gate ? issues.find((i) => i.id === gate.id) || null : null;
  const gateSent = (id, mode) => setFlash({ id, text: mode === "recall" ? `${id} recalled · back in progress` : `${id} close requested · with command` });

  return (
    <Field>
      <FieldHead crumb="OPERATIONS" title="Field Operations" sub="What needs you now: your next moves, your service windows, your capacity and command's replies." me={me} tick={tick}>
        <FlashChip flash={flash} />
      </FieldHead>

      <section className="ac-kpis">
        <Kpi icon={ClipboardCheck} label="Open on you" value={`${board.open.length}/${CAPACITY}`} sub={`${board.closed.length} closed in total`} meter={pct(board.open.length, CAPACITY)} />
        <Kpi icon={Clock} label="Not started" value={board.queued.length} sub={board.queued.length ? "Start when on site" : "Everything is started"} meter={pct(board.queued.length, board.open.length)} tone="amber" />
        <Kpi icon={HardHat} label="On site" value={board.site.length} sub="In progress now" meter={pct(board.site.length, board.open.length)} tone="green" />
        <Kpi icon={ShieldCheck} label="With command" value={board.gate.length} sub="Close requested" meter={pct(board.gate.length, board.open.length)} tone="cyan" />
        <Kpi icon={Siren} label="Breached" value={board.breached.length} sub={`${board.atRisk.length - board.breached.length} more at risk`} meter={pct(board.breached.length, board.open.length)} tone={board.breached.length ? "red" : "green"} />
      </section>

      <div className="ac-actions">
        <Link to="/staff/assigned" className="ac-btn primary">Assigned work <ArrowRight size={14} /></Link>
        <Link to="/staff/queue" className="ac-btn"><Inbox size={14} /> City intake</Link>
        <Link to="/staff/performance" className="ac-btn"><Gauge size={14} /> Field load</Link>
      </div>

      <div className="ac-row2">
        <Panel
          kicker="Next up"
          icon={Crosshair}
          title={board.open.length ? `${board.open.length} open issue${board.open.length === 1 ? "" : "s"} on you` : "Nothing open on you"}
          action={<Link to="/staff/assigned" className="ac-link">All work <ArrowRight size={13} /></Link>}
        >
          {!board.open.length ? (
            <Empty icon={Sparkles} title="You're clear" sub="Command dispatches new work here. City Intake shows the open board." />
          ) : (
            <div className="fc-next">
              {board.open.slice(0, 6).map((issue, i) => (
                <div key={issue.id} className={`fc-next-row${slaOf(issue).state === "over" ? " over" : ""}`} style={{ animationDelay: `${i * 40}ms` }}>
                  <CatGlyph category={issue.category} />
                  <button type="button" className="fc-next-main" onClick={() => setFileId(issue.id)} title="Open the issue file">
                    <strong>{issue.title}</strong>
                    <small>
                      <span className="ac-id">{issue.id}</span><span className="ac-dot">·</span><MapPin size={10} /> {issue.ward}
                      <PriorityPill priority={issue.priority} />
                      <SlaMeter issue={issue} compact />
                      {issue.lastReturn && issue.status === "in_progress" ? <span className="ac-tag fc-returned" title={issue.lastReturn.reason}>Returned</span> : null}
                    </small>
                  </button>
                  <div className="fc-next-side">
                    <FieldMoves issue={issue} user={user} compact onRequestClose={askClose} onWithdraw={askRecall} onMoved={setFlash} />
                    <button type="button" className="ac-btn sm ghost" onClick={() => lock(issue.id)} title="Lock it on Assigned Work"><Crosshair size={12} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel kicker="Service windows" icon={Siren} title={board.atRisk.length ? "Breached and at risk" : "All your windows are healthy"}>
          {!board.atRisk.length ? (
            <Empty icon={Gauge} title="No window at risk" sub="Issues show here when under 30% of their window is left." />
          ) : (
            <div className="ac-mini">
              {board.atRisk.slice(0, 6).map((issue) => (
                <button key={issue.id} type="button" className="ac-mini-row" onClick={() => setFileId(issue.id)}>
                  <CatGlyph category={issue.category} />
                  <div style={{ minWidth: 0 }}>
                    <strong>{issue.title}</strong>
                    <small><span className="ac-id">{issue.id}</span><span className="ac-dot">·</span><StatusPill status={issue.status} /></small>
                  </div>
                  <SlaMeter issue={issue} compact />
                </button>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="ac-row3">
        <Panel kicker="Capacity" icon={Gauge} title={board.open.length >= CAPACITY ? "At capacity" : `${CAPACITY - board.open.length} free slot${CAPACITY - board.open.length === 1 ? "" : "s"}`}>
          <div className="fc-cap">
            <LoadReactor load={board.open.length} label="In use" />
            <div className="ac-readout">
              <div><span>On site</span><b>{board.site.length}</b></div>
              <div className={board.queued.length ? "amber" : ""}><span>Not started</span><b>{board.queued.length}</b></div>
              <div><span>With command</span><b>{board.gate.length}</b></div>
              <div><span>Closed · 7 days</span><b>{board.week.length}</b></div>
            </div>
          </div>
        </Panel>

        <Panel kicker="Your zone" icon={MapPinned} title={zone ? zone.name : "No zone on your file"} action={<Link to="/staff/queue" className="ac-link">Intake <ArrowRight size={13} /></Link>}>
          {zone ? (
            <div className="ac-readout">
              <div><span>Open in zone</span><b>{zone.open}</b></div>
              <div className={zone.unowned ? "amber" : ""}><span>No owner yet</span><b>{zone.unowned}</b></div>
              <div className={zone.over ? "amber" : ""}><span>Breached</span><b>{zone.over}</b></div>
              <div><span>{expertiseLabel(me.expertise)} · unowned</span><b>{zone.line}</b></div>
            </div>
          ) : (
            <Empty icon={MapPinned} title="No roster record" sub="Your zone shows once you are on the field roster." />
          )}
        </Panel>

        <Panel kicker="Command replies" icon={ShieldCheck} title={replies.length ? "Latest from command" : "Nothing from command yet"}>
          {!replies.length ? (
            <Empty icon={ShieldCheck} title="No replies yet" sub="Dispatches, confirms and send-backs on your work land here." />
          ) : (
            <div className="ac-trace">
              {replies.map((e) => {
                const Icon = KIND_ICON[e.kind] || Activity;
                return (
                  <div key={e.id} className={`ac-trace-row k-${e.kind || "status"}`}>
                    <span className="ac-trace-ic"><Icon size={14} /></span>
                    <div style={{ minWidth: 0 }}>
                      <p><button type="button" className="ac-link" onClick={() => setFileId(e.issueId)}>{namesIn(e.action)}</button></p>
                      <small>{nameFor(e.actor)}</small>
                    </div>
                    <span className="when">{ago(e.at)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>

      <div className="ac-row2">
        <Panel kicker="Field trace" icon={Radar} title="Everything on your work">
          {!trace.length ? (
            <Empty icon={Radar} title="No moves yet" sub="Every move on your issues shows here." />
          ) : (
            <div className="ac-trace">
              {trace.map((e) => {
                const Icon = KIND_ICON[e.kind] || Activity;
                return (
                  <div key={e.id} className={`ac-trace-row k-${e.kind || "status"}`}>
                    <span className="ac-trace-ic"><Icon size={14} /></span>
                    <div style={{ minWidth: 0 }}>
                      <p><button type="button" className="ac-link" onClick={() => setFileId(e.issueId)}>{namesIn(e.action)}</button></p>
                      <small>{e.actor === user?.name ? "You" : e.actor} · {e.role}</small>
                    </div>
                    <span className="when">{ago(e.at)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel kicker="Category mix" icon={Activity} title="What's open on you">
          {!cats.length ? (
            <Empty icon={CheckCircle2} title="Nothing open" sub="Your open work by category shows here." />
          ) : (
            <div className="ac-catbars">
              {cats.map((c) => (
                <div key={c.key} className="ac-catbar" style={{ "--c": (CAT_META[c.key] || CAT_META.other).color }}>
                  <CatGlyph category={c.key} size={30} />
                  <div>
                    <b>{c.label}</b>
                    <span className="bar"><i style={{ width: `${Math.max(2, c.w)}%` }} /></span>
                  </div>
                  <span className="n">{c.n} open</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <IssueDetailsDrawer issue={fileIssue} onClose={() => setFileId(null)} />
      <GateDoor mode={gate?.mode} issue={gateIssue} onClose={() => setGate(null)} onSent={gateSent} />
    </Field>
  );
}

export default StaffOperations;
