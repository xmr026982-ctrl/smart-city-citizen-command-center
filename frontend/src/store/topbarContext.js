import { useSyncExternalStore } from "react";

/* A page can put one short live tag next to its name in the top bar
   ("Issue Command · Shyambazar", "Report Issue · Ballygunge").
   Set it while the page shows that context, clear it on the way out. */
let tag = null;
const listeners = new Set();

export function setTopTag(next) {
  const v = next || null;
  if (v === tag) return;
  tag = v;
  listeners.forEach((l) => l());
}

export function useTopTag() {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => tag, () => tag);
}