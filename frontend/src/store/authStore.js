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
    ward: "Ballygunge",
  },
];

function normalizeGender(gender) {
  const value = String(gender || "").trim().toLowerCase();

  if (["male", "man"].includes(value)) return "male";
  if (["female", "woman"].includes(value)) return "female";

  return "";
}

// Profile icon selection


export function getProfileIcon(user) {
  return "/images/default-avatar.svg";
}



function publicUser(account) {
  if (!account) return null;

  const { password, ...safe } = account;

  return {
    ...safe,
    gender: normalizeGender(account.gender) || "",
  };
}

function readSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    // Existing staff/admin/citizen accounts
    const match = ACCOUNTS.find(
      (item) => item.id === parsed.id
    );

    if (match) {
      return publicUser({
        ...match,
        // Keep saved gender when available
        gender: parsed.gender || match.gender,
      });
    }

    // Future registered citizen accounts
    // Registration/backend integration will be added later.
    if (
      typeof parsed.id === "string" &&
      typeof parsed.name === "string" &&
      parsed.role === "citizen"
    ) {
      return publicUser({
        id: parsed.id,
        name: parsed.name,
        role: "citizen",
        email: parsed.email || "",
        gender: parsed.gender || "",
        ward: parsed.ward || "",
      });
    }

    return null;
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
  user = publicUser(nextUser);

  try {
    if (user) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          id: user.id,
          name: user.name,
          role: user.role,
          email: user.email || "",
          gender: user.gender || "",
          ward: user.ward || "",
        })
      );
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors
  }

  emit();
}

export function login(email, password) {
  const match = ACCOUNTS.find(
    (item) =>
      item.email.toLowerCase() ===
        String(email).trim().toLowerCase() &&
      item.password === password
  );

  if (!match) {
    return {
      ok: false,
      message:
        "Access denied. Check your assigned credentials.",
    };
  }

  setSession(publicUser(match));

  return {
    ok: true,
    user: publicUser(match),
  };
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
  // Role switching is disabled.
  // Authentication should call setSession(user).
}
