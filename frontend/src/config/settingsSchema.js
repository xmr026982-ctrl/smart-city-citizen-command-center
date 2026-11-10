// ============================================================================
//  SETTINGS SCHEMA: one definition per role. The Settings page is built from
//  this, so a new setting is one row here.
//
//  Every row does something today. row.scope says where it is kept:
//    "account"  saved to the account on the server (follows you to any device)
//    "device"   kept in this browser only (screen preferences)
//  Panels with their own logic (sign-in, alerts, roster, ...) are set by kind.
// ============================================================================
import { ZONES } from "./zones";
import { ZONES as ACCOUNT_ZONES } from "../services/authService";
import { isMash, MASH_MESSAGE } from "../utils/textGuard";

export const ROLE_META = {
  citizen: { label: "Citizen", code: "CTZ", acc: "#0284c7", console: "Citizen Console", clearance: "Level 1 · Public" },
  staff: { label: "Field Staff", code: "STF", acc: "#0d9488", console: "Field Console", clearance: "Level 2 · Operations" },
  admin: { label: "Administrator", code: "ADM", acc: "#7c3aed", console: "Command Console", clearance: "Level 3 · Command" },
};

export const WARDS = ZONES.map((z) => ({ v: z.id, l: z.name }));
/* the zones an account can belong to (the server accepts these six) */
export const HOME_ZONES = ACCOUNT_ZONES.map((name) => ({ v: ZONES.find((z) => z.name === name)?.id || name, l: name }));
export const zoneIdOf = (name) => ZONES.find((z) => z.name.toLowerCase() === String(name || "").toLowerCase())?.id || "";
export const zoneNameOf = (id) => ZONES.find((z) => z.id === id)?.name || "";

const PERF = [{ v: "high", l: "High" }, { v: "balanced", l: "Balanced" }, { v: "lite", l: "Lite" }];
const REFRESH = [{ v: 2.5, l: "2.5 s" }, { v: 5, l: "5 s" }, { v: 30, l: "30 s" }, { v: 60, l: "60 s" }];
const DUTY = [{ v: "on", l: "On duty" }, { v: "break", l: "On break" }, { v: "off", l: "Off duty" }];

/* sign out after this many idle minutes (0 = never). Command can't switch it off. */
export const IDLE_OPTIONS = {
  citizen: [{ v: 0, l: "Never" }, { v: 60, l: "1 h" }, { v: 240, l: "4 h" }],
  staff: [{ v: 30, l: "30 min" }, { v: 60, l: "1 h" }, { v: 240, l: "4 h" }, { v: 0, l: "Never" }],
  admin: [{ v: 15, l: "15 min" }, { v: 30, l: "30 min" }, { v: 60, l: "1 h" }],
};
const IDLE_DEFAULT = { citizen: 0, staff: 60, admin: 30 };

/* ---------------------------------------------------------------- shared sections */
const signin = (role) => ({
  id: "signin", code: "SEC", title: "Sign-in & Security", icon: "shield", kind: "signin",
  keywords: "email password change reset sessions devices sign out everywhere inactivity timeout security google",
  rows: [
    {
      key: "idleSignOut", type: "segmented", scope: "account", label: "Sign out when I'm away",
      hint: role === "admin"
        ? "Command desks always close after a quiet spell. Any click, key or scroll in any tab counts as activity."
        : "Closes the desk after this long with no activity. The server enforces it on every device.",
      options: IDLE_OPTIONS[role], def: IDLE_DEFAULT[role],
    },
  ],
});

const alerts = {
  id: "alerts", code: "ALR", title: "Alerts", icon: "bell", kind: "alerts",
  keywords: "notifications alerts pop-up popup quiet hours mute inbox groups community",
};

const display = {
  id: "display", code: "DSP", title: "Display & 3D", icon: "gauge", kind: "device",
  keywords: "performance 3d quality sky day night dark orbit refresh motion contrast animation speed lag device check fps",
  rows: [
    { key: "perfMode", type: "segmented", scope: "device", label: "3D quality", hint: "Detail of the 3D city. Lite keeps older laptops smooth; the city also drops detail on its own when frames slow down.", options: PERF, def: "balanced" },
    { key: "skyMode", type: "segmented", scope: "device", label: "City sky", hint: "Live sky follows the real sun over Kolkata: the day city after sunrise, the lit night city after dusk. Or keep it on Day or Night.", options: [{ v: "auto", l: "Live sky" }, { v: "day", l: "Day" }, { v: "night", l: "Night" }], def: "auto" },
    { key: "autoOrbit", type: "toggle", scope: "device", label: "Auto-orbit camera", hint: "Slowly turns the 3D city while you're idle.", def: true },
    { key: "reduceMotion", type: "toggle", scope: "device", label: "Reduce motion", hint: "Switches off animations and transitions across the app.", def: false },
    { key: "highContrast", type: "toggle", scope: "device", label: "High contrast", hint: "Stronger text and borders for easier reading.", def: false },
    { key: "feedInterval", type: "segmented", scope: "device", label: "Live data refresh", hint: "How often city readings update on your dashboard.", options: REFRESH, def: 2.5 },
    { key: "aqiStd", type: "segmented", scope: "device", label: "Air-quality scale", hint: "Which bands label air quality: India CPCB or US EPA.", options: [{ v: "cpcb", l: "India CPCB" }, { v: "epa", l: "US EPA" }], def: "cpcb" },
  ],
};

