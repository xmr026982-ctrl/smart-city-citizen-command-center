import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useAuth, getUser, subscribeRole } from "./authStore";
import { SERVER_ON } from "../config/server";
import { api } from "../lib/api";
import { onEvent, EVENTS } from "../services/events";
import { useAudit, useAllIssues, possibleDuplicates, openRequest } from "./issueStore";
import { useDesk } from "./staffDeskStore";
import { useCommunity, PROPOSAL_STATUS, pollOpen, pollEnded, answerDue } from "./communityStore";
import { useMinute } from "../hooks/useMinute";
import { CATEGORY_LABEL } from "../constants/issueCategories";
import { PRIORITY_LABEL } from "../constants/issuePriorities";
import { expertiseLabel } from "../config/expertise";
import { fileLink } from "../utils/fileLink";
import { useNames, CITY_COMMAND, FIELD_CREW } from "./profileStore";
import { useSettings } from "./settingsStore";

/* ------------------------------------------------------------------
   Notifications: one inbox per person, built from the command trail.

   Every change on the board is written to the trail with a structured
   notice (audit entry .n, see issueStore). The inbox is that trail run
   through the recipient rules below, plus the time-based signals
   (service windows) and pending Staff Desk requests. Nothing is copied:
   an item always reads the live issue, so a title, owner or status is
   never stale, and every tab of this browser sees the same inbox.

   The backend (Person 6) keeps the same contract: store the trail
   events, apply RULES per recipient, push new items over Socket.io.
   See docs/backend/BACKEND-HANDOVER.md · B2

   Read state, per person: a cursor ("everything before this is read")
   plus the items opened or marked one by one. With a server sign-in it
   is kept on the account (GET/PUT /notifications/read-state), so what
   you read on one device is read on all of them; this browser keeps a
   copy so the inbox opens at once.
------------------------------------------------------------------- */

const H = 36e5;
const KEEP_DAYS = 14;
const FIRST_LOOK_H = 12; // a first visit shows the last 12 hours as unread
const WARN_SHARE = 0.3; // same threshold as the service window chip ("under 30% left")

export const ROLE_OF = { admin: "admin", staff: "staff", citizen: "citizen", user: "citizen" };

/* filter groups shown on the page, per role (label, what falls in it) */
export const GROUPS = {
  admin: [
    { id: "decide", label: "Needs a decision" },
    { id: "breach", label: "Breaches" },
    { id: "duplicate", label: "Duplicates" },
    { id: "issues", label: "New reports" },
    { id: "desk", label: "Staff Desk" },
    { id: "community", label: "Community" },
  ],
  staff: [
    { id: "work", label: "New work" },
    { id: "returns", label: "Returns and flags" },
    { id: "windows", label: "Service windows" },
    { id: "closed", label: "Closed" },
    { id: "community", label: "Community" },
  ],
  citizen: [
    { id: "mine", label: "My reports" },
    { id: "following", label: "Following" },
    { id: "decisions", label: "Decisions" },
    { id: "community", label: "Community" },
  ],
};

/* ------------------------------------------------------------------
   Alert preferences (Settings · Alerts), per person, on this device.
     inboxMuted   groups left out of the inbox, the unread count and pop-ups
     popups       "all" | "urgent" | "off"
     quietHours   during quietFrom..quietTo (IST) only urgent ones pop up
   Locked groups can't be muted: they carry work the person must act on.
------------------------------------------------------------------- */
export const LOCKED_GROUPS = {
  admin: ["decide", "breach"],
  staff: ["work", "windows"],
  citizen: ["mine"],
};

export const GROUP_HINT = {
  decide: "Requests, flags, closes and clearance waiting on command",
  breach: "Work past its service window",
  duplicate: "Possible repeat reports to merge",
  issues: "New reports, more people affected, withdrawals",
  desk: "Staff requests and Staff Desk activity",
  community: "Proposals, polls, announcements and work notices",
  work: "New assignments, moves and notes from command",
  returns: "Sent back, removed, flags decided",
  windows: "Service windows closing or breached",
  closed: "Closes command confirmed",
  mine: "Crews, progress and fixes on your reports",
  following: "Reports and proposals you back",
  decisions: "Outcomes of requests you made",
};

export function mutedGroups(role, s) {
  const locked = LOCKED_GROUPS[role] || [];
  return (Array.isArray(s?.inboxMuted) ? s.inboxMuted : []).filter((g) => !locked.includes(g));
}

const URGENT_KINDS = ["breach", "window", "still", "assigned", "sent-back", "clearance"];
/** needs the person soon: decisions, breaches, new work, problems after a fix */
export const isUrgent = (n) => Boolean(n?.decide) || n?.tone === "alert" || URGENT_KINDS.includes(n?.kind);

const minutesOf = (hhmm) => {
  const [h, m] = String(hhmm || "").split(":").map(Number);
  return Number.isFinite(h) ? h * 60 + (m || 0) : null;
};
/** true while the person's quiet hours run (IST, can cross midnight) */
export function inQuietHours(s, now = Date.now()) {
  if (!s?.quietHours) return false;
  const from = minutesOf(s.quietFrom);
  const to = minutesOf(s.quietTo);
  if (from === null || to === null || from === to) return false;
  const ist = new Date(now + 330 * 60000);
  const t = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  return from < to ? t >= from && t < to : t >= from || t < to;
}

