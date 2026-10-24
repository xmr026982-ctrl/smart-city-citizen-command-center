import { useSyncExternalStore } from "react";

const KEY = "staff-desk-roster-v4";

export const RANKS = [
  "Field Operative",
  "Specialist",
  "Senior Specialist",
  "Zone Lead",
  "Command Fellow",
];

export const EXPERTISE = [
  { id: "electrical", label: "Electrician", matches: ["electrical", "lighting", "power"] },
  { id: "roads", label: "Road Works", matches: ["roads", "road", "pothole", "footpath"] },
  { id: "waste", label: "Waste", matches: ["waste", "garbage", "sanitation"] },
  { id: "water", label: "Water & Drainage", matches: ["water", "drainage", "sewer"] },
  { id: "civic", label: "Civic General", matches: ["civic", "other", "general"] },
];

export const EXPERIENCE = [
  "Trainee",
  "Field Active",
  "2 Years",
  "5 Years",
  "10 Years",
  "Senior Field",
];

export const ZONES = [
  "Shyambazar",
  "B.B.D. Bagh",
  "Ballygunge",
  "College Street",
  "B.P. Township",
  "Dharmatala",
];

const SEED_ROSTER = [
  { id: "stf-koushik", name: "Koushik Bhowmik", email: "koushik.bhowmik@cityops.in", rank: "Field Operative", expertise: "electrical", verified: true, zone: "Shyambazar", onDuty: true, load: 4, closed: 11 },
  { id: "stf-subhomoy", name: "Subhomoy Ghosh", email: "subhomoy.ghosh@cityops.in", rank: "Field Operative", expertise: "roads", verified: true, zone: "B.B.D. Bagh", onDuty: true, load: 3, closed: 8 },
  { id: "stf-taras", name: "Taras Hembram", email: "taras.hembram@cityops.in", rank: "Field Operative", expertise: "waste", verified: false, zone: "Ballygunge", onDuty: true, load: 5, closed: 6 },
  { id: "stf-sayan", name: "Sayan Majumder", email: "sayan.majumder@cityops.in", rank: "Specialist", expertise: "electrical", verified: true, zone: "College Street", onDuty: false, load: 2, closed: 14 },
  { id: "stf-swarup", name: "Swarup Sutradhar", email: "swarup.sutradhar@cityops.in", rank: "Field Operative", expertise: "water", verified: false, zone: "Dharmatala", onDuty: true, load: 3, closed: 7 },
];

const SEED_REQUESTS = [
  { id: "req-anika", name: "Anika Roy", email: "anika.roy@cityops.in", zone: "Ballygunge", expertise: "waste", experience: "2 Years", note: "Requests field clearance for waste and street cleaning.", filedAt: "2026-10-21T09:12:00.000Z" },
  { id: "req-dev", name: "Dev Banerjee", email: "dev.banerjee@cityops.in", zone: "College Street", expertise: "electrical", experience: "Field Active", note: "Requests clearance for power and street-light files.", filedAt: "2026-10-22T06:40:00.000Z" },
];

export function expertiseLabel(id) {
  return EXPERTISE.find((e) => e.id === id)?.label || "Civic General";
}

export function matchesExpertise(expertiseId, category) {
  const exp = EXPERTISE.find((e) => e.id === expertiseId);
  if (!exp || !category) return false;
  const key = String(category).toLowerCase();
  return exp.matches.some((m) => key.includes(m));
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { roster: SEED_ROSTER, requests: SEED_REQUESTS };
    const parsed = JSON.parse(raw);
    return {
      roster: Array.isArray(parsed.roster) ? parsed.roster : SEED_ROSTER,
      requests: Array.isArray(parsed.requests) ? parsed.requests : SEED_REQUESTS,
    };
  } catch {
    return { roster: SEED_ROSTER, requests: SEED_REQUESTS };
  }
}

let state = load();
const listeners = new Set();

function emit() {
  localStorage.setItem(KEY, JSON.stringify(state));
  listeners.forEach((fn) => fn());
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useDesk() {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

export function acceptRequest(id, rank = "Field Operative") {
  const req = state.requests.find((r) => r.id === id);
  if (!req) return;
  const person = {
    id: `stf-${Date.now()}`,
    name: req.name,
    email: req.email || "",
    rank: RANKS.includes(rank) ? rank : "Field Operative",
    expertise: EXPERTISE.some((e) => e.id === req.expertise) ? req.expertise : "civic",
    verified: false,
    zone: req.zone,
    onDuty: true,
    load: 0,
    closed: 0,
  };
  state = { roster: [person, ...state.roster], requests: state.requests.filter((r) => r.id !== id) };
  emit();
}

export function rejectRequest(id) {
  state = { ...state, requests: state.requests.filter((r) => r.id !== id) };
  emit();
}

export function removeStaff(id) {
  state = { ...state, roster: state.roster.filter((p) => p.id !== id) };
  emit();
}

export function setRank(id, rank) {
  if (!RANKS.includes(rank)) return;
  state = { ...state, roster: state.roster.map((p) => (p.id === id ? { ...p, rank } : p)) };
  emit();
}

export function setVerified(id, on) {
  state = { ...state, roster: state.roster.map((p) => (p.id === id ? { ...p, verified: on } : p)) };
  emit();
}

export function preferredFor(category) {
  return [...state.roster].sort((a, b) => {
    const am = matchesExpertise(a.expertise, category) ? 0 : 1;
    const bm = matchesExpertise(b.expertise, category) ? 0 : 1;
    if (am !== bm) return am - bm;
    return a.load - b.load;
  });
}