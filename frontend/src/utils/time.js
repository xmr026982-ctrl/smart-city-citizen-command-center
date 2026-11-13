/* ------------------------------------------------------------------
   One clock for the whole system: 24-hour, India Standard Time.

     clock(t)        22:01
     clockSec(t)     22:01:09
     day(t)          8 Nov
     dayYear(t)      8 Nov 2026
     weekDay(t)      Sun, 8 Nov
     weekClock(t)    Sun 22:01
     stamp(t)        8 Nov 2026 · 22:01
     stampShort(t)   8 Nov · 22:01
     cutoff(t)       Sun 8 Nov · 22:01 IST    (deadlines, "until", "ends")

   Every screen formats time through here, so the city reads one
   format everywhere, whatever the browser's own locale is.
------------------------------------------------------------------- */
export const TZ = "Asia/Kolkata";

const cache = new Map();
function fmt(opts) {
  const key = JSON.stringify(opts);
  if (!cache.has(key)) cache.set(key, new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hourCycle: "h23", ...opts }));
  return cache.get(key);
}

function parts(t) {
  const d = t instanceof Date ? t : new Date(t);
  if (Number.isNaN(d.getTime())) return null;
  const o = {};
  fmt({ weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    .formatToParts(d)
    .forEach((p) => { o[p.type] = p.value; });
  if (o.hour === "24") o.hour = "00";
  return o;
}

const safe = (fn) => (t) => {
  if (t === null || t === undefined || t === "") return "—";
  const p = parts(t);
  return p ? fn(p) : "—";
};

export const clock = safe((p) => `${p.hour}:${p.minute}`);
export const clockSec = safe((p) => `${p.hour}:${p.minute}:${p.second}`);
export const day = safe((p) => `${p.day} ${p.month}`);
export const dayYear = safe((p) => `${p.day} ${p.month} ${p.year}`);
export const weekDay = safe((p) => `${p.weekday}, ${p.day} ${p.month}`);
export const weekClock = safe((p) => `${p.weekday} ${p.hour}:${p.minute}`);
export const stamp = safe((p) => `${p.day} ${p.month} ${p.year} · ${p.hour}:${p.minute}`);
export const stampShort = safe((p) => `${p.day} ${p.month} · ${p.hour}:${p.minute}`);
export const cutoff = safe((p) => `${p.weekday} ${p.day} ${p.month} · ${p.hour}:${p.minute} IST`);

/* "2026-11-08": the IST calendar day, for grouping and date inputs */
export const dayKey = safe((p) => {
  const m = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" }[p.month];
  return `${p.year}-${m}-${String(p.day).padStart(2, "0")}`;
});

/* "HH:MM" in IST */
export const hm = clock;

/* Build a Date from an IST calendar day ("2026-11-08") and "HH:MM" */
export function fromIST(dateKey, time = "00:00") {
  if (!dateKey) return null;
  const d = new Date(`${dateKey}T${time}:00+05:30`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/* 24-hour slots for a time picker: ["00:00", "00:30", …] */
export function timeSlots(step = 30) {
  const out = [];
  for (let m = 0; m < 24 * 60; m += step) out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  return out;
}

/* Round a moment up to the next slot, in IST: 12:41 → 13:00 with step 30 */
export function nextSlot(t = Date.now(), step = 30) {
  const ms = step * 60000;
  return new Date(Math.ceil(new Date(t).getTime() / ms) * ms);
}