/** whether this notice may slide in on screen right now */
export function popUpAllowed(n, s, now = Date.now()) {
  const mode = s?.popups || "all";
  if (mode === "off") return false;
  if (mode === "urgent" || inQuietHours(s, now)) return isUrgent(n);
  return true;
}

const day = (iso) => new Date(iso).getTime();
const short = (s, n = 90) => (String(s || "").length > n ? `${String(s).slice(0, n - 1).trimEnd()}…` : String(s || ""));
const cat = (i) => CATEGORY_LABEL[i.category] || i.category;

function deadlineOf(i) {
  const total = Number(i.slaHours) || 0;
  return total ? day(i.createdAt) + total * H : null;
}

/* ------------------------------------------------------------------
   Recipient rules. Each returns a notice for this person, or null.
   e: trail entry, n: its notice, i: the live issue, me: { id, name }
------------------------------------------------------------------- */
function forAdmin(e, n, i, ctx) {
  const base = { ref: { type: "issue", id: i.id }, zone: i.ward };
  switch (n.type) {
    case "filed":
      return {
        ...base, kind: "filed", group: "issues", tone: i.danger ? "alert" : "info",
        title: i.danger ? "New report · danger flagged" : "New report",
        line: `${i.id} · ${i.title} · ${i.ward} · ${cat(i)}`,
      };
    case "supported":
      return [3, 5, 10, 25, 50].includes(n.count)
        ? { ...base, kind: "supported", group: "issues", tone: "info", title: `${n.count} people affected`, line: `${i.id} · ${i.title} · more citizens reported the same problem` }
        : null;
    case "request": {
      const open = openRequest(i);
      const live = Boolean(open && open.type === n.req && Math.abs(day(open.at) - ctx.t) < 60000);
      const title = n.req === "flag" ? `Staff flag · ${n.reason}` : n.req === "dispute" ? "Dismissal disputed" : "Withdrawal request";
      const tail = n.req === "flag" && n.linkedTo ? ` · duplicate of ${n.linkedTo}` : n.reason && n.req !== "flag" ? ` · ${n.reason}` : "";
      return { ...base, kind: "request", group: "decide", tone: "warn", decide: live, title, line: `${e.actor} · ${i.id} · ${i.title}${tail}` };
    }
    case "status":
      if (n.to === "pending_review") {
        const last = [...(i.timeline || [])].reverse().find((s) => s.status === "pending_review");
        const live = i.status === "pending_review" && last && Math.abs(day(last.at) - ctx.t) < 60000;
        return { ...base, kind: "close", group: "decide", tone: "warn", decide: Boolean(live), title: "Close requested", line: `${e.actor} asks to close ${i.id} · ${i.title}` };
      }
      if (n.recalled) return { ...base, kind: "recalled", group: "issues", tone: "info", title: "Close request recalled", line: `${e.actor} · ${i.id} · ${i.title}${n.reason ? ` · ${n.reason}` : ""}` };
      return null;
    case "withdrawn":
      return { ...base, kind: "withdrawn", group: "issues", tone: "info", title: "Report withdrawn by the citizen", line: `${i.id} · ${i.title} · ${n.reason || ""}` };
    default:
      return null;
  }
}

function forStaff(e, n, i, ctx) {
  const me = ctx.me.name;
  const owner = n.owner !== undefined ? n.owner : i.assignedTo;
  const mineNow = i.assignedTo === me && !i.removed;
  const base = { ref: { type: "issue", id: i.id, open: mineNow }, zone: i.ward };
  const where = `${i.id} · ${i.title} · ${i.ward}`;
  switch (n.type) {
    case "assign":
      if (n.to === me) return { ...base, kind: "assigned", group: "work", tone: "new", title: "New assignment", line: `${where} · ${PRIORITY_LABEL[i.priority] || i.priority}` };
      if (n.from === me && n.to) return { ...base, kind: "reassigned", group: "work", tone: "info", title: `Reassigned to ${n.to}`, line: where };
      if (n.from === me && !n.to && !n.left) return { ...base, kind: "unassigned", group: "work", tone: "info", title: "Back in the dispatch queue", line: where };
      return null;
    case "status":
      if (owner !== me) return null;
      if (n.sentBack) return { ...base, kind: "sent-back", group: "returns", tone: "warn", title: "Sent back by command", line: `${i.id} · ${n.reason || i.title}` };
      if (n.to === "resolved" && e.role === "admin") return { ...base, kind: "closed", group: "closed", tone: "ok", title: "Close confirmed", line: where };
      return null;
    case "priority":
      if (owner !== me || n.to === n.from) return null;
      return { ...base, kind: "priority", group: "work", tone: n.to === "critical" || n.to === "high" ? "warn" : "info", title: `Priority set to ${PRIORITY_LABEL[n.to] || n.to}`, line: `${where} · window ${i.slaHours}h` };
    case "dismissed":
      if (owner !== me) return null;
      return { ...base, kind: "removed", group: "returns", tone: "info", title: "Removed from your work", line: `${i.id} · ${n.reason || "off the board"}` };
    case "merged":
      if (owner !== me) return null;
      return { ...base, kind: "removed", group: "returns", tone: "info", title: `Merged into ${n.into}`, line: `${i.id} · duplicate report` };
    case "decided":
      if (n.req !== "flag" || requesterOf(n, i, "flag").by !== me) return null;
      return n.verdict === "approved"
        ? { ...base, kind: "flag-approved", group: "returns", tone: "ok", title: "Flag approved", line: `${i.id} · ${n.into ? `merged into ${n.into}` : "taken off the board"}` }
        : { ...base, kind: "flag-declined", group: "returns", tone: "warn", title: "Flag declined", line: `${i.id} · ${n.reason || "the file stays on you"}` };
    default:
      return null;
  }
}

