const KEY = "dashboard-role";
const listeners = new Set();

function emit() {
  listeners.forEach((listener) => listener());
}

export function setRole(role) {
  sessionStorage.setItem(KEY, role);
  emit();
}

export function getRole() {
  return sessionStorage.getItem(KEY);
}

export function clearRole() {
  sessionStorage.removeItem(KEY);
  emit();
}

export function subscribeRole(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}