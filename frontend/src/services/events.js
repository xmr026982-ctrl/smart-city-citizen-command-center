/* ------------------------------------------------------------------
   Live event channel: the single seam between the stores and the
   backend's Socket.io events (services/realtime.js).

   • A change made in this browser emits its event here at once, so
     every screen of this tab reacts without waiting for the server.
   • The live connection re-emits the server's events here with
     { remote: true }. Stores listen with onEvent() and re-read what
     changed. They never touch the connection.

   Every payload carries { at } plus the fields listed below; from the
   server also actorId (the account that acted) and actorTab (the tab
   that acted, which skips its own echo). These names are the contract with the
   backend (docs/backend/BACKEND-HANDOVER.md · A5).
------------------------------------------------------------------- */

export const EVENTS = {
  ISSUE_FILED: "issue:filed", // { id, title, category, ward, priority, danger }
  ISSUE_ASSIGNED: "issue:assigned", // { id, to, from }            to = null when unassigned
  ISSUE_STATUS: "issue:status", // { id, from, to, owner, reason? } every status move
  ISSUE_CLOSE_REQUESTED: "issue:close-requested", // { id, owner }        the note is on the issue (ISSUE_NOTE)
  ISSUE_CLOSE_WITHDRAWN: "issue:close-withdrawn", // { id, owner, reason }
  ISSUE_RESOLVED: "issue:resolved", // { id, owner, note }         confirmed by command, with its closing note
  ISSUE_SENT_BACK: "issue:sent-back", // { id, owner, reason, returned } command sent it back (returned = times so far)
  ISSUE_PRIORITY: "issue:priority", // { id, from, to, window }    window = service window hours after the change
  ISSUE_NOTE: "issue:note", // { id, author, internal }
  ISSUE_SUPPORTED: "issue:supported", // { id, count }             another citizen reported the same problem
  ISSUE_REMOVED: "issue:removed", // { id, kind, reason }           withdrawn, dismissed or merged (kind)
  ISSUE_RESTORED: "issue:restored", // { id }
  ISSUE_REQUEST: "issue:request", // { id, req, reason }           withdraw / flag / dispute sent to command
  ISSUE_REQUEST_DECIDED: "issue:request-decided", // { id, req, verdict }

  // from the server only: "something changed, read it again"
  COMMUNITY_CHANGED: "community:changed", // { type, id, zone }  type: proposal | poll | announcement | notice | check
  STAFF_CHANGED: "staff:changed", // { id }                    roster, clearance, rank, verification, removal
  STAFF_DUTY: "staff:duty", // { id, onDuty }
  PROFILE_UPDATED: "profile:updated", // { id, displayName, avatar? }
  POLICY_CHANGED: "policy:changed", // { }                       service window table saved
  NOTIFICATION_NEW: "notification:new", // { id, type }        a stored notification for this person
};

/* Every event the server may send. services/realtime.js forwards exactly
   these names from the socket to this channel, nothing else. */
export const REMOTE_EVENTS = Object.values(EVENTS);

/* local only: the live connection came back after a drop. Anything listening
   reads its data again, because events sent while it was down are lost. */
export const STREAM_RESUMED = "stream:resumed";

const listeners = new Map(); // name -> Set(fn); "*" = every event

/** Listen to one event (or "*" for all). Returns an unsubscribe function. */
export function onEvent(name, fn) {
  if (!listeners.has(name)) listeners.set(name, new Set());
  listeners.get(name).add(fn);
  return () => listeners.get(name)?.delete(fn);
}

/** Send an event to every listener. A failing listener never breaks the sender. */
export function emitEvent(name, payload = {}, meta = {}) {
  const event = { name, at: new Date().toISOString(), ...payload, remote: Boolean(meta.remote) };
  [listeners.get(name), listeners.get("*")].forEach((set) => {
    set?.forEach((fn) => {
      try {
        fn(event);
      } catch (err) {
        console.error(`[events] listener for ${name} failed`, err);
      }
    });
  });
  return event;
}