function forCitizen(e, n, i, ctx) {
  const me = ctx.me.id;
  const mine = i.reporterId === me;
  const follows = !mine && ((i.supporters || []).some((s) => s.id === me) || (i.savedBy || []).includes(me));
  if (!mine && !follows) return null;
  const base = { ref: { type: "issue", id: i.id, mine }, zone: i.ward };
  const group = mine ? "mine" : "following";
  const whose = mine ? "Your report" : "A report you follow";
  switch (n.type) {
    case "assign":
      if (!mine || !n.to || n.from) return null;
      return { ...base, kind: "crew", group, tone: "info", title: "A field crew is on your report", line: `${i.id} · ${i.title}` };
    case "status":
      if (n.to === "in_progress" && n.from === "acknowledged") return { ...base, kind: "started", group, tone: "info", title: mine ? "Work started on your report" : "Work started on a report you follow", line: `${i.id} · ${i.title}` };
      if (n.to === "resolved") return { ...base, kind: "resolved", group, tone: "ok", title: mine ? "Your report is resolved" : "Fixed · a report you follow", line: `${i.id} · ${i.title} · ${i.ward}` };
      return null;
    case "supported":
      if (!mine || n.userId === me || !n.count) return null;
      return { ...base, kind: "supported", group, tone: "info", title: "Someone else is affected too", line: `${i.id} · ${n.count} people on this report now` };
    case "dismissed":
      if (!mine) return null;
      return { ...base, kind: "dismissed", group: "decisions", tone: "warn", title: `${whose} was dismissed`, line: `${i.id} · ${n.reason || ""} · you can dispute this` };
    case "merged":
      if (!mine) return null;
      return { ...base, kind: "merged", group: "decisions", tone: "info", title: `Tracked under ${n.into}`, line: `${i.id} · someone reported the same problem first · you follow it in Saved` };
    case "restored":
      if (!mine) return null;
      return { ...base, kind: "restored", group: "decisions", tone: "ok", title: "Your report is back on the board", line: `${i.id} · ${i.title}` };
    case "decided": {
      if (n.req === "flag" || requesterOf(n, i, n.req).byId !== me) return null;
      const ok = n.verdict === "approved";
      const title = n.req === "dispute" ? (ok ? "Dispute upheld · your report is back" : "Dispute declined") : ok ? "Withdrawal approved" : "Withdrawal declined";
      return { ...base, kind: "decided", group: "decisions", tone: ok ? "ok" : "warn", title, line: `${i.id}${n.reason ? ` · ${n.reason}` : ` · ${i.title}`}` };
    }
    default:
      return null;
  }
}

// who asked (trails written before notices carried it: read it off the issue)
function requesterOf(n, i, type) {
  if (n.by || n.byId) return { by: n.by, byId: n.byId };
  const r = [...(i.requests || [])].reverse().find((x) => x.type === type && x.decided);
  return r ? { by: r.by, byId: r.byId } : {};
}

const RULES = { admin: forAdmin, staff: forStaff, citizen: forCitizen };

/* notes on the file (command to the field, the city to the reporter) */
function noteNotices(i, role, me) {
  const out = [];
  (i.comments || []).forEach((c) => {
    if (!c.createdAt || c.author === me.name) return;
    if (role === "staff" && i.assignedTo === me.name && c.role === "admin") {
      out.push({ key: `note-${c.id}`, at: c.createdAt, kind: "note", group: "work", tone: "info", title: "Note from command", line: `${i.id} · ${short(c.body, 80)}`, ref: { type: "issue", id: i.id, open: true }, zone: i.ward });
    }
    if (role === "citizen" && i.reporterId === me.id && !c.internal && (c.role === "admin" || c.role === "staff")) {
      out.push({ key: `note-${c.id}`, at: c.createdAt, kind: "note", group: "mine", tone: "info", title: "Update from the city", line: `${i.id} · ${short(c.body, 80)}`, ref: { type: "issue", id: i.id, mine: true }, zone: i.ward });
    }
  });
  return out;
}

