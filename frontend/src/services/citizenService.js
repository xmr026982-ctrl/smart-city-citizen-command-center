import { addIssue, dropPhotos, getIssues, nextIssueId, supportIssue, toggleSaved, looksLikeMash } from "../store/issueStore";
import { isServerBoard, fileIssue } from "./issueSync";
import { windowFor } from "../store/slaPolicyStore";
import { WARDS } from "../constants/issueConstants";
import { expertiseForCategory, expertiseLabel } from "../config/expertise";
import { isAwaiting } from "../store/staffDeskStore";

/* ------------------------------------------------------------------
   Citizen service: everything a citizen does with a report.
   Pages call these, never the store directly, so the rules live in
   one place and the backend can take over later without touching a page.

   fileReport      validate, stamp the service window from command's
                   table (Service Windows), file it, keep it stored
   similarReports  open reports that look like this one (same category,
                   same zone, nearby pin or the same words)
   meToo           "this affects me too": join an existing report instead
                   of filing a duplicate; you follow it from then on
   routeOf         where the report goes: the crew line, crews on duty in
                   the zone, the priority and the window it will get
   canView         a citizen sees their own reports and the ones they follow

   A citizen never sets the priority. A danger flag files the report as
   High (command can still raise or lower it); otherwise it starts Medium.
------------------------------------------------------------------- */

export const TITLE_MIN = 6;
export const TITLE_MAX = 90;
export const DESC_MIN = 20;
export const DESC_MAX = 600;
export const LANDMARK_MIN = 4;
export const LANDMARK_MAX = 120;
const NEAR_M = 600; // pins closer than this count as "nearby" for duplicates
const STOP = new Set(["the", "a", "an", "on", "in", "at", "of", "near", "and", "is", "for", "to", "by", "with", "from", "my", "our", "road", "street"]);

export const EMPTY_REPORT = { category: "", title: "", description: "", danger: false, ward: "", lat: null, lng: null, pinLabel: "", landmark: "" };

const clean = (text) => String(text || "").trim().replace(/\s+/g, " ");
const hasPin = (d) => Number.isFinite(d.lat) && Number.isFinite(d.lng);

/** Metres between two points. */
export function distanceM(a, b) {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** The nearest service zone to a point, with its distance in metres. */
export function nearestZone(point) {
  return WARDS
    .map((w) => ({ ward: w, m: distanceM(point, w) }))
    .sort((a, b) => a.m - b.m)[0];
}

/** Field problems in a draft (empty object = ready to file). */
export function validateReport(d) {
  const e = {};
  const title = clean(d.title);
  const desc = clean(d.description);
  const landmark = clean(d.landmark);
  if (!d.category) e.category = "Pick what kind of problem it is.";
  if (title.length < TITLE_MIN) e.title = `Give it a short title (at least ${TITLE_MIN} characters).`;
  else if (title.length > TITLE_MAX) e.title = `Keep the title under ${TITLE_MAX} characters.`;
  else if (looksLikeMash(title, { title: true })) e.title = "This doesn't describe a problem yet. Say what's wrong and where, for example \"Streetlight out near Park Street crossing\".";
  if (desc.length < DESC_MIN) e.description = `Say what you see and how bad it is (at least ${DESC_MIN} characters).`;
  else if (desc.length > DESC_MAX) e.description = `Keep it under ${DESC_MAX} characters.`;
  else if (looksLikeMash(desc)) e.description = "This doesn't describe a problem yet. Say what you see, since when, and how it affects people.";
  else if (desc.toLowerCase() === title.toLowerCase()) e.description = "Say more than the title: what you see, since when, and how it affects people.";
  if (!d.ward) e.ward = "Pick the zone it's in.";
  else if (!hasPin(d)) e.pin = "Pin the exact spot in the zone.";
  if (landmark.length < LANDMARK_MIN) e.landmark = "Add the nearest landmark or address so the crew can find it.";
  else if (landmark.length > LANDMARK_MAX) e.landmark = `Keep it under ${LANDMARK_MAX} characters.`;
  else if (looksLikeMash(landmark)) e.landmark = "Write a real landmark or address, for example \"Opposite the Ballygunge station gate\".";
  return e;
}

/** What makes each part of the form complete (for the step strip and the checklist). */
export function completeness(d) {
  const e = validateReport(d);
  return {
    what: !e.category && !e.title && !e.description,
    where: !e.ward && !e.pin && !e.landmark,
    errors: e,
    ready: Object.keys(e).length === 0,
  };
}

/** Where the report goes and what it is promised, before it is filed. */
export function routeOf(d, roster = []) {
  const priority = d.danger ? "high" : "medium";
  const line = d.category ? expertiseForCategory(d.category) : null;
  const crews = roster.filter((p) => !isAwaiting(p) && p.expertise === line);
  return {
    priority,
    line,
    lineLabel: line ? expertiseLabel(line) : null,
    window: d.category ? windowFor(priority, d.category) : windowFor(priority, null),
    crewInZone: d.ward ? crews.filter((p) => p.zone === d.ward && p.onDuty).length : 0,
    crewOnDuty: crews.filter((p) => p.onDuty).length,
  };
}

function words(text) {
  return new Set(clean(text).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w)));
}

