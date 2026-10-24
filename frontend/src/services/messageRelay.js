import { useSyncExternalStore } from "react";

// ============================================================================
//  MESSAGE RELAY: how admin / staff / citizens message each other.
//
//  RULES (the server must enforce these, this demo only imitates them):
//   1. Nobody ever receives another person's raw email or phone. The SERVER looks the
//      address up from the recipient id and sends from a system address.
//   2. Every message is stored in the app (in-app notification = the real record).
//      The email is only a copy, and only if the recipient's channels include email.
//   3. Citizens see "City Control Room" / "Assigned field crew", never a person's name.
//   4. Every send is logged (who, when, which issue).
//
//  Proposed endpoints:  POST /api/messages   GET /api/messages/inbox   PATCH /api/messages/:id/read
// ============================================================================

const wait = (ms = 500) => new Promise((r) => setTimeout(r, ms));

// who may message whom
const ALLOWED = { admin: ["citizen", "staff", "admin"], staff: ["admin", "citizen"], citizen: ["admin"] };

const keyOf = (role, id) => `sc-inbox:${role}:${id}`;
const cache = new Map();
const listeners = new Set();
const subscribe = (cb) => { listeners.add(cb); return () => listeners.delete(cb); };

function read(role, id) {
  const k = keyOf(role, id);
  if (!cache.has(k)) {
    let arr = [];
    try { arr = JSON.parse(localStorage.getItem(k) || "[]"); } catch { arr = []; }
    cache.set(k, arr);
  }
  return cache.get(k);
}

function write(role, id, arr) {
  const k = keyOf(role, id);
  const next = arr.slice(-100);
  cache.set(k, next);
  try { localStorage.setItem(k, JSON.stringify(next)); } catch { /* storage blocked */ }
  listeners.forEach((l) => l());
}

function senderLabel(from, toRole) {
  if (toRole === "citizen") return from.role === "admin" ? "City Control Room" : "Assigned field crew";
  return from.label || (from.role === "admin" ? "Control room" : "Field staff");
}

// from: { role, label? }   to: { role, id }   (NEVER pass an email address)
export async function sendRelayMessage({ from, to, issueId = null, subject = "", body = "", emailCopy = true }) {
  await wait();
  if (!body.trim()) throw new Error("Write a message first.");
  if (!(ALLOWED[from.role] || []).includes(to.role)) throw new Error("You can't message that role directly.");
  if (from.role === "staff" && to.role === "citizen" && !issueId) throw new Error("Staff can message a citizen only about an assigned issue.");

  const msg = {
    id: `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    ts: Date.now(),
    from: { role: from.role, label: senderLabel(from, to.role) },
    issueId,
    subject: subject.trim(),
    body: body.trim(),
    read: false,
    channels: { inapp: true, email: !!emailCopy },
  };
  write(to.role, to.id, [...read(to.role, to.id), msg]);
  return { id: msg.id, delivered: msg.channels.email ? ["inapp", "email"] : ["inapp"] };
}

export const getInbox = (role, id) => read(role, id);
export const useInbox = (role, id) => useSyncExternalStore(subscribe, () => read(role, id));
export const unreadCount = (role, id) => read(role, id).filter((m) => !m.read).length;

export function markRead(role, id, msgId) {
  write(role, id, read(role, id).map((m) => (m.id === msgId ? { ...m, read: true } : m)));
}