/* service windows: closing (under 30% left) and breached */
function windowNotices(i, role, me, now) {
  if (i.removed || i.status === "resolved") return [];
  if (role === "citizen") return [];
  if (role === "staff" && i.assignedTo !== me.name) return [];
  const end = deadlineOf(i);
  if (!end) return [];
  const total = Number(i.slaHours);
  const out = [];
  const warnAt = end - total * WARN_SHARE * H;
  const who = i.assignedTo || "no crew yet";
  const ref = { type: "issue", id: i.id, open: true };
  if (role === "staff" && now >= warnAt) {
    out.push({ key: `win-${i.id}-${end}`, at: new Date(warnAt).toISOString(), kind: "window", group: "windows", tone: "warn", title: "Service window closing", line: `${i.id} · ${i.title} · under 30% of the ${total}h window left`, ref, zone: i.ward });
  }
  if (now >= end) {
    out.push({
      key: `br-${i.id}-${end}`, at: new Date(end).toISOString(), kind: "breach", group: role === "staff" ? "windows" : "breach", tone: "alert",
      title: "Service window breached", line: `${i.id} · ${i.title} · ${i.ward}${role === "admin" ? ` · ${who}` : ""}`, ref, zone: i.ward,
    });
  }
  return out;
}

/* possible duplicates (admin): one item per new report that repeats an older one */
function duplicateNotices(list) {
  const out = [];
  list.forEach((i) => {
    if (i.removed || i.status === "resolved") return;
    const hit = possibleDuplicates(i)[0];
    if (!hit) return;
    out.push({
      key: `dup-${i.id}`, at: i.createdAt, kind: "duplicate", group: "duplicate", tone: "warn", decide: true,
      title: "Possible duplicate", line: `${i.id} · ${i.title} · ${hit.m} m from ${hit.issue.id}, same category`,
      ref: { type: "issue", id: i.id }, zone: i.ward,
    });
  });
  return out;
}

/* Staff Desk (admin): pending clearance requests, and what the field did */
function deskNotices(audit, requests, me, since) {
  const out = (requests || []).map((r) => ({
    key: `clr-${r.id}`, at: r.filedAt, kind: "clearance", group: "desk", tone: "warn", decide: true,
    title: "Clearance request", line: `${r.name} · ${expertiseLabel(r.expertise)} · ${r.zone}`,
    ref: { type: "desk-queue" }, zone: r.zone,
  }));
  for (const e of audit) {
    if (day(e.at) < since) break;
    if (e.kind !== "desk" || e.actor === me.name) continue;
    out.push({
      key: `desk-${e.id}`, at: e.at, kind: "desk", group: "desk", tone: "info",
      title: e.verb === "uplink" ? "Field member uplinked" : e.verb === "duty" ? "Duty change" : "Staff Desk",
      line: e.action, ref: e.subject?.id ? { type: "desk", id: e.subject.id } : { type: "desk-queue" }, zone: e.subject?.zone || null,
    });
  }
  return out;
}

