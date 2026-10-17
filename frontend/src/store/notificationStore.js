import { useSyncExternalStore } from "react";

let items = [];
const listeners = new Set();

function emit() {
  listeners.forEach((fn) => fn());
}

export function pushToast(message) {
  items = [{ id: Date.now(), message }, ...items].slice(0, 5);
  emit();
}

export function useToasts() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => items,
    () => items
  );
}