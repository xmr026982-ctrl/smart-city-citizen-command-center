// ============================================================================
//  SETTINGS SCHEMA: one definition per role. The Settings page is built from this,
//  so adding a setting = adding one row here (no UI code).
//
//  row.tag:  "live" = takes effect immediately in this frontend
//            "sync" = saved on this device now, applies once the backend is connected
// ============================================================================
import { ZONES } from "./zones";

export const ROLE_META = {
  citizen: { label: "Citizen", code: "CTZ", acc: "#0ea5e9", console: "Citizen Console", clearance: "Level 1 · Public" },
  staff: { label: "Field Staff", code: "STF", acc: "#14b8a6", console: "Field Console", clearance: "Level 2 · Operations" },
  admin: { label: "Administrator", code: "ADM", acc: "#7c3aed", console: "Command Console", clearance: "Level 3 · Command" },
};

export const WARDS = ZONES.map((z) => ({ v: z.id, l: z.name }));
const PERF = [{ v: "high", l: "High" }, { v: "balanced", l: "Balanced" }, { v: "lite", l: "Lite" }];
const REFRESH = [{ v: 2.5, l: "2.5 s" }, { v: 5, l: "5 s" }, { v: 30, l: "30 s" }, { v: 60, l: "60 s" }];
const CHANNELS = [{ v: "push", l: "Push" }, { v: "email", l: "Email" }, { v: "sms", l: "SMS" }];
const CATEGORIES = [
  { v: "road", l: "Road damage" }, { v: "garbage", l: "Garbage" }, { v: "water", l: "Water leakage" },
  { v: "light", l: "Street light" }, { v: "encroach", l: "Encroachment" }, { v: "other", l: "Other" },
];
const LAYERS = [{ v: "aqi", l: "Air quality" }, { v: "traffic", l: "Traffic" }, { v: "water", l: "Water" }, { v: "power", l: "Power" }, { v: "works", l: "Civic works" }, { v: "issues", l: "Reported issues" }];

// ---------------------------------------------------------------- shared sections
const email = { id: "email", code: "MAIL", title: "Email Address", icon: "mail", kind: "email", keywords: "email gmail address change verify" };
const password = { id: "password", code: "PASS", title: "Password", icon: "key", kind: "password", keywords: "password change strength sign out" };

const security = (extra = []) => ({
  id: "security", code: "SEC", title: "Security & Sessions", icon: "shield", kind: "security",
  keywords: "two factor 2fa sessions devices sign out passkey biometric login alert",
  rows: [
    { key: "twoFactor", type: "toggle", label: "Two-step verification", hint: "Ask for a one-time code from an authenticator app when signing in.", def: false, tag: "sync" },
    { key: "biometric", type: "toggle", label: "Passkey / biometric sign-in", hint: "Use fingerprint or face unlock on this device instead of typing a password.", def: false, tag: "sync" },
    { key: "loginAlerts", type: "toggle", label: "Alert me about new sign-ins", hint: "Get a message when your account is opened on a new device.", def: true, tag: "sync" },
    ...extra,
  ],
});

const display = {
  id: "display", code: "DSP", title: "Display & Performance", icon: "gauge",
  keywords: "performance 3d quality orbit refresh motion contrast animation speed lag",
  rows: [
    { key: "perfMode", type: "segmented", label: "3D performance mode", hint: "Sets the city renderer's resolution. Pick Lite on older laptops.", options: PERF, def: "balanced", tag: "live" },
    { key: "autoOrbit", type: "toggle", label: "Auto-orbit camera", hint: "Slowly rotates the 3D city while you are idle.", def: true, tag: "live" },
    { key: "feedInterval", type: "segmented", label: "Live data refresh", hint: "How often dashboard readings update.", options: REFRESH, def: 2.5, tag: "live" },
    { key: "reduceMotion", type: "toggle", label: "Reduce motion", hint: "Switches off animations and transitions across the app.", def: false, tag: "live" },
    { key: "highContrast", type: "toggle", label: "High contrast", hint: "Stronger text and borders for easier reading. Stays on the white theme.", def: false, tag: "live" },
    { key: "aqiStd", type: "segmented", label: "Air-quality scale", hint: "Which AQI bands label the dashboard (India CPCB or US EPA).", options: [{ v: "cpcb", l: "India CPCB" }, { v: "epa", l: "US EPA" }], def: "cpcb", tag: "live" },
  ],
};

