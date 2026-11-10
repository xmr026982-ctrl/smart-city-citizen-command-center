import ContactCard from "../people/ContactCard";
import { WARDS } from "../../config/settingsSchema";
import { aliasFor } from "../../config/visibility";
import { rosterEntryOf } from "../../store/dutyStore";

const VIEWERS = [
  { role: "citizen", label: "Citizens", same: "Other citizens" },
  { role: "staff", label: "Field staff", same: "Other field staff" },
  { role: "admin", label: "Admins", same: "Other admins" },
];

function personFrom(role, s, me) {
  const roster = role === "staff" ? rosterEntryOf(me) : null;
  const zone = role === "staff" ? roster?.zone || me.ward : WARDS.find((w) => w.v === s.homeWard)?.l || me.ward;
  return {
    role,
    name: s.displayName || me.name,
    photo: s.avatar,
    alias: aliasFor(s.displayName || me.name),
    email: me.email,
    designation: s.designation,
    office: s.office,
    rank: roster?.rank,
    employeeId: roster?.id ? roster.id.toUpperCase() : "",
    dutyStatus: { on: "On duty", break: "On break", off: "Off duty" }[s.dutyStatus],
    zones: zone,
    tasks: "",
    workContact: role === "admin" ? "Control-room queue" : "In-app message",
  };
}

function VisibilityPanel({ role, s, me }) {
  const person = personFrom(role, s, me);
  // what others see on an ordinary report: named, no photo shared
  const ctx = {
    openCase: true,
    anonymous: false,
    sharePhoto: false,
    onDuty: s.dutyStatus === "on",
    showHistory: true,
  };

  return (
    <div className="vis">
      <p className="st-note">
        What each group sees about you. Your email and devices are never shown to other citizens or crews;
        people reach each other through in-app messages.
      </p>
      <div className="vis-grid">
        {VIEWERS.map((v) => (
          <div key={v.role} className="vis-col">
            <span className="vis-who">{v.role === role ? v.same : v.label}</span>
            <ContactCard viewerRole={v.role} person={person} ctx={ctx} />
          </div>
        ))}
      </div>
      {role === "citizen" && (
        <p className="st-note">Shown for an open report of yours. Your photo is never shared with crews or other citizens.</p>
      )}
      {role === "staff" && (
        <p className="st-note">Command also sees your work email on the Staff Desk, to contact you. Your location is shared with command only while you're on duty.</p>
      )}
    </div>
  );
}

export default VisibilityPanel;