/* ------------------------------------------------------------------
   Community (citizen): proposals you made or back, polls in your zone,
   announcements and work notices for your zone, official responses.
   Your zone = the home zone on your account.
------------------------------------------------------------------- */
function communityForCitizen(c, me, issues, since, now) {
  if (!c) return [];
  const out = [];
  const zone = me.ward || "";
  const prop = new Map(c.proposals.map((p) => [p.id, p]));
  const poll = new Map(c.polls.map((p) => [p.id, p]));
  const ann = new Map(c.announcements.map((a) => [a.id, a]));
  const notice = new Map(c.notices.map((x) => [x.id, x]));
  const backs = (p) => p && (p.by.id === me.id || p.signals.some((s) => s.userId === me.id));
  const follows = (i) => i && (i.reporterId === me.id || (i.supporters || []).some((s) => s.id === me.id) || (i.savedBy || []).includes(me.id));
  const base = { group: "community" };
  for (const e of c.trail) {
    if (day(e.at) < since) break;
    if (e.actor === me.name) continue;
    const n = e.n || {};
    let hit = null;
    if (n.type === "decided" && backs(prop.get(n.ref))) {
      const p = prop.get(n.ref);
      const st = PROPOSAL_STATUS[n.status] || { label: n.status };
      hit = { kind: "proposal-decided", group: p.by.id === me.id ? "mine" : "following", tone: n.status === "notnow" ? "warn" : "ok", title: `Proposal decision: ${st.label}`, line: `${p.title}${p.decision?.reason ? ` · ${p.decision.reason}` : ""}`, ref: { type: "proposal", id: p.id }, zone: p.ward };
    } else if (n.type === "responded" && backs(prop.get(n.ref))) {
      const p = prop.get(n.ref);
      // citizens see the role that answered, never the person
      hit = { kind: "proposal-response", group: p.by.id === me.id ? "mine" : "following", tone: "info", title: p.by.id === me.id ? "Official response on your proposal" : "Official response on a proposal you back", line: `${p.title} · ${e.role === "staff" ? FIELD_CREW : CITY_COMMAND}`, ref: { type: "proposal", id: p.id }, zone: p.ward };
    } else if (n.type === "backed" && prop.get(n.ref)?.by.id === me.id) {
      const p = prop.get(n.ref);
      hit = { kind: "proposal-backed", group: "mine", tone: n.reached ? "ok" : "info", title: n.reached ? "Your proposal reached its target" : `Your proposal has ${n.residents} residents behind it`, line: p.title, ref: { type: "proposal", id: p.id }, zone: p.ward };
    } else if (n.type === "poll-opened") {
      const p = poll.get(n.ref);
      const src = p?.from?.type === "proposal" ? prop.get(p.from.id) : null;
      if (p && (p.ward === zone || p.ward === "all" || backs(src))) hit = { kind: "poll-opened", tone: "info", title: `New poll in ${p.ward === "all" ? "every zone" : p.ward}`, line: p.question, ref: { type: "poll", id: p.id }, zone: p.ward };
    } else if (n.type === "poll-closed") {
      const p = poll.get(n.ref);
      if (p && (p.votes?.[me.id] || p.ward === zone)) {
        const win = p.options.find((o) => o.id === p.outcome?.optionId);
        hit = { kind: "poll-closed", tone: "ok", title: "Poll result", line: `${p.question} · ${win ? win.label : "closed"}`, ref: { type: "poll", id: p.id }, zone: p.ward };
      }
    } else if (n.type === "announced") {
      const a = ann.get(n.ref);
      if (a && !a.hidden && a.audience.citizens && (a.zones.includes("all") || a.zones.includes(zone))) hit = { kind: "announcement", tone: "info", title: `Announcement · ${a.zones.includes("all") ? "every zone" : a.zones.join(", ")}`, line: a.title, ref: { type: "announcement", id: a.id }, zone: a.zones.includes("all") ? zone : a.zones[0] };
    } else if (n.type === "notice") {
      const x = notice.get(n.ref);
      const i = issues.find((y) => y.id === n.issueId);
      if (x && !x.hidden && (x.ward === zone || follows(i))) hit = { kind: "work-notice", tone: "warn", title: `Work notice · ${x.kind}`, line: `${x.ward} · ${x.note}`, ref: { type: "announcement", id: x.id }, zone: x.ward };
    }
    else if ((n.type === "checked" || n.type === "revisit") && c.issueSignals.some((x) => x.issueId === n.issueId && x.userId === me.id && x.kind === "still")) {
      const i = issues.find((y) => y.id === n.issueId);
      const chk = (c.checks || []).find((x) => x.id === n.ref);
      if (i) hit = { kind: n.type === "checked" ? "resolved" : "started", group: i.reporterId === me.id ? "mine" : "following", tone: n.type === "checked" ? "ok" : "info", title: n.type === "checked" ? "The crew checked again: it's fixed" : "The crew will take another look", line: `${i.id} · ${chk?.note || i.title}`, ref: { type: "issue", id: i.id, mine: i.reporterId === me.id }, zone: i.ward };
    }
    if (hit) out.push({ key: e.id, at: e.at, actor: e.actor, ...base, ...hit });
  }
  // a poll in your zone closes within 3 hours and you haven't voted
  c.polls.forEach((p) => {
    if ((p.ward !== zone && p.ward !== "all") || !pollOpen(p) || p.votes?.[me.id]) return;
    const end = day(p.closesAt);
    if (end - now > 3 * H) return;
    out.push({ key: `pollend-${p.id}`, at: new Date(end - 3 * H).toISOString(), ...base, kind: "poll-closing", tone: "warn", title: "Poll closes soon · you haven't voted", line: p.question, ref: { type: "poll", id: p.id }, zone: p.ward });
  });
  return out;
}

/* Community (admin): new proposals, targets reached, answers due, polls
   that ended without an outcome, "still happening" after a fix */
function communityForAdmin(c, me, issues, since, now) {
  if (!c) return [];
  const out = [];
  const prop = new Map(c.proposals.map((p) => [p.id, p]));
  for (const e of c.trail) {
    if (day(e.at) < since) break;
    if (e.actor === me.name) continue;
    const n = e.n || {};
    const p = prop.get(n.ref);
    let hit = null;
    if (n.type === "proposed" && p) hit = { kind: "proposal-new", tone: "info", title: "New proposal", line: `${p.id} · ${p.title} · ${p.ward}`, ref: { type: "proposal", id: p.id }, zone: p.ward };
    else if (n.type === "backed" && n.reached && p) hit = { kind: "proposal-target", tone: "warn", decide: p.status === "review", title: "Proposal reached its target", line: `${p.id} · ${p.title} · ${n.residents} residents`, ref: { type: "proposal", id: p.id }, zone: p.ward };
    else if (n.type === "responded" && e.role === "staff" && p) hit = { kind: "proposal-response", tone: "info", title: "Field crew responded on a proposal", line: `${p.id} · ${e.actor}`, ref: { type: "proposal", id: p.id }, zone: p.ward };
    else if (n.type === "notice") hit = { kind: "work-notice", tone: "info", title: "Work notice posted", line: `${e.actor} · ${n.issueId} · ${n.ward}`, ref: { type: "announcement", id: n.ref }, zone: n.ward };
    else if (n.type === "still") {
      const i = issues.find((x) => x.id === n.issueId);
      if (i) hit = { kind: "still", tone: "alert", title: "Still happening after the fix", line: `${i.id} · ${i.title} · ${e.actor}`, ref: { type: "issue", id: i.id }, zone: i.ward };
    } else if (n.type === "revisit") {
      const i = issues.find((x) => x.id === n.issueId);
      const chk = (c.checks || []).find((x) => x.id === n.ref);
      if (i) hit = { kind: "still", tone: "warn", decide: true, title: "Field crew asks to revisit", line: `${i.id} · ${e.actor} · ${chk?.note || i.title}`, ref: { type: "issue", id: i.id }, zone: i.ward };
    }
    if (hit) out.push({ key: e.id, at: e.at, actor: e.actor, group: "community", ...hit });
  }
  c.proposals.forEach((p) => {
    if (p.status !== "review") return;
    const due = answerDue(p).getTime();
    if (due > now) return;
    out.push({ key: `due-${p.id}`, at: new Date(due).toISOString(), group: "community", kind: "proposal-due", tone: "warn", decide: true, title: "Proposal answer overdue", line: `${p.id} · ${p.title} · ${p.ward}`, ref: { type: "proposal", id: p.id }, zone: p.ward });
  });
  c.polls.forEach((p) => {
    if (!pollEnded(p)) return;
    out.push({ key: `pollend-${p.id}`, at: p.closesAt, group: "community", kind: "poll-ended", tone: "warn", decide: true, title: "Poll ended · publish the outcome", line: `${p.id} · ${p.question}`, ref: { type: "poll", id: p.id }, zone: p.ward === "all" ? null : p.ward });
  });
  return out;
}

