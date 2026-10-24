// ============================================================================
//  SETTINGS SERVICE: every call the Settings page makes to a server lives here.
//  DEMO = true  -> simulated (no backend yet).
//  Person 6 replaces each body with a real request, keeping the same signature.
//  Proposed endpoints (not in the project doc yet):
//    PATCH /api/users/me                    profile / preferences
//    POST  /api/users/me/email/request      { newEmail, password }  -> sends code
//    POST  /api/users/me/email/confirm      { code }
//    POST  /api/auth/change-password        { current, next, signOutOthers }
//    POST  /api/auth/2fa                    { enabled }
//    DELETE /api/auth/sessions/:id          revoke one   |  DELETE /api/auth/sessions  revoke others
//    GET   /api/users/me/export             personal data export
//    DELETE /api/users/me                   delete account
// ============================================================================
import { getFeed } from "./liveFeed";

export const DEMO = true;
export const DEMO_CODE = "123456";

const wait = (ms = 700) => new Promise((r) => setTimeout(r, ms));
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function requestEmailChange({ newEmail, password }) {
  await wait();
  if (!EMAIL_RE.test(newEmail)) throw new Error("Enter a valid email address.");
  if (!password) throw new Error("Enter your current password to continue.");
  return { sent: true };
}

export async function confirmEmailChange({ code }) {
  await wait(600);
  if (code !== DEMO_CODE) throw new Error("That code doesn't match. Try again.");
  return { ok: true };
}

export async function changePassword({ current, next }) {
  await wait(800);
  if (!current) throw new Error("Enter your current password.");
  if (current === next) throw new Error("Your new password must be different from the current one.");
  return { ok: true };
}

export async function setTwoFactor() { await wait(300); return { ok: true }; }
export async function revokeSession() { await wait(400); return { ok: true }; }
export async function revokeOtherSessions() { await wait(600); return { ok: true }; }
export async function backupNow() { await wait(1500); return { ok: true }; }
export async function deleteAccount() { await wait(900); return { ok: true }; }

// ------------------------------------------------------------- profile photo
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

// ------------------------------------------------------------- real, local helpers
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

export async function clearOfflineCache() {
  if (typeof caches === "undefined") return 0;
  const names = await caches.keys();
  await Promise.all(names.map((n) => caches.delete(n)));
  return names.length;
}

let deferredPrompt = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredPrompt = e; });
}
export async function installApp() {
  if (!deferredPrompt) throw new Error("Install isn't available yet. It needs the PWA build (service worker + manifest).");
  deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  deferredPrompt = null;
  return choice.outcome;
}

export function measureFps(ms = 700) {
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

export async function runSelfTest() {
  const out = [];
  try {
    localStorage.setItem("sc-selftest", "1");
    const ok = localStorage.getItem("sc-selftest") === "1";
    localStorage.removeItem("sc-selftest");
    out.push({ name: "Local storage", ok, detail: ok ? "read / write OK" : "blocked" });
  } catch {
    out.push({ name: "Local storage", ok: false, detail: "blocked" });
  }
  let gl = false;
  try {
    const c = document.createElement("canvas");
    gl = !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch { gl = false; }
  out.push({ name: "3D graphics (WebGL)", ok: gl, detail: gl ? "available" : "unavailable" });
  const feed = getFeed();
  const age = Math.round((Date.now() - feed.updatedAt) / 1000);
  out.push({ name: "Live data feed", ok: age < 75, detail: `${feed.mode} · updated ${age}s ago` });
  out.push({ name: "Network", ok: navigator.onLine, detail: navigator.onLine ? "online" : "offline" });
  const fps = await measureFps();
  out.push({ name: "Display smoothness", ok: fps >= 45, detail: fps ? `${fps} fps` : "tab hidden" });
  const sw = "serviceWorker" in navigator;
  out.push({ name: "Offline support", ok: sw, detail: sw ? "browser supports it" : "not supported" });
  return out;
}