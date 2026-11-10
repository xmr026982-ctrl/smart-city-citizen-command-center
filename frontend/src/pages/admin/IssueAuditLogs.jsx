import { clock, weekClock, dayKey } from "../../utils/time";
import { getUser } from "../../store/authStore";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useMinute } from "../../hooks/useMinute";
import {
  ScrollText, Shield, HardHat, User, FileText, Send, Activity, Flame, UserCog, Download, RotateCcw, FileSearch, Clock,
  UserRound, ArrowUpRight, Ban, MessageSquareWarning, Users,
} from "lucide-react";
import IssueDetailsDrawer from "../../components/issues/shared/IssueDetailsDrawer";
import StaffDetailsDrawer from "../../components/issues/admin/StaffDetailsDrawer";
import PolicyEventDrawer, { isPolicyEvent } from "../../components/issues/admin/PolicyEventDrawer";
import {
  Command, CommandHead, LensDeck, SearchBox, Seg, Chips, ResultLine, Pager, Empty, ago, useHoverFx, FxLayer,
} from "../../components/issues/admin/CommandKit";
import { useAudit, useAllIssues } from "../../store/issueStore";
import { useFieldRoster, subjectOf, personRecord } from "../../store/fieldRoster";
import { nameFor, namesIn, useNames } from "../../store/profileStore";

/* ------------------------------------------------------------------
   Audit Log: every command action, grouped by day. Issue changes,
   dispatches, priorities and Staff Desk actions (clearance, rank,
   verify, removal, uplink). The tile deck locks one role lens at a
   time. Filter, search, export the trace as a CSV spreadsheet. Issue
   events open the issue file; Staff Desk events open the person's
   file (live), or a locked record if they were removed or denied.
------------------------------------------------------------------- */

const KINDS = [
  { id: "filed", label: "Filed", icon: FileText },
  { id: "dispatch", label: "Dispatch", icon: Send },
  { id: "status", label: "Status", icon: Activity },
  { id: "priority", label: "Priority", icon: Flame },
  { id: "desk", label: "Staff Desk", icon: UserCog },
  { id: "request", label: "Requests", icon: MessageSquareWarning },
  { id: "removal", label: "Removals", icon: Ban },
  { id: "community", label: "Community", icon: Users },
];
const KIND_ICON = Object.fromEntries(KINDS.map((k) => [k.id, k.icon]));

function dayLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date(); y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function toCsv(rows) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = ["Time", "Actor", "Role", "Kind", "Action", "Issue"];
  const body = rows.map((e) => [new Date(e.at).toISOString(), e.actor, e.role, e.kind || "status", e.action, e.issueId || ""].map(esc).join(","));
  return [head.join(","), ...body].join("\n");
}

