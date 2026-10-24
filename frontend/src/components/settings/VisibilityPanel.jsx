import ContactCard from "../people/ContactCard";
import { WARDS } from "../../config/settingsSchema";
import { aliasFor } from "../../config/visibility";

const VIEWERS = [
  { role: "citizen", label: "Citizens", same: "Other citizens" },
  { role: "staff", label: "Field staff", same: "Other field staff" },
  { role: "admin", label: "Admins", same: "Other admins" },
];

function personFrom(role, s) {
  const zones = (s.assignedZones || []).map((id) => WARDS.find((w) => w.v === id)?.l || id).join(", ");
  return {
    role,
    name: s.displayName,
    photo: s.avatar,
    alias: aliasFor(s.displayName),
    email: s.email,
    designation: s.designation,
    office: s.office,
    rank: s.rank,
    employeeId: s.employeeId,
    dutyStatus: { on: "On duty", break: "On break", off: "Off duty" }[s.dutyStatus],
    zones,
    tasks: s.maxTasks ? `Up to ${s.maxTasks} open` : "",
    workContact: role === "admin" ? "Control-room queue" : "In-app message",
  };
}

function VisibilityPanel({ role, s }) {
  const person = personFrom(role, s);
  const ctx = {
    openCase: true,
    anonymous: s.publicName === "anon",
    sharePhoto: !!s.shareAvatar,
    onDuty: s.dutyStatus === "on",
    showHistory: s.showHistory !== false,
  };

  return (
    <div className="vis">
      <p className="st-note">
        This is exactly what each group can see about you. Email addresses and phone numbers are never shown to anyone.
        People reach each other through in-app messages, and the server delivers the email copy.
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
        <p className="st-note">Shown for an open issue you reported. Your photo stays hidden unless you switch on “Show my photo to city staff”, and anonymous reports always hide your name and photo.</p>
      )}
      {role === "staff" && (
        <p className="st-note">Your live location is visible to admin only while you are on duty. Your emergency contact is visible only to you.</p>
      )}
    </div>
  );
}

export default VisibilityPanel;