/* Community (field crew): announcements for the crews in your zones,
   "still happening" on a file you closed */
export function staffZones(me, issues) {
  const z = new Set([me.ward].filter(Boolean));
  issues.forEach((i) => { if (i.assignedTo === me.name && !i.removed && i.status !== "resolved") z.add(i.ward); });
  return z;
}
function communityForStaff(c, me, issues, since) {
  if (!c) return [];
  const out = [];
  const zones = staffZones(me, issues);
  const ann = new Map(c.announcements.map((a) => [a.id, a]));
  for (const e of c.trail) {
    if (day(e.at) < since) break;
    if (e.actor === me.name) continue;
    const n = e.n || {};
    let hit = null;
    if (n.type === "announced") {
      const a = ann.get(n.ref);
      if (a && !a.hidden && a.audience.staff && (a.zones.includes("all") || a.zones.some((z) => zones.has(z)))) hit = { kind: "announcement", tone: "info", title: `Announcement · ${a.zones.includes("all") ? "every zone" : a.zones.join(", ")}`, line: a.title, ref: { type: "announcement", id: a.id }, zone: a.zones.includes("all") ? null : a.zones[0] };
    } else if (n.type === "still" && n.owner === me.name) {
      const i = issues.find((y) => y.id === n.issueId);
      if (i) hit = { kind: "still", tone: "warn", title: "Still happening after your fix", line: `${i.id} · ${i.title} · a resident says it isn't fixed`, ref: { type: "community-check", id: i.id }, zone: i.ward };
    }
    if (hit) out.push({ key: e.id, at: e.at, actor: e.actor, group: "community", ...hit });
  }
  return out;
}

/* the whole inbox for one person, newest first */
export function buildInbox({ audit = [], issues = [], requests = [], community = null, me, now = Date.now() }) {
  const role = ROLE_OF[me?.role];
  if (!role || !me) return [];
  const since = now - KEEP_DAYS * 864e5;
  const byId = new Map(issues.map((i) => [i.id, i]));
  const rule = RULES[role];
  const out = [];

  for (const e of audit) {
    const t = day(e.at);
    if (t < since) break; // the trail is newest first
    if (!e.n || !e.issueId || e.actor === me.name) continue;
    const i = byId.get(e.issueId);
    if (!i) continue;
    const hit = rule(e, e.n, i, { me, t });
    if (hit) out.push({ key: e.id, at: e.at, actor: e.actor, ...hit });
  }
  issues.forEach((i) => {
    out.push(...noteNotices(i, role, me).filter((x) => day(x.at) >= since));
    out.push(...windowNotices(i, role, me, now).filter((x) => day(x.at) >= since));
  });
  if (role === "citizen") out.push(...communityForCitizen(community, me, issues, since, now));
  if (role === "staff") out.push(...communityForStaff(community, me, issues, since));
  if (role === "admin") {
    out.push(...communityForAdmin(community, me, issues, since, now));
    out.push(...duplicateNotices(issues));
    out.push(...deskNotices(audit, requests, me, since));
  }

  return out
    .map((x) => ({ ...x, t: day(x.at) }))
    .filter((x) => x.t <= now + 60000)
    .sort((a, b) => b.t - a.t);
}

/* ------------------------------------------------------------------
   Read state, per person: { c: cursor ms, r: [read keys], u: [unread keys] }
------------------------------------------------------------------- */
const RS = (id) => `inbox-read-${id}`;
const rsCache = new Map();
const rsSubs = new Set();
const rsPing = () => rsSubs.forEach((f) => f());

function loadRS(id) {
  if (!id) return { c: Date.now(), r: [], u: [] };
  if (rsCache.has(id)) return rsCache.get(id);
  let v = null;
  try { v = JSON.parse(localStorage.getItem(RS(id)) || "null"); } catch { v = null; }
  if (!v || typeof v.c !== "number") {
    v = { c: Date.now() - FIRST_LOOK_H * H, r: [], u: [] };
    try { localStorage.setItem(RS(id), JSON.stringify(v)); } catch { /* storage blocked: kept for this tab */ }
  }
  rsCache.set(id, v);
  return v;
}
const serverRS = () => SERVER_ON && getUser()?.source === "server";
let pushTimer = null;
function pushRS(v) {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => { api.put("/notifications/read-state", v).catch(() => { /* kept here; the next change sends it again */ }); }, 700);
}
function saveRS(id, v) {
  rsCache.set(id, v);
  try { localStorage.setItem(RS(id), JSON.stringify(v)); } catch { /* storage blocked: kept for this tab */ }
  rsPing();
  if (serverRS() && getUser()?.id === id) pushRS(v);
}

