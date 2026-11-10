import { API_URL, SERVER_ON } from "../config/server";

/* ------------------------------------------------------------------
   The one connection to the backend. Every request goes through here,
   so the sign-in token, timeouts and errors are handled the same way
   everywhere.

     const { data } = await api.get("/issues");
     await api.patch(`/issues/${id}/status`, { status: "in_progress" });

   • The token saved by the sign-in pages is sent as
     "Authorization: Bearer <token>" on every request.
   • A 401 (token missing, expired or revoked) signs the person out:
     whoever registered with onSignedOut() is told (authStore does this).
   • Errors are thrown as ApiError with the server's own message, so a
     screen can show it as is.
   • Without VITE_API_URL every call throws ApiError("offline"): callers
     check SERVER_ON first and keep using the local stores.
------------------------------------------------------------------- */

const TIMEOUT_MS = 15000;

/* This tab's id. The server puts it on the live events a request causes
   (actorTab), so this tab can skip its own echo while the person's other
   tabs and devices still update (services/realtime.js). */
export const TAB_ID = (() => {
  try { return crypto.randomUUID().replace(/-/g, "").slice(0, 16); } catch { return Math.random().toString(36).slice(2, 18); }
})();

export class ApiError extends Error {
  constructor(message, status = 0, body = null) {
    super(message);
    this.name = "ApiError";
    this.status = status; // 0 = no answer (offline, timeout, not configured)
    this.body = body;
  }
}

let tokenSource = () => null;
let signedOut = () => {};

/** authStore tells the client where the current token comes from */
export function setTokenSource(fn) {
  tokenSource = typeof fn === "function" ? fn : () => null;
}

/** called once when the server rejects the token (401) */
export function onSignedOut(fn) {
  signedOut = typeof fn === "function" ? fn : () => {};
}

async function request(method, path, body, opts = {}) {
  if (!SERVER_ON) throw new ApiError("The server is not connected.", 0);

  const headers = { Accept: "application/json", "X-Client-Tab": TAB_ID };
  const token = tokenSource();
  if (token) headers.Authorization = `Bearer ${token}`;

  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  if (body !== undefined && !isForm) headers["Content-Type"] = "application/json";

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeout ?? TIMEOUT_MS);
  if (opts.signal) opts.signal.addEventListener("abort", () => ctrl.abort(), { once: true });

  let res;
  try {
    res = await fetch(`${API_URL}${path.startsWith("/") ? path : `/${path}`}`, {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (err) {
    const aborted = err?.name === "AbortError";
    throw new ApiError(aborted ? "The server took too long to answer." : "Can't reach the server.", 0);
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (res.status === 401 && token) {
    try {
      signedOut();
    } catch {
      /* never break the caller */
    }
  }
  if (!res.ok) {
    const msg = (data && typeof data === "object" && data.message) || `Request failed (${res.status}).`;
    throw new ApiError(msg, res.status, data);
  }
  return { data, status: res.status };
}

export const api = {
  get: (path, opts) => request("GET", path, undefined, opts),
  post: (path, body, opts) => request("POST", path, body, opts),
  patch: (path, body, opts) => request("PATCH", path, body, opts),
  put: (path, body, opts) => request("PUT", path, body, opts),
  delete: (path, opts) => request("DELETE", path, opts?.body, opts),
};

export default api;
