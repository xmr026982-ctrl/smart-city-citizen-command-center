import { useSyncExternalStore } from "react";

/* ------------------------------------------------------------------
   One app-wide notice for the server's answers that no page is waiting
   for (a change refused, a list that couldn't load). The page already
   showed the change; this says why it was put back.
   Shown by components/layout/ServerNotice.jsx.
------------------------------------------------------------------- */
let current = null;
let timer = null;
const listeners = new Set();
const ping = () => listeners.forEach((fn) => fn());

export function serverNotice(text) {
  if (!text) return;
  current = { text: String(text), at: Date.now() };
  clearTimeout(timer);
  timer = setTimeout(() => { current = null; ping(); }, 7000);
  ping();
}

export function dismissNotice() {
  clearTimeout(timer);
  current = null;
  ping();
}

export function useNotice() {
  return useSyncExternalStore(
    (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    () => current,
    () => null
  );
}