/* the account's read state wins (another device may have read more); a first sign-in sends this device's */
async function pullRS() {
  const me = getUser();
  if (!serverRS() || !me?.id) return;
  try {
    const { data } = await api.get("/notifications/read-state");
    if (data && typeof data.c === "number") {
      const v = { c: data.c, r: Array.isArray(data.r) ? data.r : [], u: Array.isArray(data.u) ? data.u : [] };
      rsCache.set(me.id, v);
      try { localStorage.setItem(RS(me.id), JSON.stringify(v)); } catch { /* storage blocked */ }
      rsPing();
    } else {
      pushRS(loadRS(me.id));
    }
  } catch { /* offline: this device's copy holds */ }
}
let rsWho = "";
subscribeRole(() => {
  const next = serverRS() ? `${getUser().id}` : "";
  if (next && next !== rsWho) pullRS();
  rsWho = next;
});
onEvent(EVENTS.NOTIFICATION_NEW, (e) => { if (e?.remote && e.type === "read") pullRS(); });
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (!e.key || !e.key.startsWith("inbox-read-")) return;
    rsCache.delete(e.key.slice("inbox-read-".length));
    rsPing();
  });
}

export const isUnread = (n, rs) => rs.u.includes(n.key) || (n.t > rs.c && !rs.r.includes(n.key));

export function markNotice(userId, key, read = true) {
  const v = loadRS(userId);
  const r = v.r.filter((k) => k !== key);
  const u = v.u.filter((k) => k !== key);
  saveRS(userId, read ? { ...v, r: [...r, key].slice(-400), u } : { ...v, r, u: [...u, key].slice(-200) });
}
export function markAllNotices(userId) {
  saveRS(userId, { c: Date.now(), r: [], u: [] });
}
export function useReadState(userId) {
  return useSyncExternalStore((cb) => { rsSubs.add(cb); return () => rsSubs.delete(cb); }, () => loadRS(userId), () => loadRS(userId));
}

/* one build shared by every screen (sidebar, page, menu, pins, drawers) */
let built = { audit: null, issues: null, requests: null, community: null, who: "", minute: 0, items: [] };
function sharedInbox(audit, issues, requests, community, me, minute) {
  const who = `${me?.id}|${me?.name}|${me?.role}|${me?.ward}`;
  if (built.audit === audit && built.issues === issues && built.requests === requests && built.community === community && built.who === who && built.minute === minute) return built.items;
  built = { audit, issues, requests, community, who, minute, items: buildInbox({ audit, issues, requests, community, me, now: Date.now() }) };
  return built.items;
}

/* everything a page needs: the inbox, unread flags and counts */
export function useInbox() {
  const me = useAuth();
  const audit = useAudit();
  const issues = useAllIssues();
  const desk = useDesk();
  const community = useCommunity();
  const minute = useMinute();
  const rs = useReadState(me?.id);
  const { text, v: names } = useNames();
  const prefs = useSettings();
  const muted = mutedGroups(ROLE_OF[me?.role], prefs).join("|");
  const items = sharedInbox(audit, issues, desk?.requests, community, me, minute);
  return useMemo(() => {
    const off = new Set(muted ? muted.split("|") : []);
    // people's names as they are called today (a rename shows in old notices too)
    const list = items.filter((n) => !off.has(n.group)).map((n) => ({ ...n, title: text(n.title), line: text(n.line), unread: isUnread(n, rs) }));
    const unreadIssues = new Set(list.filter((n) => n.unread && n.ref?.type === "issue").map((n) => n.ref.id));
    return { me, role: ROLE_OF[me?.role] || "citizen", items: list, unread: list.filter((n) => n.unread).length, unreadIssues };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, rs, me, names, muted]);
}

export function markNotices(userId, keys) {
  if (!keys.length) return;
  const v = loadRS(userId);
  const set = new Set(keys);
  saveRS(userId, { ...v, r: [...v.r.filter((k) => !set.has(k)), ...keys].slice(-400), u: v.u.filter((k) => !set.has(k)) });
}

/* opening a file is seeing its updates: everything about it is marked read */
export function useSeenFile(issueId) {
  const { me, items } = useInbox();
  useEffect(() => {
    if (!issueId || !me?.id) return;
    const keys = items.filter((n) => n.unread && n.ref?.type === "issue" && n.ref.id === issueId).map((n) => n.key);
    if (keys.length) markNotices(me.id, keys);
  }, [issueId, items, me?.id]);
}

