import { useSyncExternalStore } from "react";
import { getRole } from "./authStore";
import { getSettings } from "./settingsStore";
import { ZONES, DEFAULT_ZONE_ID } from "../config/zones";

// ONE shared "active zone" for the top bar, the 3D city and the KPI cards.
// It starts on the zone saved in Settings (citizen: Home ward, staff/admin: Default dashboard zone)
// and follows that setting whenever it changes.
const listeners = new Set();
let activeId = null;
let seededFrom = "";

const valid = (id) => ZONES.some((z) => z.id === id);

function startZone() {
  const s = getSettings();
  const pick = s.homeWard || s.defaultZone;
  return valid(pick) ? pick : DEFAULT_ZONE_ID;
}

export function getActiveZoneId() {
  const seed = `${getRole() || ""}:${startZone()}`;
  if (activeId === null || seed !== seededFrom) {
    activeId = startZone();
    seededFrom = seed;
  }
  return activeId;
}

export function setActiveZone(id) {
  if (!valid(id) || id === getActiveZoneId()) return;
  activeId = id;
  listeners.forEach((l) => l());
}

const subscribe = (cb) => { listeners.add(cb); return () => listeners.delete(cb); };
export const useActiveZone = () => useSyncExternalStore(subscribe, getActiveZoneId);