const dataSection = ({ extra = [], deletable = true } = {}) => ({
  id: "data", code: "DAT", title: "Data & Account", icon: "database", keywords: "export download delete cache install app offline backup",
  rows: [
    { type: "action", action: "exportData", label: "Download my settings", hint: "Saves everything on this page as a JSON file.", button: "Download JSON" },
    { type: "action", action: "clearCache", label: "Clear offline cache", hint: "Frees storage used by the installable app. Your settings are kept.", button: "Clear cache" },
    { type: "action", action: "installApp", label: "Install as an app", hint: "Add Smart City to your home screen or desktop. Needs the PWA build.", button: "Install" },
    ...extra,
    ...(deletable ? [{ type: "action", action: "deleteAccount", label: "Delete my account", hint: "Removes your profile and settings. This cannot be undone.", button: "Delete…", danger: true }] : []),
  ],
});

const visibility = { id: "visibility", code: "VIS", title: "Who Can See My Information", icon: "eye", kind: "visibility", keywords: "privacy visibility who can see photo email phone name" };

// Admin-only: feed health + self-test (WebGL, storage, network, real FPS).
const diag = { id: "diag", code: "DIA", title: "System Diagnostics", icon: "cpu", kind: "diag", keywords: "diagnostics self test fps feed status webgl network health" };

// ---------------------------------------------------------------- CITIZEN
const citizen = [
  {
    id: "profile", code: "PRO", title: "Profile & Ward", icon: "user", keywords: "name phone ward zone home profile",
    rows: [
      { key: "displayName", type: "text", label: "Display name", hint: "Shown on your reports and votes.", validate: "name", def: "KB Citizen", tag: "live" },
      { key: "phone", type: "text", label: "Mobile number", hint: "Optional. Used only for SMS alerts.", validate: "phone", placeholder: "+91 98xxxxxxx", def: "", tag: "sync" },
      { key: "homeWard", type: "select", label: "Home ward / zone", hint: "Your dashboard opens on this zone and your feed is personalised to it.", options: WARDS, def: "central", tag: "live" },
    ],
  },
  email, password, security(),
  {
    id: "alerts", code: "ALR", title: "Alerts & Notifications", icon: "bell", keywords: "notification push email sms nearby quiet hours air quality alert radius",
    rows: [
      { key: "channels", type: "chips", label: "Delivery channels", hint: "Where we reach you.", options: CHANNELS, def: ["push", "email"], tag: "sync" },
      { key: "categories", type: "chips", label: "What to tell me about", options: [{ v: "nearby", l: "Issues near me" }, { v: "mine", l: "My report status" }, { v: "community", l: "Community votes" }, { v: "health", l: "City health alerts" }], def: ["nearby", "mine", "community", "health"], tag: "sync" },
      { key: "nearbyRadius", type: "segmented", label: "“Near me” radius", options: [{ v: 0.5, l: "500 m" }, { v: 1, l: "1 km" }, { v: 2, l: "2 km" }, { v: 5, l: "5 km" }], def: 1, tag: "sync" },
      { key: "aqiAlert", type: "slider", label: "Air-quality alert level", hint: "Warn me when AQI goes above this value.", min: 50, max: 300, step: 10, unit: " AQI", def: 150, tag: "sync" },
      { key: "quietHours", type: "toggle", label: "Quiet hours", hint: "Hold non-urgent alerts overnight.", def: true, tag: "sync" },
      { key: "quietFrom", type: "time", label: "Quiet from", def: "22:00", tag: "sync" },
      { key: "quietTo", type: "time", label: "Quiet until", def: "07:00", tag: "sync" },
    ],
  },
  {
    id: "reporting", code: "RPT", title: "Issue Reporting", icon: "pin", keywords: "report issue location photo category upload quality",
    rows: [
      { key: "autoLocate", type: "toggle", label: "Auto-detect my location", hint: "Pre-fills the map pin when you start a report.", def: true, tag: "sync" },
      { key: "attachGps", type: "toggle", label: "Attach GPS to photos", def: true, tag: "sync" },
      { key: "defaultCategory", type: "select", label: "Default category", options: CATEGORIES, def: "road", tag: "sync" },
      { key: "mediaQuality", type: "segmented", label: "Photo & video quality", options: [{ v: "saver", l: "Data saver" }, { v: "std", l: "Standard" }, { v: "orig", l: "Original" }], def: "std", tag: "sync" },
    ],
  },
  {
    id: "privacy", code: "PRV", title: "Privacy & Community", icon: "lock", keywords: "privacy location sharing anonymous name contribution history feed photo",
    rows: [
      { key: "locationShare", type: "segmented", label: "Location sharing", hint: "Precision of the location attached to what you post.", options: [{ v: "precise", l: "Precise" }, { v: "ward", l: "Ward only" }, { v: "off", l: "Off" }], def: "ward", tag: "sync" },
      { key: "publicName", type: "segmented", label: "Name on proposals", options: [{ v: "real", l: "My name" }, { v: "anon", l: "Anonymous" }], def: "real", tag: "sync" },
      { key: "showHistory", type: "toggle", label: "Show my contribution history", hint: "Reports and votes appear on my public profile.", def: true, tag: "sync" },
      { key: "personalFeed", type: "toggle", label: "Personalised feed", hint: "Rank updates by my ward and past activity.", def: true, tag: "sync" },
      { key: "shareAvatar", type: "toggle", label: "Show my photo to city staff", hint: "Off by default. Anonymous reports never show a photo.", def: false, tag: "sync" },
    ],
  },
  visibility,
  { ...display, rows: [...display.rows, { key: "mapLayers", type: "chips", label: "Default map layers", options: LAYERS, def: ["aqi", "traffic", "issues"], tag: "sync" }] },
  dataSection(),
];

