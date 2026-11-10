import { useSyncExternalStore } from "react";

/* ------------------------------------------------------------------
   One shared clock for every time-based screen (service windows,
   "3h ago", uplink stalls). Ticks every 30 seconds while at least one
   screen is listening, then stops. Pages put the value in their memo
   deps so countdowns, breach counts and sorts stay live without an
   action on the board.
------------------------------------------------------------------- */

const TICK_MS = 30000;
let stamp = Date.now();
let timer = null;
const subs = new Set();

function subscribe(fn) {
  subs.add(fn);
  if (!timer) {
    stamp = Date.now();
    timer = setInterval(() => {
      stamp = Date.now();
      subs.forEach((f) => f());
    }, TICK_MS);
  }
  return () => {
    subs.delete(fn);
    if (!subs.size && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

const read = () => stamp;

// Returns the time of the last tick (ms). Changes every 30s.
export function useMinute() {
  return useSyncExternalStore(subscribe, read, read);
}