/* where an item opens: { label, to, state } or { label, locked } (one rule for page, menu, alerts) */
export function noticeLink(n, role, from = "/notifications") {
  const r = n?.ref || {};
  if (r.type === "desk") return { label: "Staff Desk", to: "/admin/staff-desk", state: { target: r.id, from } };
  if (r.type === "desk-queue") return { label: "Clearance queue", to: "/admin/staff-desk", state: { tab: "queue" } };
  if (r.type === "proposal") return { label: r.id, to: "/community", state: { open: r.id } };
  if (r.type === "poll") return { label: "Poll", to: "/community", state: { poll: r.id } };
  if (r.type === "announcement") return { label: "Community", to: "/community", state: { focus: r.id } };
  if (r.type === "community-check") return { label: "Check it", to: "/community", state: { check: r.id } };
  if (r.type !== "issue") return null;
  if (role === "staff" && r.open === false) return { label: "Not on your desk", locked: true };
  if (role === "citizen" && r.mine === false) return { label: r.id, to: "/citizen/saved", state: { open: r.id } };
  return { label: r.id, to: fileLink(role, r.id, from) };
}

/* ==================================================================
   Field alerts (K1c): what changed on a crew's work, with its own
   "seen on Assigned Work" cursor. Kept as is; the inbox above is the
   full record, these drive the toasts and the New tags.
================================================================== */
const WEEK = 7 * 864e5;
const cursorKey = (name) => `notify-read-${name}`;

const listeners = new Set();
const ping = () => listeners.forEach((l) => l());
const subscribe = (cb) => { listeners.add(cb); return () => listeners.delete(cb); };

export function readCursor(name) {
  try { return Number(localStorage.getItem(cursorKey(name))) || 0; } catch { return 0; }
}
export function markRead(name, at = Date.now()) {
  if (!name) return;
  try { localStorage.setItem(cursorKey(name), String(at)); } catch { /* storage blocked: stays unread this session */ }
  ping();
}
export function useCursor(name) {
  return useSyncExternalStore(subscribe, () => readCursor(name), () => 0);
}
// another tab marked them read
if (typeof window !== "undefined") window.addEventListener("storage", (e) => { if (e.key && e.key.startsWith("notify-read-")) ping(); });

const reAway = (me) => new RegExp(`^Reassigned (ISS-\\d+) from ${me.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} to (.+?)(?: \\(| ·|$)`);

/* one entry per change on my work, newest first */
export function fieldNotices(audit, everything, me) {
  if (!me) return [];
  const away = reAway(me);
  const byId = new Map(everything.map((i) => [i.id, i]));
  const out = [];
  for (const e of audit || []) {
    const t = new Date(e.at).getTime();
    if (Date.now() - t > WEEK) break; // the trail is newest first
    if (e.actor === me) continue;
    const issue = e.issueId ? byId.get(e.issueId) : null;
    if (!issue) continue;
    const base = { key: e.id, at: e.at, t, issueId: issue.id, title: issue.title, ward: issue.ward, priority: issue.priority, slaHours: issue.slaHours };
    const a = e.action || "";
    if (e.kind === "dispatch" && e.to === me) out.push({ ...base, kind: "assigned", head: "New assignment", tone: "new" });
    else if (e.kind === "dispatch" && away.test(a)) out.push({ ...base, kind: "reassigned", head: `Reassigned to ${a.match(away)[2]}`, tone: "info" });
    else if (e.kind === "dispatch" && a.startsWith(`Unassigned ${issue.id} from ${me}`)) out.push({ ...base, kind: "unassigned", head: "Back in the dispatch queue", tone: "info" });
    else if (issue.assignedTo !== me) continue;
    else if (e.kind === "removal" && /^(Dismissed|Withdrew|Approved withdrawal|Approved invalid flag)/.test(a)) out.push({ ...base, kind: "removed", head: `Removed · ${issue.removed?.reason || "off the board"}`, tone: "info" });
    else if (e.kind === "removal" && /^Declined invalid flag/.test(a)) out.push({ ...base, kind: "flag-declined", head: "Flag declined", sub: a.split(" · ").slice(1).join(" · "), tone: "warn" });
    else if (e.kind === "status" && /^Sent ISS-\d+ back to the field/.test(a)) out.push({ ...base, kind: "sent-back", head: "Sent back by command", sub: a.split(": ").slice(1).join(": "), tone: "warn" });
    else if (e.kind === "status" && /^Confirmed close on/.test(a)) out.push({ ...base, kind: "closed", head: "Close confirmed", tone: "ok" });
  }
  return out;
}

export function useFieldUnread(audit, everything, me) {
  const cursor = useCursor(me);
  return useMemo(() => {
    const all = fieldNotices(audit, everything, me);
    const unread = all.filter((n) => n.t > cursor);
    return { all, unread, assigned: unread.filter((n) => n.kind === "assigned") };
  }, [audit, everything, me, cursor]);
}

/* the top bar's role slot shows "New · ISS-2413" for a moment */
let flash = null;
const flashListeners = new Set();
export function flashNew(item) {
  flash = { ...item, key: Date.now() };
  flashListeners.forEach((l) => l());
  setTimeout(() => { if (flash && Date.now() - flash.key >= 5900) { flash = null; flashListeners.forEach((l) => l()); } }, 6000);
}
export function useFlash() {
  return useSyncExternalStore((cb) => { flashListeners.add(cb); return () => flashListeners.delete(cb); }, () => flash, () => null);
}