// ---------------------------------------------------------------- STAFF
const staff = [
  {
    id: "profile", code: "PRO", title: "Profile & Rank", icon: "user", keywords: "name phone rank employee id emergency contact",
    rows: [
      { key: "displayName", type: "text", label: "Display name", validate: "name", def: "KB Staff", tag: "live" },
      { key: "employeeId", type: "readonly", label: "Employee ID", hint: "Issued by the control room.", note: "Read-only", def: "STF-2047" },
      { key: "rank", type: "readonly", label: "Rank", hint: "Assigned by the admin in Staff Desk. You cannot change it here.", note: "Set by admin", def: "Field Operative" },
      { key: "phone", type: "text", label: "Mobile number", validate: "phone", placeholder: "+91 98xxxxxxx", def: "", tag: "sync" },
      { key: "emergencyName", type: "text", label: "Emergency contact name", hint: "Only you can see this.", def: "", tag: "sync" },
      { key: "emergencyPhone", type: "text", label: "Emergency contact number", validate: "phone", def: "", tag: "sync" },
    ],
  },
  email, password, security([{ key: "pinOnLaunch", type: "toggle", label: "Ask for PIN when the app opens", hint: "Recommended for shared or field devices.", def: false, tag: "sync" }]),
  {
    id: "duty", code: "DTY", title: "Duty & Availability", icon: "radio", keywords: "duty shift status zones tasks availability on break",
    rows: [
      { key: "dutyStatus", type: "segmented", label: "Duty status", hint: "Dispatch only assigns work to staff who are on duty.", options: [{ v: "on", l: "On duty" }, { v: "break", l: "On break" }, { v: "off", l: "Off duty" }], def: "on", tag: "sync" },
      { key: "shiftStart", type: "time", label: "Shift starts", def: "09:00", tag: "sync" },
      { key: "shiftEnd", type: "time", label: "Shift ends", def: "17:00", tag: "sync" },
      { key: "defaultZone", type: "select", label: "Default dashboard zone", hint: "The zone your dashboard opens on.", options: WARDS, def: "central", tag: "live" },
      { key: "assignedZones", type: "readonly", label: "Assigned zones", hint: "Chosen by the control room.", note: "Set by admin", options: WARDS, def: ["central", "esplanade"] },
      { key: "maxTasks", type: "readonly", label: "Task limit", hint: "Maximum open tasks the control room allows you.", note: "Set by admin", unit: " tasks", def: 5 },
    ],
  },
  {
    id: "dispatch", code: "DSP", title: "Dispatch Alerts", icon: "siren", keywords: "dispatch alerts assignment sla escalation sound vibration",
    rows: [
      { key: "dispatchEvents", type: "chips", label: "Alert me for", options: [{ v: "assign", l: "New assignment" }, { v: "sla", l: "SLA warning" }, { v: "escalate", l: "Escalation" }, { v: "comment", l: "Citizen comment" }, { v: "update", l: "Status change" }], def: ["assign", "sla", "escalate"], tag: "sync" },
      { key: "dispatchChannels", type: "chips", label: "Channels", options: CHANNELS, def: ["push", "sms"], tag: "sync" },
      { key: "slaWarn", type: "slider", label: "SLA warning lead time", hint: "Warn me this long before a task is due.", min: 5, max: 60, step: 5, unit: " min", def: 15, tag: "sync" },
      { key: "alertSound", type: "toggle", label: "Alert sound", def: true, tag: "sync" },
      { key: "alertVibrate", type: "toggle", label: "Vibration", def: true, tag: "sync" },
    ],
  },
  {
    id: "field", code: "FLD", title: "Field Mode", icon: "pin", keywords: "field location sharing battery offline queue photo quick status",
    rows: [
      { key: "shareLocation", type: "toggle", label: "Share live location while on duty", hint: "Lets dispatch route the nearest crew.", def: true, tag: "sync" },
      { key: "locInterval", type: "segmented", label: "Location update rate", options: [{ v: 10, l: "10 s" }, { v: 30, l: "30 s" }, { v: 60, l: "60 s" }], def: 30, tag: "sync" },
      { key: "batterySaver", type: "toggle", label: "Battery saver", hint: "Lower update rate and dim live effects.", def: false, tag: "sync" },
      { key: "offlineQueue", type: "toggle", label: "Queue updates when offline", hint: "Status changes send automatically once you reconnect.", def: true, tag: "sync" },
      { key: "mediaQuality", type: "segmented", label: "Site photo quality", options: [{ v: "saver", l: "Data saver" }, { v: "std", l: "Standard" }, { v: "orig", l: "Original" }], def: "std", tag: "sync" },
      { key: "quickStatus", type: "toggle", label: "Quick status buttons", hint: "One-tap Acknowledged / In progress / Resolved in the task list.", def: true, tag: "sync" },
    ],
  },
  visibility, display, dataSection(),
];