const visibility = { id: "visibility", code: "VIS", title: "Who Sees What", icon: "eye", kind: "visibility", keywords: "privacy visibility who can see photo email phone name" };
const data = { id: "data", code: "DAT", title: "Data & Account", icon: "database", kind: "data", keywords: "export download delete reset account data" };

/* ---------------------------------------------------------------- CITIZEN */
const citizen = [
  {
    id: "profile", code: "PRO", title: "Profile", icon: "user", keywords: "name display photo zone home ward profile",
    rows: [
      { key: "displayName", type: "text", scope: "account", label: "Display name", hint: "Shown on your reports, proposals and votes.", validate: "name", def: "" },
      { key: "homeWard", type: "select", scope: "account", label: "Home zone", hint: "Your dashboard opens here, and zone announcements, polls and work notices follow it.", options: HOME_ZONES, def: "" },
    ],
  },
  signin("citizen"), alerts, display, visibility, data,
];

/* ---------------------------------------------------------------- STAFF */
const staff = [
  {
    id: "profile", code: "PRO", title: "Profile & Clearance", icon: "user", kind: "roster", keywords: "name display photo rank expertise zone clearance",
    rows: [
      { key: "displayName", type: "text", scope: "account", label: "Display name", hint: "Shown to command and on your work notices.", validate: "name", def: "" },
    ],
  },
  {
    id: "duty", code: "DTY", title: "Duty", icon: "radio", keywords: "duty status on break off zone dashboard",
    rows: [
      { key: "dutyStatus", type: "segmented", scope: "account", label: "Duty status", hint: "Command dispatches new work only to crews on duty. The Staff Desk sees it at once.", options: DUTY, def: "on" },
      { key: "defaultZone", type: "select", scope: "device", label: "Dashboard opens on", hint: "The zone your Field Health dashboard shows first.", options: WARDS, def: "" },
    ],
  },
  signin("staff"), alerts, display, visibility, data,
];

/* ---------------------------------------------------------------- ADMIN */
const admin = [
  {
    id: "profile", code: "PRO", title: "Profile & Office", icon: "user", keywords: "name designation office profile photo",
    rows: [
      { key: "displayName", type: "text", scope: "account", label: "Display name", validate: "name", def: "" },
      { key: "designation", type: "text", scope: "account", validate: "text", label: "Designation", hint: "Shown to field crews and other command staff.", def: "City Operations Command" },
      { key: "office", type: "text", scope: "account", validate: "text", label: "Office", def: "Control Room, Kolkata" },
    ],
  },
  {
    id: "duty", code: "DTY", title: "Desk", icon: "radio", keywords: "duty status zone dashboard",
    rows: [
      { key: "dutyStatus", type: "segmented", scope: "device", label: "Status", hint: "Shown on your profile dot in the top bar.", options: DUTY, def: "on" },
      { key: "defaultZone", type: "select", scope: "device", label: "Dashboard opens on", hint: "The zone City Health shows first.", options: WARDS, def: "central" },
    ],
  },
  signin("admin"), alerts, display,
  { id: "access", code: "ROL", title: "Access by Role", icon: "users", kind: "roles", keywords: "roles permissions staff citizen capabilities matrix access" },
  { id: "diag", code: "DIA", title: "System Status", icon: "cpu", kind: "diag", keywords: "diagnostics status server feed health uptime sensors" },
  visibility, data,
];

export const SCHEMA = { citizen, staff, admin };

/* alert preferences (Alerts panel); saved to the account (settingsStore ACCOUNT_PREFS) */
const ALERT_DEFAULTS = { inboxMuted: [], popups: "all", quietHours: false, quietFrom: "22:00", quietTo: "07:00" };

export function defaultsFor(role) {
  const out = { ...ALERT_DEFAULTS, inboxMuted: [] };
  (SCHEMA[role] || []).forEach((sec) =>
    (sec.rows || []).forEach((r) => {
      if (r.key) out[r.key] = Array.isArray(r.def) ? [...r.def] : r.def;
    })
  );
  const prefersReduced = typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;
  return { ...out, reduceMotion: prefersReduced };
}

export const VALIDATORS = {
  name: (v) => (v.trim().length < 2 ? "Enter at least 2 characters." : v.trim().length > 40 ? "Keep it under 40 characters." : isMash(v) ? "Use a real name." : ""),
  text: (v) => (v.trim().length > 60 ? "Keep it under 60 characters." : isMash(v) ? MASH_MESSAGE : ""),
};
