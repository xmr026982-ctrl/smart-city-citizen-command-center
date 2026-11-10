import { api } from "../lib/api";
import { SERVER_ON } from "../config/server";
import { getUser, subscribeRole } from "../store/authStore";
import { connectRemote, replaceBoard, setAudit, upsertIssue } from "../store/issueStore";
import { onEvent, EVENTS, STREAM_RESUMED } from "./events";
import { serverNotice } from "./notice";

/* ------------------------------------------------------------------
   Issues with the server (docs/backend/BACKEND-HANDOVER.md · A7).

   Active when VITE_API_URL is set and the person signed in through the
   server. Then:
   • the board is GET /issues (and, for command, the trail is GET /audit)
   • every change a page makes shows at once (store/issueStore.js), is
     sent to its endpoint here, in order, and the server's copy of the
     issue replaces the local one. If the server says no, its message is
     shown and the issue is read again, so the screen never keeps a
     change the server refused.
   • an issue:* event from another person re-reads that one issue
   • after the live connection comes back, everything is read again
   Pages never call the server for issues themselves.
------------------------------------------------------------------- */

const onServer = () => SERVER_ON && getUser()?.source === "server";
const path = (id) => `/issues/${encodeURIComponent(id)}`;

/* action → request. Every answer is { issue, related? } */
const ROUTES = {
  support: (p) => ["post", `${path(p.id)}/support`, {}],
  status: (p) => ["patch", `${path(p.id)}/status`, { status: p.status, ...(p.note ? { note: p.note } : {}) }],
  assign: (p) => ["patch", `${path(p.id)}/assign`, { staff: p.staff, ...(p.note ? { note: p.note } : {}) }],
  priority: (p) => ["patch", `${path(p.id)}/priority`, { priority: p.priority }],
  follow: (p) => ["post", `${path(p.id)}/follow`, { on: p.on }],
  comment: (p) => ["post", `${path(p.id)}/comments`, { body: p.body, internal: p.internal }],
  withdraw: (p) => ["post", `${path(p.id)}/withdraw`, { reason: p.reason, note: p.note }],
  request: (p) => ["post", `${path(p.id)}/requests`, { type: p.type, reason: p.reason, note: p.note, ...(p.linkedTo ? { linkedTo: p.linkedTo } : {}) }],
  seen: (p) => ["patch", `${path(p.id)}/requests/${encodeURIComponent(p.reqId)}/seen`, {}],
  decide: (p) => ["patch", `${path(p.id)}/requests/${encodeURIComponent(p.reqId)}`, { verdict: p.verdict, ...(p.reason ? { reason: p.reason } : {}) }],
  dismiss: (p) => ["post", `${path(p.id)}/dismiss`, { reason: p.reason, note: p.note, ...(p.linkedTo ? { linkedTo: p.linkedTo } : {}) }],
  restore: (p) => ["post", `${path(p.id)}/restore`, { note: p.note || "" }],
  merge: (p) => ["post", `${path(p.id)}/merge`, { into: p.into, note: p.note || "" }],
};

function take(data) {
  if (data?.issue?.id) upsertIssue(data.issue.id, data.issue);
  (data?.related || []).forEach((i) => i?.id && upsertIssue(i.id, i));
}

/* one issue as the server has it now (gone or hidden: removed here) */
async function reread(id) {
  try {
    const { data } = await api.get(path(id));
    take(data);
  } catch (err) {
    if (err?.status === 404 || err?.status === 403) upsertIssue(id, null);
  }
}

let auditTimer = null;
function rereadAudit() {
  if (getUser()?.role !== "admin") return;
  clearTimeout(auditTimer);
  auditTimer = setTimeout(async () => {
    try { const { data } = await api.get("/audit"); setAudit(data?.items || []); } catch { /* next event tries again */ }
  }, 600);
}

let chain = Promise.resolve(); // one request at a time, in the order they were made
function send(action, payload) {
  const route = ROUTES[action];
  if (!route) return;
  const [method, url, body] = route(payload);
  chain = chain.then(async () => {
    try {
      const { data } = await api[method](url, body);
      take(data);
    } catch (err) {
      if (err?.status !== 401) serverNotice(err?.message || "The server didn't accept that change.");
      await reread(payload.id);
    }
    rereadAudit();
  });
}

let loading = null;
export function loadBoard() {
  if (!onServer()) return Promise.resolve();
  if (loading) return loading;
  loading = (async () => {
    try {
      const { data } = await api.get("/issues");
      let auditList;
      if (getUser()?.role === "admin") {
        try { auditList = (await api.get("/audit")).data?.items || []; } catch { auditList = []; }
      }
      replaceBoard(data?.items || [], auditList || []);
    } catch (err) {
      if (err?.status !== 401) serverNotice("Issues couldn't be loaded from the server. They'll load when it answers.");
    } finally {
      loading = null;
    }
  })();
  return loading;
}

/** File a new report (citizen). Resolves { ok, issue } or { ok: false, message }. */
export async function fileIssue(fields, photos = []) {
  const form = new FormData();
  Object.entries(fields).forEach(([k, v]) => form.append(k, String(v)));
  for (const ph of photos) {
    try {
      const blob = await (await fetch(ph.url)).blob();
      form.append("photos", blob, ph.name || "photo.jpg");
    } catch { /* a photo that can't be read is left out; the report still goes */ }
  }
  try {
    const { data } = await api.post("/issues", form, { timeout: 60000 });
    take(data);
    rereadAudit();
    return { ok: true, issue: data.issue };
  } catch (err) {
    return { ok: false, message: err?.message || "The report didn't reach the server. Try again." };
  }
}

export const isServerBoard = onServer;

/* follow sign-in and sign-out */
let who = "";
subscribeRole(() => {
  const next = onServer() ? `${getUser().serverId}:${getUser().role}` : "";
  if (next === who) return;
  const was = who;
  who = next;
  if (next) loadBoard();
  else if (was) replaceBoard([], []); // signed out of a server desk: nothing of theirs stays on screen
});

connectRemote({ active: onServer, send });

/* other people's changes */
[EVENTS.ISSUE_FILED, EVENTS.ISSUE_ASSIGNED, EVENTS.ISSUE_STATUS, EVENTS.ISSUE_CLOSE_REQUESTED, EVENTS.ISSUE_CLOSE_WITHDRAWN,
  EVENTS.ISSUE_RESOLVED, EVENTS.ISSUE_SENT_BACK, EVENTS.ISSUE_PRIORITY, EVENTS.ISSUE_NOTE, EVENTS.ISSUE_SUPPORTED,
  EVENTS.ISSUE_REMOVED, EVENTS.ISSUE_RESTORED, EVENTS.ISSUE_REQUEST, EVENTS.ISSUE_REQUEST_DECIDED].forEach((name) => {
  onEvent(name, (e) => {
    if (!e?.remote || !onServer() || !e.id) return;
    reread(e.id);
    rereadAudit();
  });
});
onEvent(STREAM_RESUMED, () => { if (onServer()) loadBoard(); });
