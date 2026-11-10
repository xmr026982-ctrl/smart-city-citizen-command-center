// ============================================================================
//  SETTINGS SERVICE: every call the Settings page makes to the server, and
//  the checks it runs on this device. One place, so the contract lives in
//  one file (docs/backend/BACKEND-HANDOVER.md · A4).
//
//  Account (needs a server sign-in; the server checks the token and role):
//    PATCH  /users/me                     { displayName?, zone?, designation?, office?, avatar? } -> { user }
//    POST   /auth/change-password         { currentPassword, newPassword }  -> { token? }
//    POST   /auth/change-email            { newEmail, password }            -> sends a link to newEmail
//    POST   /auth/confirm-email           { token }                         -> { user? }
//    POST   /auth/forgot-password         { email }        (staff: a reset link to their own work email)
//    GET    /auth/sessions                                                  -> { sessions: [...] }
//    DELETE /auth/sessions/:id
//    POST   /auth/logout-all
//    DELETE /users/me                     { password? }   (citizens only)
//
//  Every call throws ApiError with the server's own message.
// ============================================================================
import { api, ApiError } from "../lib/api";
import { SERVER_ON } from "../config/server";
import { getUser } from "../store/authStore";
import { getFeed } from "./liveFeed";
import { EMAIL_RE } from "./authService";

/** true when the person is signed in through the server (not a developer desk) */
export const onServer = () => SERVER_ON && getUser()?.source === "server";

function need() {
  if (!onServer()) throw new ApiError("Account changes need a server sign-in. This desk is running on sample data.", 0);
}

const clean = (email) => String(email || "").trim().toLowerCase();

/* ------------------------------------------------------------- account */

/** Save profile fields to the account. Resolves with the server's account object (or null). */
export async function saveProfile(patch) {
  need();
  const { data } = await api.patch("/users/me", patch);
  return data?.user || null;
}

export async function requestEmailChange({ newEmail, password }) {
  need();
  const email = clean(newEmail);
  if (!EMAIL_RE.test(email)) throw new ApiError("Enter a valid email address.", 400);
  if (email === clean(getUser()?.email)) throw new ApiError("That's already your email address.", 400);
  if (!password) throw new ApiError("Enter your current password to continue.", 400);
  const { data } = await api.post("/auth/change-email", { newEmail: email, password });
  return data;
}

/** From the link in the confirmation email (/confirm-email?token=…). Works signed in or not. */
export async function confirmEmailChange(token) {
  if (!SERVER_ON) throw new ApiError("The server isn't reachable right now.", 0);
  const { data } = await api.post("/auth/confirm-email", { token });
  return data;
}

export async function changePassword({ current, next }) {
  need();
  if (!current) throw new ApiError("Enter your current password.", 400);
  if (current === next) throw new ApiError("Your new password must be different from the current one.", 400);
  const { data } = await api.post("/auth/change-password", { currentPassword: current, newPassword: next });
  return data;
}

/** Staff and command: a one-time reset link to the email on file. */
export async function sendOwnResetLink() {
  need();
  const { data } = await api.post("/auth/forgot-password", { email: clean(getUser()?.email) });
  return data;
}

/** Devices signed in to this account. null = the server doesn't list them. */
export async function listSessions() {
  need();
  try {
    const { data } = await api.get("/auth/sessions");
    const list = Array.isArray(data) ? data : data?.sessions;
    return Array.isArray(list) ? list : null;
  } catch (err) {
    if (err?.status === 404) return null;
    throw err;
  }
}

export async function revokeSession(id) {
  need();
  await api.delete(`/auth/sessions/${encodeURIComponent(id)}`);
}

export async function signOutEverywhere() {
  need();
  await api.post("/auth/logout-all");
}

export async function deleteAccount({ password } = {}) {
  need();
  await api.delete("/users/me", { body: password ? { password } : {} });
}

/* ------------------------------------------------------------- profile photo */
const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];

