import { useMemo } from "react";
import { useDesk, isAwaiting, uplinkPhase } from "./staffDeskStore";
import { useIssues } from "./issueStore";
import { expertiseForCategory, expertiseLabel } from "../config/expertise";

/* ------------------------------------------------------------------
   The link between the Staff Desk and Issue Management.
   One roster for the whole admin side, with live numbers from the
   issue board:
     load    = open issues assigned to them right now
     closed  = closedPrior (history) + issues resolved on this board
     onBoard = every issue on this board that is or was theirs
------------------------------------------------------------------- */

export const CAPACITY = 6; // open files one field operative can carry

export function withLive(roster, issues) {
  const tally = new Map();
  issues.forEach((issue) => {
    if (!issue.assignedTo) return;
    const t = tally.get(issue.assignedTo) || { load: 0, resolved: 0, open: [] };
    if (issue.status === "resolved") t.resolved += 1;
    else {
      t.load += 1;
      t.open.push(issue);
    }
    tally.set(issue.assignedTo, t);
  });
  return roster.map((p) => {
    const t = tally.get(p.name) || { load: 0, resolved: 0, open: [] };
    return {
      ...p,
      load: t.load,
      closed: (p.closedPrior || 0) + t.resolved,
      closedOnBoard: t.resolved,
      openIssues: t.open,
    };
  });
}

/* Same shape as useDesk(), but every roster entry carries live load/closed. */
export function useFieldRoster() {
  const desk = useDesk();
  const issues = useIssues();
  return useMemo(() => ({ ...desk, roster: withLive(desk.roster, issues) }), [desk, issues]);
}

/* Can this person take a new issue right now? */
export function availability(person) {
  if (isAwaiting(person)) {
    const phase = uplinkPhase(person);
    return { ok: false, code: "uplink", reason: phase === "stalled" ? "Uplink stalled · can't take work" : "Awaiting uplink · can't take work yet" };
  }
  if (person.load >= CAPACITY) return { ok: false, code: "full", reason: `At capacity · ${person.load}/${CAPACITY}` };
  if (!person.onDuty) return { ok: true, code: "off", reason: "Off duty" };
  return { ok: true, code: "ready", reason: "Ready" };
}

/* Rank the field for one issue: right expertise first, then same zone,
   then on duty, then lightest load. Unavailable people sink to the bottom. */
export function rankCandidates(roster, issue) {
  if (!issue) return [];
  const need = expertiseForCategory(issue.category);
  return roster
    .map((person) => {
      const avail = availability(person);
      const match = person.expertise === need;
      const zone = person.zone === issue.ward;
      let score = 0;
      if (avail.ok) score += 1000;
      if (match) score += 400;
      if (zone) score += 120;
      if (person.onDuty) score += 80;
      score += (CAPACITY - Math.min(CAPACITY, person.load)) * 15;
      return { person, avail, match, zone, score, need, needLabel: expertiseLabel(need) };
    })
    .sort((a, b) => b.score - a.score || a.person.name.localeCompare(b.person.name));
}

/* Best available person for an issue, or null. */
export function bestFor(roster, issue) {
  const top = rankCandidates(roster, issue)[0];
  return top && top.avail.ok && top.match ? top : null;
}

/* Off-expertise check for an owned, open issue.
   Returns { person, need, needLabel, hasLabel } when the owner's
   expertise is not what the issue needs, otherwise null. */
export function mismatchOf(issue, roster) {
  if (!issue || !issue.assignedTo || issue.status === "resolved") return null;
  const person = roster.find((p) => p.name === issue.assignedTo);
  if (!person) return null; // not on the roster: shown separately as "Not on roster"
  const need = expertiseForCategory(issue.category);
  if (person.expertise === need) return null;
  return { person, need, needLabel: expertiseLabel(need), hasLabel: expertiseLabel(person.expertise) };
}

/* ------------------------------------------------------------------
   Audit → person. Staff Desk events carry a subject snapshot; older
   events (saved before that) are matched by the name in the action.
------------------------------------------------------------------- */

const NAME_PATTERNS = [
  [/^Cleared (.+?) as /, "cleared"],
  [/^Rejected clearance for (.+?) ·/, "rejected"],
  [/^Removed the Verified badge from (.+)$/, "verify"],
  [/^Removed (.+?) from the field/, "removed"],
  [/^(?:Promoted|Moved) (.+?) (?:to|back to) /, "rank"],
  [/^Gave (.+?) the Verified badge/, "verify"],
  [/^(.+?) uplinked/, "uplink"],
  [/^Activation key for (.+?) was not sent/, "key"],
];

// "Priyanka Das" -> "PRIYANKA" (full first name, never cut)
export const fileCode = (name = "") => (name.trim().split(/\s+/)[0] || "STAFF").toUpperCase();

/* Who a desk event is about: { id, name, verb, snapshot, person (live or null), code } or null. */
export function subjectOf(event, roster = []) {
  if (!event || event.kind !== "desk") return null;
  let name = event.subject?.name || "";
  let verb = event.verb || "";
  if (!name || !verb) {
    const hit = NAME_PATTERNS.map(([re, v]) => [event.action.match(re), v]).find(([m]) => m);
    if (hit) {
      name = name || hit[0][1].trim();
      verb = verb || hit[1];
    }
  }
  if (!name) return null;
  const id = event.subject?.id || "";
  const person = roster.find((p) => (id && p.id === id) || p.name === name) || null;
  const prefix = verb === "rejected" ? "REQ" : "STF";
  return { id: id || person?.id || "", name, verb, snapshot: event.subject || null, person, code: `${prefix}-${fileCode(name)}` };
}

function sameSubject(a, b) {
  if (!a || !b) return false;
  return (a.id && b.id && a.id === b.id) || a.name === b.name;
}

/* Everything the audit trail knows about one person, newest first. */
export function eventsAbout(subject, audit) {
  return audit.filter((e) => sameSubject(subjectOf(e), subject));
}

/* The record of someone who is no longer on the roster (removed or rejected).
   Built from the snapshots their events carried. */
export function personRecord(subject, audit) {
  const mine = eventsAbout(subject, audit);
  const end = mine.find((e) => ["removed", "rejected"].includes(subjectOf(e).verb));
  const endVerb = end ? subjectOf(end).verb : "";
  const snapshot = end?.subject || mine.find((e) => e.subject)?.subject || {};
  const cleared = [...mine].reverse().find((e) => subjectOf(e).verb === "cleared");
  const releasedText = end?.action.match(/· (\d+) open issue/);
  return {
    ...snapshot,
    id: snapshot.id || subject.id,
    name: snapshot.name || subject.name,
    state: endVerb || "unknown",
    at: end?.at || null,
    by: end?.actor || "",
    clearedAt: snapshot.acceptedAt || cleared?.at || null,
    released: snapshot.released ?? (releasedText ? Number(releasedText[1]) : 0),
    code: subject.code || `${endVerb === "rejected" ? "REQ" : "STF"}-${fileCode(snapshot.name || subject.name)}`,
    events: mine,
  };
}