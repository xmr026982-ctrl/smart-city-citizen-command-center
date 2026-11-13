/* ------------------------------------------------------------------
   Service window (SLA) helpers shared by the admin command pages.
   state: "ok" | "warn" (under 30% of the window left) | "over" (breached)
          | "closed" (resolved) | "none" (no window set)
------------------------------------------------------------------- */

const HOUR = 36e5;

export function hoursSince(iso) {
  return iso ? Math.max(0, (Date.now() - new Date(iso).getTime()) / HOUR) : 0;
}

// 5 -> "5h", 50 -> "2d 2h", 300 -> "12d"
export function span(hours) {
  const h = Math.max(0, Math.round(hours));
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  const r = h % 24;
  return d >= 7 || !r ? `${d}d` : `${d}d ${r}h`;
}

export function slaOf(issue) {
  const total = Number(issue.slaHours) || 0;
  // off the board (withdrawn / dismissed): the clock stops
  if (issue.removed) return { state: "off", pct: 0, label: "Off the board", short: "Off", left: 0, total, sub: "Clock stopped" };
  if (issue.status === "resolved") return { state: "closed", pct: 100, label: "Closed", short: "Closed", left: 0, total };
  if (!total) return { state: "none", pct: 0, label: "No window", short: "—", left: 0, total };
  const used = hoursSince(issue.createdAt);
  const left = total - used;
  const pct = Math.min(100, Math.round((used / total) * 100));
  if (left < 0) return { state: "over", pct: 100, label: `${span(-left)} over`, short: `+${span(-left)}`, left, total, times: used / total };
  if (left < total * 0.3) return { state: "warn", pct, label: `${span(left)} left`, short: span(left), left, total };
  return { state: "ok", pct, label: `${span(left)} left`, short: span(left), left, total };
}

// Hours from report to resolution, or null if never resolved.
export function resolveHours(issue) {
  if (issue.status !== "resolved") return null;
  const done = [...(issue.timeline || [])].reverse().find((t) => t.status === "resolved");
  if (!done) return null;
  return Math.max(0, (new Date(done.at) - new Date(issue.createdAt)) / HOUR);
}

/* The field's clock: hours from report to the field's LAST close request
   before the confirmed close. Command's confirm time is not the crew's time,
   so a slow confirm never marks the crew late. If command sent a request
   back, only the request that finally got confirmed counts.
   Falls back to the confirm time for closes with no request on record. */
export function fieldCloseHours(issue) {
  if (issue.status !== "resolved") return null;
  const steps = issue.timeline || [];
  const doneAt = [...steps].reverse().findIndex((t) => t.status === "resolved");
  if (doneAt < 0) return null;
  const upto = steps.length - 1 - doneAt;
  const asked = [...steps.slice(0, upto)].reverse().find((t) => t.status === "pending_review");
  const at = asked ? asked.at : steps[upto].at;
  return Math.max(0, (new Date(at) - new Date(issue.createdAt)) / HOUR);
}

export const PRIORITY_RANK = { critical: 4, high: 3, medium: 2, low: 1 };

// Most urgent first: breached (most overdue first), then open by the least
// time left (the hours shown on screen), then no window, then closed.
// Ties go to the higher priority.
export function urgencyCompare(a, b) {
  const sa = slaOf(a);
  const sb = slaOf(b);
  const order = { over: 0, warn: 1, ok: 1, none: 2, closed: 3 };
  if (order[sa.state] !== order[sb.state]) return order[sa.state] - order[sb.state];
  if (sa.left !== sb.left) return sa.left - sb.left;
  return (PRIORITY_RANK[b.priority] || 0) - (PRIORITY_RANK[a.priority] || 0);
}