// ---------------------------------------------------------------- ADMIN
const admin = [
  {
    id: "profile", code: "PRO", title: "Profile & Office", icon: "user", keywords: "name phone designation office profile",
    rows: [
      { key: "displayName", type: "text", label: "Display name", validate: "name", def: "KB Admin", tag: "live" },
      { key: "designation", type: "text", label: "Designation", def: "Chief Operations Officer", tag: "sync" },
      { key: "office", type: "text", label: "Office", def: "Control Room, Kolkata", tag: "sync" },
      { key: "phone", type: "text", label: "Mobile number", validate: "phone", placeholder: "+91 98xxxxxxx", def: "", tag: "sync" },
    ],
  },
  email, password,
  security([
    { key: "sessionTimeout", type: "segmented", label: "Auto sign-out after inactivity", options: [{ v: 15, l: "15 min" }, { v: 30, l: "30 min" }, { v: 60, l: "1 hour" }, { v: 240, l: "4 hours" }], def: 30, tag: "sync" },
    { key: "auditTrail", type: "toggle", label: "Record admin actions", hint: "Keeps an audit trail of every status and policy change.", def: true, tag: "sync" },
  ]),
  {
    id: "city", code: "CTY", title: "City Configuration", icon: "sliders", keywords: "city thresholds alert aqi traffic water power zone default",
    rows: [
      { key: "cityName", type: "text", label: "City name", def: "Kolkata", tag: "sync" },
      { key: "defaultZone", type: "select", label: "Default dashboard zone", hint: "The zone your dashboard opens on.", options: WARDS, def: "central", tag: "live" },
      { key: "thAqi", type: "slider", label: "Flag a zone when AQI is above", min: 80, max: 300, step: 10, unit: " AQI", def: 100, tag: "sync" },
      { key: "thTraffic", type: "slider", label: "Flag a zone when traffic flow is below", min: 30, max: 80, step: 5, unit: " %", def: 60, tag: "sync" },
      { key: "thWater", type: "slider", label: "Flag a zone when water supply is below", min: 60, max: 95, step: 5, unit: " %", def: 85, tag: "sync" },
      { key: "thPower", type: "slider", label: "Flag a zone when power supply is below", min: 60, max: 98, step: 2, unit: " %", def: 90, tag: "sync" },
    ],
  },
  {
    id: "moderation", code: "MOD", title: "Moderation Rules", icon: "wrench", keywords: "moderation approve photo duplicate profanity ai sla acknowledge",
    rows: [
      { key: "autoApprove", type: "segmented", label: "New reports", hint: "How reports reach the public map.", options: [{ v: "manual", l: "Manual review" }, { v: "light", l: "Light review" }, { v: "auto", l: "Auto-approve" }], def: "light", tag: "sync" },
      { key: "requirePhoto", type: "toggle", label: "Require photo evidence", def: true, tag: "sync" },
      { key: "dupRadius", type: "slider", label: "Duplicate detection radius", hint: "Merge similar reports closer than this.", min: 25, max: 500, step: 25, unit: " m", def: 100, tag: "sync" },
      { key: "profanity", type: "toggle", label: "Profanity filter", def: true, tag: "sync" },
      { key: "aiCategorize", type: "toggle", label: "AI auto-categorisation", hint: "Suggest a category from the photo and description.", def: false, tag: "sync" },
      { key: "slaAck", type: "slider", label: "Acknowledge within", hint: "Target time before a report is picked up.", min: 1, max: 24, step: 1, unit: " h", def: 4, tag: "sync" },
    ],
  },
  {
    id: "roles", code: "ROL", title: "Roles & Permissions", icon: "users", kind: "roles", keywords: "roles permissions staff citizen capabilities matrix",
    rows: [
      { key: "staffCanClose", type: "toggle", label: "Staff can mark issues Resolved", def: true, tag: "sync" },
      { key: "citizenEdit", type: "toggle", label: "Citizens can edit a report for 10 minutes", def: true, tag: "sync" },
      { key: "citizenVote", type: "toggle", label: "Citizens can vote on proposals", def: true, tag: "sync" },
    ],
  },
  {
    id: "escalation", code: "ESC", title: "Escalation & Alerts", icon: "siren", keywords: "escalation critical alerts digest channels",
    rows: [
      { key: "criticalChannels", type: "chips", label: "Critical alert channels", options: CHANNELS, def: ["push", "email", "sms"], tag: "sync" },
      { key: "escalateAfter", type: "slider", label: "Escalate unacknowledged issues after", min: 5, max: 120, step: 5, unit: " min", def: 30, tag: "sync" },
      { key: "dailyDigest", type: "toggle", label: "Daily summary email", def: true, tag: "sync" },
      { key: "digestTime", type: "time", label: "Send summary at", def: "08:00", tag: "sync" },
    ],
  },
  dataSection({
    deletable: false,
    extra: [
      { key: "retention", type: "segmented", label: "Keep issue history for", options: [{ v: 30, l: "30 days" }, { v: 90, l: "90 days" }, { v: 365, l: "1 year" }], def: 90, tag: "sync" },
      { key: "maskPii", type: "toggle", label: "Mask personal details in tables", def: true, tag: "sync" },
      { type: "action", action: "exportAudit", label: "Download audit trail", hint: "Every setting changed on this device, as CSV.", button: "Download CSV" },
      { type: "action", action: "backupNow", label: "Back up now", hint: "Starts a manual backup of city data.", button: "Back up" },
    ],
  }),
  visibility, display, diag,
];

export const SCHEMA = { citizen, staff, admin };

export const ROLE_DEFAULTS = {
  citizen: { email: "citizen.demo@gmail.com" },
  staff: { email: "staff.demo@gmail.com" },
  admin: { email: "admin.demo@gmail.com", twoFactor: true },
};

export function defaultsFor(role) {
  const out = {};
  (SCHEMA[role] || []).forEach((sec) =>
    (sec.rows || []).forEach((r) => {
      if (r.key) out[r.key] = Array.isArray(r.def) ? [...r.def] : r.def;
    })
  );
  const prefersReduced = typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;
  return { ...out, reduceMotion: prefersReduced, ...ROLE_DEFAULTS[role] };
}

export const VALIDATORS = {
  name: (v) => (v.trim().length < 2 ? "Enter at least 2 characters." : v.trim().length > 40 ? "Keep it under 40 characters." : ""),
  phone: (v) => (v.trim() === "" || /^\+?[0-9 ]{8,15}$/.test(v.trim()) ? "" : "Use 8–15 digits, optionally starting with +."),
};