function IssueAuditLogs() {
  useNames(); // names follow each person's current display name
  const audit = useAudit();
  const issues = useAllIssues(); // removed issues still open from their trail (restore lives in the file)
  const { roster } = useFieldRoster();
  const tick = useMinute(); // "3m ago" labels and the 24-hour count stay current
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("all");
  const [kind, setKind] = useState("all");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(15);
  const [selectedId, setSelectedId] = useState(null);
  const [policyEvent, setPolicyEvent] = useState(null); // a Service Windows change whose file is open
  const [subject, setSubject] = useState(null); // { id, name, code } of the person whose file is open

  const counts = useMemo(() => {
    const c = { all: audit.length, admin: 0, staff: 0, citizen: 0 };
    const k = {};
    audit.forEach((e) => {
      c[e.role] = (c[e.role] || 0) + 1;
      const kk = e.kind || "status";
      k[kk] = (k[kk] || 0) + 1;
    });
    const day = audit.filter((e) => (Date.now() - new Date(e.at)) / 36e5 <= 24).length;
    return { ...c, kinds: k, day };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audit, tick]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return audit.filter((e) => {
      if (role !== "all" && e.role !== role) return false;
      if (kind !== "all" && (e.kind || "status") !== kind) return false;
      if (!needle) return true;
      const who = subjectOf(e);
      return `${e.action} ${e.actor} ${e.issueId || ""} ${e.role} ${who ? who.code : ""}`.toLowerCase().includes(needle);
    });
  }, [audit, query, role, kind]);

  useEffect(() => { setPage(1); }, [query, role, kind, size]);

  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const safePage = Math.min(page, pages);
  const slice = filtered.slice((safePage - 1) * size, safePage * size);
  const selected = issues.find((i) => i.id === selectedId) || null;

  // the person file: live roster entry if they are still on the desk, otherwise their record
  const livePerson = subject ? roster.find((p) => (subject.id && p.id === subject.id) || p.name === subject.name) || null : null;
  const record = subject && !livePerson ? personRecord(subject, audit) : null;

  /* ---------- since your last watch ----------
     The moment this desk last left the log is kept per admin. Events after
     it, by anyone but you, are "new": a divider marks where your last
     watch ended and the day header carries the count. The mark moves
     forward only when you leave the page, so it stays put while you read. */
  const me = getUser();
  const watchKey = `audit-watch:${me?.id || "admin"}`;
  const [since] = useState(() => {
    try { const v = Number(localStorage.getItem(watchKey)); return v > 0 ? v : null; } catch { return null; }
  });
  useEffect(() => {
    const save = () => { try { localStorage.setItem(watchKey, String(Date.now())); } catch { /* private window */ } };
    if (!since) save();
    window.addEventListener("pagehide", save);
    return () => { save(); window.removeEventListener("pagehide", save); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const isMine = (e) => e.role === "admin" && (!me || e.actor === me.name || nameFor(e.actor) === nameFor(me.name) || e.actorId === me.id);
  const fresh = useMemo(
    () => new Set(since ? audit.filter((e) => new Date(e.at).getTime() > since && !isMine(e)).map((e) => e.id) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [audit, since]
  );
  const freshShown = filtered.filter((e) => fresh.has(e.id)).length;
  const sinceLabel = since ? (dayKey(since) === dayKey(Date.now()) ? clock(since) : weekClock(since)) : "";
  // the divider goes under the last new event on this page, once
  let dividerAfter = null;
  if (freshShown) {
    for (let i = 0; i < slice.length; i += 1) {
      if (fresh.has(slice[i].id) && !(slice[i + 1] && fresh.has(slice[i + 1].id))) { dividerAfter = slice[i].id; break; }
    }
  }

  const listRef = useRef(null);
  useHoverFx(listRef); // light only: rows already slide and say what opens

  const groups = [];
  slice.forEach((e) => {
    const label = dayLabel(e.at);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(e);
    else groups.push({ label, items: [e] });
  });

  const exportCsv = () => {
    const blob = new Blob([toCsv(filtered)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `civic-command-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const filters = query || role !== "all" || kind !== "all";
  const reset = () => { setQuery(""); setRole("all"); setKind("all"); };

  return (
    <Command>
      <CommandHead crumb="AUDIT LOG" title="Command History" sub="Every action on the board and the Staff Desk, newest first. Open any event for its issue file or the person's file.">
        <button
          type="button"
          className="ac-btn"
          onClick={exportCsv}
          disabled={!filtered.length}
          title={`Download the ${filtered.length} event${filtered.length === 1 ? "" : "s"} shown below as a spreadsheet (Time, Actor, Role, Kind, Action, Issue)`}
        >
          <Download size={14} /> Export {filtered.length} event{filtered.length === 1 ? "" : "s"} <em>CSV</em>
        </button>
      </CommandHead>

      <LensDeck
        value={role}
        onChange={setRole}
        readout={`${filtered.length} of ${audit.length} events`}
        tiles={[
          { id: "all", icon: ScrollText, label: "All events", value: counts.all, sub: `${counts.day} in the last 24 hours`, meter: 100 },
          { id: "admin", icon: Shield, label: "Command", lens: "Command actions", value: counts.admin, sub: "Admin actions", meter: counts.all ? (counts.admin / counts.all) * 100 : 0 },
          { id: "staff", icon: HardHat, label: "Field", lens: "Field actions", value: counts.staff, sub: "Staff actions", meter: counts.all ? (counts.staff / counts.all) * 100 : 0, tone: "green" },
          { id: "citizen", icon: User, label: "Citizens", lens: "Citizen reports", value: counts.citizen, sub: "Reports filed", meter: counts.all ? (counts.citizen / counts.all) * 100 : 0, tone: "cyan" },
        ]}
      />

      <div className="ac-toolbar">
        <div className="grow"><SearchBox value={query} onChange={setQuery} placeholder="Search action, person, issue ID or STF code" /></div>
        <Seg value={role} onChange={setRole} label="Role" options={[{ id: "all", label: "Everyone" }, { id: "admin", label: "Command" }, { id: "staff", label: "Field" }, { id: "citizen", label: "Citizens" }]} />
      </div>

      <div className="ac-filterline">
        <Chips value={kind} onChange={(v) => setKind(v === kind ? "all" : v)} items={[{ id: "all", label: "All kinds", count: counts.all }, ...KINDS.map((k) => ({ id: k.id, label: k.label, icon: k.icon, count: counts.kinds[k.id] || 0 }))]} />
        {filters ? <button type="button" className="ac-btn sm" onClick={reset}><RotateCcw size={12} /> Reset</button> : null}
      </div>

      <ResultLine total={filtered.length} of={audit.length} page={safePage} size={size} noun="events" />

      {!slice.length ? (
        <Empty icon={FileSearch} title="No event matches" sub="Change a filter, release the lens or clear the search." />
      ) : (
        <div className="ac-list" ref={listRef} key={`${safePage}-${size}-${role}`}>
          {groups.map((g) => (
            <div key={g.label + g.items[0].id} className="ac-list">
              <p className="ac-day">
                <Clock size={12} /> {g.label} · {g.items.length}
                {g.items.some((e) => fresh.has(e.id)) ? (
                  <span className="ac-watch-pill" title={`Events by others since you last left this log at ${sinceLabel} IST`}>
                    <i aria-hidden />{g.items.filter((e) => fresh.has(e.id)).length} new · since {sinceLabel}
                  </span>
                ) : null}
              </p>
              {g.items.map((e, i) => {
                const Icon = KIND_ICON[e.kind] || Activity;
                const who = subjectOf(e, roster);
                const issueClick = Boolean(e.issueId && issues.some((x) => x.id === e.issueId));
                const policy = isPolicyEvent(e);
                const click = issueClick || Boolean(who) || policy;
                const open = issueClick
                  ? () => setSelectedId(e.issueId)
                  : who
                    ? () => setSubject({ id: who.id, name: who.name, code: who.code })
                    : policy
                      ? () => setPolicyEvent(e)
                      : undefined;
                const Row = click ? "button" : "div";
                return (
                  <Fragment key={e.id}>
                  <Row
                    type={click ? "button" : undefined}
                    className={`ac-event k-${e.kind || "status"}${click ? " click" : ""}${fresh.has(e.id) ? " fresh" : ""}`}
                    style={{ animationDelay: `${i * 25}ms` }}
                    onClick={open}
                    title={who ? (who.person ? `Open ${who.name}'s file` : `Open ${who.name}'s record`) : policy ? "Open the change" : undefined}
                    data-fx={click ? "" : undefined}
                  >
                    {click ? <FxLayer /> : null}
                    <span className="ac-event-ic"><Icon size={16} /></span>
                    <div style={{ minWidth: 0 }}>
                      <p>{namesIn(e.action)}</p>
                      <small>
                        <span>{nameFor(e.actor)}</span>
                        <span className={`ac-role ${e.role}`}>{e.role === "admin" ? "Command" : e.role === "staff" ? "Field" : "Citizen"}</span>
                        {e.issueId ? <span className="ac-id">{e.issueId}</span> : null}
                        {who ? (
                          <span className={`ac-id person${who.person ? "" : " gone"}`} title={who.person ? "On the field" : "No longer in the system"}>
                            <UserRound size={10} /> {who.code}
                          </span>
                        ) : null}
                        {policy ? <span className="ac-id windows"><Clock size={10} /> WINDOWS</span> : null}
                        {click ? <span className="ac-event-go">{who ? (who.person ? "Open file" : "Open record") : policy ? "Open change" : "Open issue"} <ArrowUpRight size={10} /></span> : null}
                      </small>
                    </div>
                    <span className="t">{clock(e.at)}<em>{ago(e.at)}</em></span>
                  </Row>
                  {dividerAfter === e.id ? (
                    <div className="ac-watch" role="separator" aria-label={`${freshShown} new since your last watch at ${sinceLabel} IST`}>
                      <span><b aria-hidden>▲</b> {freshShown} new since your last watch · {sinceLabel} IST</span>
                    </div>
                  ) : null}
                  </Fragment>
                );
              })}
            </div>
          ))}
        </div>
      )}

      <Pager page={safePage} pages={pages} total={filtered.length} size={size} onPage={setPage} onSize={setSize} sizes={[10, 15, 25]} />

      <IssueDetailsDrawer issue={selected} onClose={() => setSelectedId(null)} />
      <PolicyEventDrawer event={policyEvent} onClose={() => setPolicyEvent(null)} />
      <StaffDetailsDrawer
        person={livePerson}
        record={record}
        audit={audit}
        onClose={() => setSubject(null)}
        onOpenIssue={(id) => { setSubject(null); setSelectedId(id); }}
      />
    </Command>
  );
}

export default IssueAuditLogs;