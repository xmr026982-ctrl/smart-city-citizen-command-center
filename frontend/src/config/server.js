/* ------------------------------------------------------------------
   Where the backend lives. The one place the frontend reads it.

   Set in frontend/.env.local (never committed; see .env.example):
     VITE_API_URL=http://localhost:5000/api

   Required. Every account, report and reading comes from this server;
   requests go to this address and the live connection opens from it
   (see services/realtime.js). Without it, sign-in can't reach anything.

   The contract the backend builds to: docs/backend/BACKEND-HANDOVER.md
------------------------------------------------------------------- */

const raw = (import.meta.env?.VITE_API_URL || "").trim();

/** e.g. "http://localhost:5000/api" (no trailing slash), or "" when not set */
export const API_URL = raw.replace(/\/+$/, "");

/** true when a backend address is configured */
export const SERVER_ON = Boolean(API_URL);

/** the Socket.io address: the API address without its "/api" path */
export const SOCKET_URL = API_URL.replace(/\/api$/, "");

/* Keys the sign-in pages (Person 1) write after a successful login.
   The app reads the same keys, so a server login opens the right desk. */
export const TOKEN_KEY = "token";
export const USER_KEY = "user";

/** the three roles the system knows. Nothing else is accepted. */
export const ROLES = ["citizen", "staff", "admin"];

/** where each role lands after signing in */
export const ROLE_HOME = { citizen: "/citizen", staff: "/staff", admin: "/admin" };

/** The product name, everywhere it is shown */
export const PRODUCT = "Smart Kolkata";
export const SUPPORT_EMAIL = "supportsmartkolkata@gmail.com";
/* Opens Gmail with the support address (and a subject) filled in. A mailto: link
   does nothing on a computer with no mail app, so every support link uses this. */
export const supportMail = (subject = "") =>
  `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(SUPPORT_EMAIL)}${subject ? `&su=${encodeURIComponent(`${PRODUCT} · ${subject}`)}` : ""}`;
