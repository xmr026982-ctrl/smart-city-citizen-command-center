import { slaOf } from "./sla";
import { ZONES } from "../config/zones";
import { residentsOf } from "../store/communityStore";

/* ------------------------------------------------------------------
   City evidence for a proposal, from the city's own data (no opinion):
     reports   issues filed in the same zone and category (or naming the
               same place) in the last 90 days, and how many broke their
               service window
     air       the zone's live air quality (for public-space proposals)
     backing   residents against the target, and concerns raised
   The score (0-100) is the sum of the parts shown, so anyone can see
   why a proposal ranks where it does.
------------------------------------------------------------------- */
const DAYS90 = 90 * 864e5;
const words = (s) => String(s).toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 4);
const AIR = new Set(["other", "waste", "safety"]);

export function evidenceFor(p, issues, feed) {
  const since = Date.now() - DAYS90;
  const mine = new Set(words(`${p.title} ${p.summary}`));
  const related = issues.filter((i) => {
    if (i.ward !== p.ward || i.removed || new Date(i.createdAt).getTime() < since) return false;
    if (i.category === p.category && p.category !== "other") return true;
    return words(`${i.title} ${i.location || ""}`).some((w) => mine.has(w));
  });
  const breached = related.filter((i) => slaOf(i).state === "over" || (i.status === "resolved" && i.slaHours && resolvedLate(i))).length;
  const open = related.filter((i) => i.status !== "resolved").length;
  const zone = ZONES.find((z) => z.name === p.ward);
  const aqi = zone ? Math.round(feed?.zones?.[zone.id]?.aqi ?? 0) : 0;
  const residents = residentsOf(p);
  const concerns = p.concerns.length;

  const parts = [
    { id: "reports", label: "Reports here", value: Math.min(30, related.length * 6) },
    { id: "breached", label: "Missed windows", value: Math.min(15, breached * 5) },
    { id: "backing", label: "Resident backing", value: Math.round(Math.min(40, (residents / Math.max(1, p.target)) * 40)) },
    { id: "air", label: "Air quality", value: AIR.has(p.category) ? (aqi > 100 ? 10 : aqi > 75 ? 5 : 0) : 0 },
    { id: "concerns", label: "Concerns", value: -Math.round(Math.min(15, concerns * 2.5)) },
  ];
  const score = Math.max(0, Math.min(100, parts.reduce((s, x) => s + x.value, 0) + 5));
  return {
    score, parts, reports: related.length, open, breached, aqi, residents, concerns,
    linked: related.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 3).map((i) => i.id),
  };
}

function resolvedLate(i) {
  const done = [...(i.timeline || [])].reverse().find((t) => t.status === "resolved");
  return done ? (new Date(done.at) - new Date(i.createdAt)) / 36e5 > Number(i.slaHours) : false;
}