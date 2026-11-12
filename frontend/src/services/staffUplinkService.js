/* ------------------------------------------------------------------
   Staff uplink service: the handoff point between the Staff Desk
   (this frontend) and the backend (docs/backend/BACKEND-HANDOVER.md · B1).

   OUTGOING  notifyStaffAccepted(payload)
     Called the moment the admin clicks Accept on a clearance request.
     The backend should email the staff member a one-time activation
     link (sent from the support mail), so they can create a password
     and sign in on the staff login page.

   INCOMING  handleStaffUplinked({ email, uplinkedAt })
     The backend calls this (through the realtime channel) when that
     staff member signs in for the first time. The desk card switches
     from "Awaiting Uplink" to "Uplinked".

   Until the backend exists, notifyStaffAccepted runs a local stand-in
   that succeeds after a short delay, so the desk works without a server.
------------------------------------------------------------------- */

import { getDesk, acceptRequest, setDispatch, markUplinked } from "../store/staffDeskStore";
import { SERVER_ON } from "../config/server";
import { api } from "../lib/api";
import { expertiseLabel } from "../config/expertise";
import { rejectServerStaffRequest } from "./staffRequestService";


// true once the backend is connected (VITE_API_URL set). The desk hides its demo controls then.
export const UPLINK_BACKEND = SERVER_ON;

// Accept = the backend's approve route. It clears the request and emails the
// one-time setup link (/staff-setup?token=…) from the support address.
export const approveRoute = (requestId) => `/staff-requests/${encodeURIComponent(requestId)}/approve`;

/**
 * Payload sent on Accept. Values match the Staff Request form.
 * {
 *   requestId:        string   clearance request id
 *   name:             string   Full Name
 *   email:            string   Staff Email Address (the address they will log in with)
 *   experience:       "Field Active" | "2 Years" | "5 Years" | "10 Years" | "Senior Field"
 *   expertise:        "electrical" | "roads" | "waste" | "water" | "civic"   (the id the form stores)
 *   expertiseLabel:   "Electrician" | "Road Works" | "Waste" | "Water & Drainage" | "Civic General"   (shown on screen)
 *   zone:             "Shyambazar" | "B.B.D. Bagh" | "Ballygunge" | "College Street" | "B.P. Township" | "Dharmatala"
 *   note:             string   Short Note About Your Request ("" if left empty)
 *   rank:             "Field Operative" | "Specialist" | "Senior Specialist" | "Zone Lead" | "Command Fellow"   (chosen by the admin)
 *   requestedAt:      ISO date  when the request was filed
 *   acceptedAt:       ISO date  when the admin clicked Accept
 * }
 * Resolves on success, throws on failure (the desk then shows "Key not sent" with a re-transmit button).
 */
export async function notifyStaffAccepted(payload) {
  if (!SERVER_ON) {
    // Local stand-in: no backend connected. Nothing is sent anywhere.
    await new Promise((resolve) => setTimeout(resolve, 900));
    return { ok: true, simulated: true };
  }
  if (!payload.requestId) throw new Error("This request has no server id, so the setup link can't be sent.");
  const { data } = await api.patch(approveRoute(payload.requestId), {
    rank: payload.rank,
    expertise: payload.expertise,
    zone: payload.zone,
  });
  return data || { ok: true };
}

export async function rejectAndRemove(requestId) {
  // Update MongoDB first.
  await rejectServerStaffRequest(requestId);

  // Remove from the local queue only after server success.
  rejectRequest(requestId);
}

/**
 * Call when a cleared staff member signs in for the first time.
 * The server sends "staff:changed" when it happens (docs/backend/BACKEND-HANDOVER.md · A5).
 */
export function handleStaffUplinked({ email, uplinkedAt } = {}) {
  if (!email) return false;
  return markUplinked(email, uplinkedAt || new Date().toISOString());
}

/* ------------------------------------------------------------------
   Desk actions. The Staff Desk calls these, not the store directly,
   so Accept and the key dispatch always travel together.
------------------------------------------------------------------- */

function payloadFor(person) {
  return {
    requestId: person.requestId || "",
    name: person.name,
    email: person.email,
    experience: person.experience || "",
    expertise: person.expertise,
    expertiseLabel: expertiseLabel(person.expertise),
    zone: person.zone,
    note: person.note || "",
    rank: person.rank,
    requestedAt: person.requestedAt || "",
    acceptedAt: person.acceptedAt,
  };
}

/** A new setup link for an approved person whose first link expired or failed. */
export async function resendSetupLink(payload) {
  if (!SERVER_ON) {
    await new Promise((resolve) => setTimeout(resolve, 900));
    return { ok: true, simulated: true };
  }
  const { data } = await api.post(`/staff-requests/${encodeURIComponent(payload.requestId)}/resend-setup`);
  return data || { ok: true };
}

async function dispatchKey(person, again = false) {
  setDispatch(person.id, "sending");
  try {
    if (again) await resendSetupLink(payloadFor(person));
    else await notifyStaffAccepted(payloadFor(person));
    setDispatch(person.id, "sent");
  } catch {
    setDispatch(person.id, "failed");
  }
}

/** Accept a clearance request and transmit the activation key. */
export async function acceptAndDispatch(requestId, rank) {
  const request = getDesk().requests.find(
    (item) => item.id === requestId
  );

  if (!request) {
    throw new Error("Clearance request was not found.");
  }

  // Step 1: Approve in MongoDB and send the setup email.
  await notifyStaffAccepted({
    requestId,
    name: request.name,
    email: request.email,
    experience: request.experience,
    expertise: request.expertise,
    zone: request.zone,
    note: request.note || "",
    rank,
  });

  // Step 2: Update the local roster only after backend success.
  const person = acceptRequest(requestId, rank);

  if (!person) {
    throw new Error(
      "The application was approved, but the local roster could not be updated."
    );
  }

  // Step 3: The approval endpoint already sent the setup email.
  // Do not call notifyStaffAccepted() a second time.
  setDispatch(person.id, "sent");

  return person;
}

/** Send the activation key again (stalled or failed uplink). */
export function retransmitKey(personId) {
  const person = getDesk().roster.find((p) => p.id === personId);
  // a failed first send is the approval itself; a sent-but-unused link needs a fresh one
  if (person && person.uplink === "awaiting") dispatchKey(person, person.dispatch !== "failed");
}