/** Open reports that look like this draft. mine = your own, others = you can join with "me too". */
export function similarReports(d, user, issues = getIssues()) {
  if (!d.category || !d.ward) return { mine: [], others: [] };
  const mineWords = words(`${d.title} ${d.description}`);
  const found = issues
    .filter((i) => i.status !== "resolved" && i.category === d.category && i.ward === d.ward)
    .map((i) => {
      const m = hasPin(d) && Number.isFinite(i.lat) ? distanceM(d, i) : null;
      const shared = [...words(`${i.title} ${i.description}`)].filter((w) => mineWords.has(w)).length;
      const near = m !== null && m <= NEAR_M;
      return { issue: i, m, shared, score: (near ? 2 : 0) + Math.min(shared, 3) };
    })
    .filter((x) => x.score >= 2 || (x.m !== null && x.m <= NEAR_M))
    .sort((a, b) => b.score - a.score || (a.m ?? 9e9) - (b.m ?? 9e9))
    .slice(0, 3);
  const isMine = (i) => i.reporterId === user?.id;
  return {
    mine: found.filter((x) => isMine(x.issue)),
    others: found.filter((x) => !isMine(x.issue)),
  };
}

/**
 * File the report. Returns { ok, id, warning? } or { ok: false, errors }.
 * With the server it returns a Promise of the same: the server gives the
 * report its number, priority and window (docs/backend/BACKEND-HANDOVER.md · A7).
 */
export function fileReport(d, photos, user) {
  const errors = validateReport(d);
  if (Object.keys(errors).length) return { ok: false, errors };
  if (isServerBoard()) {
    return fileIssue({
      title: clean(d.title),
      description: clean(d.description),
      category: d.category,
      location: clean(d.landmark),
      ward: d.ward,
      lat: +Number(d.lat).toFixed(6),
      lng: +Number(d.lng).toFixed(6),
      danger: Boolean(d.danger),
    }, photos).then((r) => (r.ok
      ? { ok: true, id: r.issue.id, window: r.issue.slaHours, priority: r.issue.priority }
      : { ok: false, errors: { server: r.message } }));
  }
  const at = new Date().toISOString();
  const priority = d.danger ? "high" : "medium";
  const id = nextIssueId();
  const issue = {
    id,
    title: clean(d.title),
    description: clean(d.description),
    category: d.category,
    location: clean(d.landmark),
    ward: d.ward,
    lat: +Number(d.lat).toFixed(6),
    lng: +Number(d.lng).toFixed(6),
    photos: (photos || []).map(({ id: pid, name, url, w, h, kb }) => ({ id: pid, name, url, w, h, kb })),
    reportedBy: user.name,
    reporterId: user.id,
    status: "submitted",
    priority,
    danger: Boolean(d.danger),
    assignedTo: null,
    assignedAt: null,
    comments: [],
    timeline: [{ status: "submitted", at, by: user.name }],
    createdAt: at,
    updatedAt: at,
    savedBy: [],
    supporters: [],
    slaHours: windowFor(priority, d.category),
  };
  const stored = addIssue(issue);
  if (stored) return { ok: true, id, window: issue.slaHours, priority };
  // the browser is full (usually photos): keep the report, drop the photos
  const kept = issue.photos.length ? dropPhotos(id) : false;
  return {
    ok: true,
    id,
    window: issue.slaHours,
    priority,
    warning: kept
      ? "Your report is filed, but this browser had no room for the photos, so they were not kept."
      : "Your report is filed for this session, but this browser could not store it. Don't reload until the city system is connected.",
  };
}

/** "This affects me too": join an open report instead of filing a duplicate. */
export function meToo(id, user) {
  const ok = supportIssue(id, user);
  return ok ? { ok: true } : { ok: false, reason: "You're already on this report, or it's closed." };
}

export function toggleFollow(id, user) {
  toggleSaved(id, user?.id);
}

/* savedBy holds who saved a report: on your own report that's your star
   (Saved > Your reports), on someone else's it means you follow it. */
export const isFollowing = (issue, user) => Boolean(user && (issue.savedBy || []).includes(user.id));
export const isReporter = (issue, user) => Boolean(user && issue.reporterId === user.id);
export const isSupporter = (issue, user) => Boolean(user && (issue.supporters || []).some((s) => s.id === user.id));

/** A citizen sees their own reports and the ones they follow or joined. */
export function canView(issue, user) {
  return Boolean(issue && (isReporter(issue, user) || isFollowing(issue, user) || isSupporter(issue, user)));
}

/** People affected: the reporter plus everyone who said "me too". */
export const affected = (issue) => 1 + (issue.supporters || []).length;

/** Plain words for a category, used in titles and copy. */
