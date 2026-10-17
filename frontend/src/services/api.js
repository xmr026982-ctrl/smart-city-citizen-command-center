/**
 * Issue API — mock or real backend.
 * Set USE_MOCK = false when the database is ready.
 */

const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:5000/api"
).replace(/\/+$/, "");

const STORAGE_KEY = "wardline-session";

export const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";

/* ---------- session / headers (no authStore import) ---------- */

function readSessionUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getActorHeaders({ json = false } = {}) {
  const session = readSessionUser();
  // session may only store { id }; role/name come from login accounts in real app
  const id = session?.id || "unknown";
  const role = session?.role || "staff";
  const name = session?.name || "Unknown user";

  if (!session?.id) {
    console.warn("[api] No session in localStorage — using fallback headers");
  }

  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    "x-role": role === "citizen" ? "citizen" : role,
    "x-name": name,
    "x-user-id": String(id),
  };
}

/* ---------- MOCK DATA ---------- */

const MOCK_ISSUES = [
  {
    id: "ISS-2410",
    title: "Broken streetlight near Dharmatala",
    description:
      "Streetlight not working for 3 days. Dark stretch after 7pm.",
    type: "Streetlight",
    status: "in_progress",
    latitude: 22.5604,
    longitude: 88.3519,
    ward: "Dharmatala",
    zone: "Dharmatala",
    assignedTo: { id: "staff-koushik", name: "Koushik Bhowmik" },
    assignedStaffName: "Koushik Bhowmik",
    createdAt: "2026-10-08T10:30:00.000Z",
    photos: [],
  },
  {
    id: "ISS-2411",
    title: "Pothole on AJC Bose Road",
    description: "Large pothole causing traffic slowdown.",
    type: "Road",
    status: "acknowledged",
    latitude: 22.5448,
    longitude: 88.3426,
    ward: "B.B.D. Bagh",
    zone: "B.B.D. Bagh",
    assignedTo: { id: "staff-subhomoy", name: "Subhomoy Ghosh" },
    assignedStaffName: "Subhomoy Ghosh",
    createdAt: "2026-10-09T14:00:00.000Z",
    photos: [],
  },
];

function delay(ms = 400) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function apiGet(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...getActorHeaders(),
      ...options.headers,
    },
  });

  const payload = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(payload.message || `HTTP ${res.status}`);
  }

  return payload;
}

/* ---------- PUBLIC API ---------- */

export async function fetchIssues({ signal } = {}) {
  if (USE_MOCK) {
    await delay();
    return { data: MOCK_ISSUES };
  }

  const res = await fetch(`${API_URL}/issues`, {
    method: "GET",
    headers: getActorHeaders(),
    signal,
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.message || `HTTP ${res.status}`);
  return payload;
}

export async function fetchIssueById(issueId, { signal } = {}) {
  if (USE_MOCK) {
    await delay();
    const found = MOCK_ISSUES.find(
      (i) =>
        String(i.id) === String(issueId) ||
        String(i.id).endsWith(String(issueId).replace(/\D/g, ""))
    );
    if (!found) throw new Error("Issue not found");
    return { data: found };
  }

  const res = await fetch(
    `${API_URL}/issues/${encodeURIComponent(issueId)}`,
    {
      method: "GET",
      headers: getActorHeaders(),
      signal,
    }
  );
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.message || `HTTP ${res.status}`);
  return payload;
}

export async function fetchNearbyIssues(
  lat,
  lng,
  radius = 2000,
  { signal } = {}
) {
  if (USE_MOCK) {
    await delay();
    const toRad = (d) => (d * Math.PI) / 180;
    const R = 6371000;
    const nearby = MOCK_ISSUES.filter((i) => {
      const dLat = toRad(i.latitude - lat);
      const dLng = toRad(i.longitude - lng);
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat)) *
          Math.cos(toRad(i.latitude)) *
          Math.sin(dLng / 2) ** 2;
      const d = 2 * R * Math.asin(Math.sqrt(a));
      return d <= radius;
    });
    return { data: nearby };
  }

  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    radius: String(radius),
  });
  const res = await fetch(`${API_URL}/issues/nearby?${params}`, {
    method: "GET",
    headers: getActorHeaders(),
    signal,
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.message || `HTTP ${res.status}`);
  return payload;
}

export async function postWorkUpdate(issueId, body) {
  if (USE_MOCK) {
    await delay();
    console.log("[MOCK] work update", issueId, body);
    return { ok: true, message: "Saved (mock)" };
  }

  const res = await fetch(`${API_URL}/issues/${issueId}/comments`, {
    method: "POST",
    headers: getActorHeaders({ json: true }),
    body: JSON.stringify({ body }),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.message || "Failed to save update");
  return payload;
}

export async function updateIssueStatus(issueId, status) {
  if (USE_MOCK) {
    await delay();
    const issue = MOCK_ISSUES.find((i) => String(i.id) === String(issueId));
    if (issue) issue.status = status;
    return { data: issue };
  }

  const res = await fetch(`${API_URL}/issues/${issueId}/status`, {
    method: "POST",
    headers: getActorHeaders({ json: true }),
    body: JSON.stringify({ status }),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.message || "Failed to update status");
  return payload;
}
