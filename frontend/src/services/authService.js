import { api, ApiError } from "../lib/api";
import { SERVER_ON } from "../config/server";

/* ------------------------------------------------------------------
   Every sign-in call the public pages make. One place, so the backend
   contract lives in one file (docs/backend/BACKEND-HANDOVER.md · A2).

   Endpoints (auth and
   routes/staffRequestRoutes.js):
     POST  /auth/login                    { email, password, role, zone? }
     POST  /auth/register                 { name, email, password, zone }
     POST  /auth/google                   { idToken, zone? }
     POST  /auth/forgot-password          { email }
     POST  /auth/reset-password/:token    { password, confirmPassword }
     GET   /auth/me                       → { user }
     POST  /auth/logout
     POST  /staff-requests                { name, email, experience, expertise, zone, note }
     GET   /staff-requests/setup?token=   → { name, email, rank, expertise, zone, experience }
     POST  /staff-requests/set-password   { token, password }
     POST  /contact                       { name, email, issueType, message }

   Every call throws ApiError with the server's own message.
------------------------------------------------------------------- */

export const ZONES = ["Shyambazar", "B.B.D. Bagh", "Ballygunge", "College Street", "B.P. Township", "Dharmatala"];

/* staff application choices (stored as the server expects) */
export const EXPERIENCE = ["Field Active", "2 Years", "5 Years", "10 Years", "Senior Field"];
// one list for the whole system (config/expertise.js); the form sends the id ("electrical")
export { EXPERTISE } from "../config/expertise";

function need() {
  if (!SERVER_ON) throw new ApiError("Sign-in is offline right now. Please try again in a few minutes.", 0);
}

const clean = (email) => String(email || "").trim().toLowerCase();

/** role: "citizen" | "staff" | "admin". The server still decides. */
export async function signIn({ email, password, role, zone }) {
  need();
  const body = { email: clean(email), password, role: role === "citizen" ? "user" : role };
  if (zone) body.zone = zone;
  const { data } = await api.post("/auth/login", body);
  return data; // { user, session } (the session is set as an httpOnly cookie) or { requiresZone, email }
}

export async function register({ name, email, password, zone }) {
  need();
  const { data } = await api.post("/auth/register", { name: String(name).trim(), email: clean(email), password, zone });
  return data;
}

export async function googleSignIn({ idToken, zone }) {
  need();
  const { data } = await api.post("/auth/google", zone ? { idToken, zone } : { idToken });
  return data;
}

export async function forgotPassword(email) {
  need();
  const { data } = await api.post("/auth/forgot-password", { email: clean(email) });
  return data;
}

export async function resetPassword(token, password) {
  need();
  const { data } = await api.post(`/auth/reset-password/${encodeURIComponent(token)}`, { password, confirmPassword: password });
  return data;
}

export async function submitStaffRequest({ name, email, experience, expertise, zone, note }) {
  need();
  const { data } = await api.post("/staff-requests", {
    name: String(name).trim(),
    email: clean(email),
    experience,
    expertise,
    zone,
    note: String(note || "").trim(),
  });
  return data;
}

/** Who a setup link belongs to. The server answers only for a valid, unused link. */
export async function staffSetupInfo(token) {
  need();
  const { data } = await api.get(`/staff-requests/setup?token=${encodeURIComponent(token)}`);
  return data?.request || data;
}

export async function staffSetPassword(token, password) {
  need();
  const { data } = await api.post("/staff-requests/set-password", { token, password });
  return data;
}

export const CONTACT_TOPICS = [
  { id: "account", label: "Account or sign-in problem", tip: "Check the role you picked on the sign-in screen: a citizen account can't open the staff or admin desk." },
  { id: "registration", label: "Sign-up problem", tip: "Each email can hold one account. If you signed up with Google, use \"Continue with Google\" to sign in." },
  { id: "password", label: "Password or account recovery", tip: "Use \"Forgot password\" on the sign-in screen. The link works once and for a limited time." },
  { id: "staff", label: "Staff clearance or setup link", tip: "A setup link works once. If yours expired, the admin can send a new one from the Staff Desk." },
  { id: "technical", label: "Something isn't working", tip: "Tell us the page, what you clicked and what you saw. A refresh fixes most display problems." },
  { id: "feedback", label: "Feedback or an idea", tip: "Ideas for your zone work best as a proposal on the Community board once you're signed in." },
  { id: "other", label: "Something else", tip: "" },
];

export async function sendContact({ name, email, issueType, message }) {
  need();
  const { data } = await api.post("/contact", { name: String(name).trim(), email: clean(email), issueType, message: String(message).trim() });
  return data;
}

/* ------------------------------------------------------------------
   Password rules, the same on every screen that sets a password
   (sign-up, reset, staff setup). The server repeats them.
------------------------------------------------------------------- */
export const PASSWORD_RULES = [
  { id: "len", label: "10+ characters", test: (p) => p.length >= 10 },
  { id: "case", label: "Upper and lower case", test: (p) => /[a-z]/.test(p) && /[A-Z]/.test(p) },
  { id: "num", label: "A number", test: (p) => /\d/.test(p) },
  { id: "sym", label: "A symbol", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

/* Command (admin) passwords guard the whole city record: 16+ characters.
   The server holds the same line; this only shows it. */
export const COMMAND_MIN = 16;
export function rulesFor(desk) {
  if (desk !== "admin") return PASSWORD_RULES;
  return PASSWORD_RULES.map((r) => (r.id === "len" ? { id: "len", label: `${COMMAND_MIN}+ characters`, test: (p) => p.length >= COMMAND_MIN } : r));
}

export function passwordCheck(password = "", { email = "", name = "", desk = "" } = {}) {
  const p = String(password);
  const RULES = rulesFor(desk);
  const passed = RULES.filter((r) => r.test(p)).map((r) => r.id);
  const low = p.toLowerCase();
  const local = clean(email).split("@")[0];
  const personal = (local && local.length >= 4 && low.includes(local)) || String(name).toLowerCase().split(/\s+/).some((w) => w.length >= 4 && low.includes(w));
  const common = /^(password|passw0rd|qwerty|letmein|welcome|admin|kolkata|smartcity|smartkolkata|123456|abc123)[\d\W_]*$/i.test(p);
  const ok = passed.length === RULES.length && !personal && !common;
  const score = Math.min(4, passed.length - (personal || common ? 1 : 0));
  return { ok, passed, personal, common, score };
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
