import { useSyncExternalStore } from "react";
import { STAFF_ROSTER } from "../constants/issueConstants";

export const EXPERTISE = [
  { id: "electrical", label: "Electrician", matches: ["electrical", "lighting", "power"] },
  { id: "roads", label: "Road Works", matches: ["roads", "road", "pothole", "footpath"] },
  { id: "waste", label: "Waste", matches: ["waste", "garbage", "sanitation"] },
  { id: "water", label: "Water & Drainage", matches: ["water", "drainage", "sewer"] },
  { id: "civic", label: "Civic General", matches: ["civic", "other", "general"] },
];

const KEY = "issue-staff-expertise-v1";

const SEED = {
  "Koushik Bhowmik": "electrical",
  "Subhomoy Ghosh": "roads",
  "Taras Hembram": "waste",
  "Sayan Majumder": "electrical",
  "Swarup Sutradhar": "water",
};

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...SEED };
    return { ...SEED, ...JSON.parse(raw) };
  } catch {
    return { ...SEED };
  }
}

let map = load();
const listeners = new Set();

function emit() {
  localStorage.setItem(KEY, JSON.stringify(map));
  listeners.forEach((fn) => fn());
}

export function expertiseLabel(id) {
  return EXPERTISE.find((e) => e.id === id)?.label || "Unassigned";
}

export function matchesExpertise(expertiseId, category) {
  const exp = EXPERTISE.find((e) => e.id === expertiseId);
  if (!exp || !category) return false;
  const key = String(category).toLowerCase();
  return exp.matches.some((m) => key.includes(m));
}

export function getStaffExpertise(name) {
  return map[name] || null;
}

export function useStaffExpertise() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => map,
    () => map
  );
}