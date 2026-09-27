import { useSyncExternalStore } from "react";
import { STAFF_ROSTER } from "../constants/issueConstants";

export const STAFF_TITLES = [
  "Field Operative",
  "Specialist",
  "Senior Specialist",
  "Zone Lead",
  "Command Fellow",
];

const KEY = "nexus_staff_titles_v1";

function seed() {
  const map = {};
  STAFF_ROSTER.forEach((name) => {
    map[name] = "Field Operative";
  });
  return map;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return seed();
    return { ...seed(), ...JSON.parse(raw) };
  } catch {
    return seed();
  }
}

let titles = load();
const listeners = new Set();

function emit() {
  localStorage.setItem(KEY, JSON.stringify(titles));
  listeners.forEach((fn) => fn());
}

export function getStaffTitle(name) {
  return titles[name] || "Field Operative";
}

export function setStaffTitle(name, title) {
  titles = { ...titles, [name]: title };
  emit();
}

export function useStaffTitles() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => titles,
    () => titles
  );
}