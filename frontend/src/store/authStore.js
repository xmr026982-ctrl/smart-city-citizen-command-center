import { useSyncExternalStore } from "react";

const USERS = {
  citizen: {
    id: "citizen-1",
    name: "Aanya Mehra",
    role: "citizen",
    ward: "Kothrud",
  },
  staff: {
    id: "staff-1",
    name: "Rohan Desai",
    role: "staff",
    ward: "Field Ops",
  },
  admin: {
    id: "admin-1",
    name: "Priya Shah",
    role: "admin",
    ward: "Command",
  },
};

let user = USERS.citizen;
const listeners = new Set();

function emit() {
  listeners.forEach((fn) => fn());
}

export function setRole(role) {
  user = USERS[role];
  emit();
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