// Validates, centre-crops to a square, resizes and re-encodes as JPEG.
// Re-encoding strips hidden metadata (e.g. GPS location) from the photo. SVG is rejected on purpose.
export async function processAvatar(file, size = 256) {
  if (!file || !AVATAR_TYPES.includes(file.type)) throw new Error("Use a JPG, PNG or WebP image.");
  if (file.size > 5 * 1024 * 1024) throw new Error("That image is over 5 MB. Choose a smaller one.");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("That file couldn't be read as an image."));
      i.src = url;
    });
    const side = Math.min(img.width, img.height);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* ------------------------------------------------------------- this device */
export function deviceName() {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "Device";
  const br = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  return `${os} · ${br}`;
}

export function downloadFile(name, text, mime = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function measureFps(ms = 900) {
  return new Promise((resolve) => {
    let frames = 0;
    const t0 = performance.now();
    const guard = setTimeout(() => resolve(0), 3000); // tab hidden = rAF paused
    const loop = (t) => {
      frames += 1;
      if (t - t0 >= ms) { clearTimeout(guard); resolve(Math.round((frames * 1000) / (t - t0))); }
      else requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
}

function webgl() {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") || c.getContext("webgl");
    if (!gl) return { ok: false, gpu: "" };
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const gpu = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || "") : "";
    return { ok: true, v2: typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext, gpu };
  } catch {
    return { ok: false, gpu: "" };
  }
}

/* "SwiftShader", "llvmpipe", "Basic Render": the browser is drawing 3D without a graphics chip */
const SOFTWARE_GPU = /swiftshader|llvmpipe|software|basic render|microsoft basic/i;

/**
 * Checks this device and recommends a 3D quality.
 * { checks: [{ name, ok, detail }], fps, recommend: "high"|"balanced"|"lite", reason }
 */
export async function checkDevice() {
  const checks = [];
  const gl = webgl();
  const software = gl.ok && SOFTWARE_GPU.test(gl.gpu);
  checks.push({ name: "3D graphics", ok: gl.ok && !software, detail: !gl.ok ? "not available" : software ? "software only" : gl.v2 ? "WebGL 2" : "WebGL 1" });
  const cores = navigator.hardwareConcurrency || 0;
  const memory = navigator.deviceMemory || 0; // Chrome and Edge only, rounded
  checks.push({ name: "Processor", ok: !cores || cores >= 4, detail: cores ? `${cores} threads` : "not reported" });
  if (memory) checks.push({ name: "Memory", ok: memory >= 4, detail: `about ${memory} GB` });
  const fps = await measureFps();
  checks.push({ name: "Smoothness", ok: fps >= 45, detail: fps ? `${fps} fps` : "tab was hidden" });
  checks.push({ name: "Network", ok: navigator.onLine, detail: navigator.onLine ? "online" : "offline" });
  let ls = false;
  try {
    localStorage.setItem("sk-selftest", "1");
    ls = localStorage.getItem("sk-selftest") === "1";
    localStorage.removeItem("sk-selftest");
  } catch { ls = false; }
  checks.push({ name: "Local storage", ok: ls, detail: ls ? "working" : "blocked: settings won't be kept" });

  let recommend = "balanced";
  let reason = "A steady picture with good detail.";
  if (!gl.ok || software || (fps && fps < 40) || (memory && memory < 4) || (cores && cores < 4)) {
    recommend = "lite";
    reason = !gl.ok || software ? "This browser draws 3D without a graphics chip." : "This device is working hard; Lite keeps the city smooth.";
  } else if (fps >= 55 && (!memory || memory >= 8) && (!cores || cores >= 8)) {
    recommend = "high";
    reason = "This device has room for full detail.";
  }
  return { checks, fps, recommend, reason };
}

/** Admin: health of the live data feed. */
export function feedHealth() {
  const feed = getFeed();
  const age = Math.round((Date.now() - feed.updatedAt) / 1000);
  return { mode: feed.mode, age, ok: age < 75 };
}
