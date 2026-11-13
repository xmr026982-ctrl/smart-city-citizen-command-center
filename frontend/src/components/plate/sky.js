/* ------------------------------------------------------------------
   The sky over the model. "Live sky" follows the real sun over Kolkata
   (22.57° N, 88.36° E), from the clock: day after sunrise, the lit
   night city after dusk, and a warm blend through dawn and dusk. Day or
   Night can be pinned (Settings · Display & 3D, or the sun button on
   the model). Pure functions; the scene eases towards the target.
------------------------------------------------------------------- */
const LAT = 22.5726;
const LNG = 88.3639;
const RAD = Math.PI / 180;

/** Sun elevation above the horizon over Kolkata, in degrees (NOAA approximation, about ±0.5°). */
export function sunElevation(date = new Date()) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const day = Math.floor((date.getTime() - start) / 864e5);
  const hours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const g = ((2 * Math.PI) / 365) * (day - 1 + (hours - 12) / 24);
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g)
    + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const eqTime = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const solarMin = hours * 60 + eqTime + 4 * LNG;
  const ha = (solarMin / 4 - 180) * RAD;
  const cosZ = Math.sin(LAT * RAD) * Math.sin(decl) + Math.cos(LAT * RAD) * Math.cos(decl) * Math.cos(ha);
  return 90 - Math.acos(Math.min(1, Math.max(-1, cosZ))) / RAD;
}

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/**
 * { night, dusk, elevation } for a mode.
 *   night  0 = full day, 1 = full night (eased across civil twilight)
 *   dusk   0..1 warmth of dawn / dusk (peaks with the sun at the horizon)
 */
export function skyFor(mode = "auto", date = new Date()) {
  if (mode === "day") return { night: 0, dusk: 0, elevation: 45 };
  if (mode === "night") return { night: 1, dusk: 0, elevation: -20 };
  const e = sunElevation(date);
  return { night: smooth(5, -7, e), dusk: Math.max(0, 1 - Math.abs(e - 0.5) / 8), elevation: e };
}

export const SKY_MODES = ["auto", "day", "night"];
export const SKY_LABEL = { auto: "Live sky", day: "Day", night: "Night" };
