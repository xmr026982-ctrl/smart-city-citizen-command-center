import { useSyncExternalStore } from "react";

const STORAGE_KEY = "wardline-session";

export const ACCOUNTS = [
  {
    id: "staff-koushik",
    email: "koushik.bhowmik@smartcity.in",
    password: "Wardline@2026",
    name: "Koushik Bhowmik",
    role: "staff",
    ward: "Field Ops",
  },
  {
    id: "staff-subhomoy",
    email: "subhomoy.ghosh@smartcity.in",
    password: "Wardline@2026",
    name: "Subhomoy Ghosh",
    role: "staff",
    ward: "Field Ops",
  },
  {
    id: "staff-taras",
    email: "taras.hembram@smartcity.in",
    password: "Wardline@2026",
    name: "Taras Hembram",
    role: "staff",
    ward: "Field Ops",
  },
  {
    id: "staff-sayan",
    email: "sayan.majumder@smartcity.in",
    password: "Wardline@2026",
    name: "Sayan Majumder",
    role: "staff",
    ward: "Field Ops",
  },
  {
    id: "staff-swarup",
    email: "swarup.sutradhar@smartcity.in",
    password: "Wardline@2026",
    name: "Swarup Sutradhar",
    role: "staff",
    ward: "Field Ops",
  },
  {
    id: "admin-1",
    email: "priti.sarkar@smartcity.in",
    password: "Wardline@2026",
    name: "Priti Sarkar",
    role: "admin",
    ward: "Command",
  },
  {
    id: "citizen-1",
    email: "aanya.mehra@smartcity.in",
    password: "Wardline@2026",
    name: "Aanya Mehra",
    role: "citizen",
    ward: "Kothrud",
  },
];

function publicUser(account) {
  if (!account) return null;
  const { password, ...safe } = account;
  return safe;
}

function readSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const match = ACCOUNTS.find((item) => item.id === parsed.id);
    return publicUser(match);
  } catch {
    return null;
  }
}

let user = readSession();
const listeners = new Set();

function emit() {
  listeners.forEach((fn) => fn());
}

export function setSession(nextUser) {
  user = nextUser;
  try {
    if (nextUser) localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: nextUser.id }));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  emit();
}

export function login(email, password) {
  const match = ACCOUNTS.find(
    (item) =>
      item.email.toLowerCase() === String(email).trim().toLowerCase() &&
      item.password === password
  );
  if (!match) {
    return { ok: false, message: "Access denied. Check your assigned credentials." };
  }
  setSession(publicUser(match));
  return { ok: true, user: publicUser(match) };
}

export function logout() {
  setSession(null);
}

export function getUser() {
  return user;
}

export function useAuth() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    getUser,
    getUser
  );
}

export function setRole() {
  /* Role switching is disabled. Person 1 JWT should call setSession(user). */
}