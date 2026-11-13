import { getDesk, setDuty, subscribeDesk } from "./staffDeskStore";
import { connectDuty, refreshSettings, setSetting, useSettings } from "./settingsStore";
import { useAuth, getAccount, updateSessionUser } from "./authStore";
import { SERVER_ON } from "../config/server";
import { api } from "../lib/api";
import { serverNotice } from "../services/notice";

/* ------------------------------------------------------------------
   Duty status: one value, everywhere.

   Field crew: the value lives on their roster entry (Staff Desk), so
   command sees it at once on Staff Desk, Staff Management, dispatch
   suggestions and the map's crew counts. The profile menu and Settings
   both change that same entry.
   Command: kept in their own settings (command is not on the roster).

     "on"    takes new work
     "break" stays signed in, no new work
     "off"   no new work

   With the backend: PATCH /api/staff/me/duty, event staff:duty
   (docs/backend/BACKEND-HANDOVER.md · B1).
------------------------------------------------------------------- */

export const DUTY_STATES = ["on", "break", "off"];
export const DUTY_TEXT = { on: "On duty", break: "On break", off: "Off duty" };

/** The roster entry for a signed-in field crew member (matched by email, then name). */
export function rosterEntryOf(me) {
  if (!me || me.role !== "staff") return null;
  const email = String(me.email || "").toLowerCase();
  const roster = getDesk().roster;
  return roster.find((p) => email && String(p.email || "").toLowerCase() === email) || roster.find((p) => p.name === me.name) || null;
}

const stateOf = (p) => p.duty || (p.onDuty ? "on" : "off");

const serverDuty = (me) => SERVER_ON && me?.source === "server" && (me.role === "staff" || me.role === "admin");

connectDuty({
  read(me) {
    // with the server the account holds duty, for crews and command alike
    if (serverDuty(me)) return getAccount()?.dutyStatus || "off";
    const p = rosterEntryOf(me);
    return p ? stateOf(p) : null;
  },
  write(me, status) {
    if (serverDuty(me)) {
      const p = rosterEntryOf(me);
      if (p) setDuty(p.id, status, me.name, me.role); // the screen moves at once
      api
        .patch("/staff/me/duty", { dutyStatus: status })
        .then(({ data }) => { if (data?.user) updateSessionUser(data.user); refreshSettings(); })
        .catch((err) => { if (err?.status !== 401) serverNotice(err?.message || "Your duty status wasn't saved."); refreshSettings(); });
      return;
    }
    const p = rosterEntryOf(me);
    if (p) setDuty(p.id, status, me.name, me.role);
  },
});

// command changed the roster in this tab or another: Settings shows the new value
subscribeDesk(() => refreshSettings());

/** { status, label, set(status), cycle() } for the signed-in person. Citizens: null. */
export function useDuty() {
  const me = useAuth();
  const s = useSettings();
  if (!me || me.role === "citizen") return null;
  const status = DUTY_STATES.includes(s.dutyStatus) ? s.dutyStatus : "on";
  return {
    status,
    label: DUTY_TEXT[status],
    set: (next) => setSetting("dutyStatus", next),
    // the profile menu: on -> off -> on (break is chosen in Settings)
    toggle: () => setSetting("dutyStatus", status === "on" ? "off" : "on"),
  };
}
