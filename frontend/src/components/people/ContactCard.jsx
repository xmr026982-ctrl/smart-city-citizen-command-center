import "../../styles/people.css";
import { fieldsFor, FIELD_LABELS, SUBJECT_FIELDS, maskEmail } from "../../config/visibility";
import { initialsOf } from "../../store/settingsStore";

// Shows ONLY what the visibility policy lets `viewerRole` see about `person`.
// Reuse it on Staff Desk, Issue Records, Community... so the rules stay identical everywhere.
// person: { role, name, photo, alias, email, designation, office, rank, employeeId,
//           dutyStatus, zones, tasks, workContact }   (all values are plain strings)
// ctx:    { openCase, anonymous, sharePhoto, onDuty, showHistory }
function ContactCard({ viewerRole, person, ctx = {}, title }) {
  const shown = fieldsFor(viewerRole, person.role, ctx);
  const has = (f) => shown.includes(f);

  const values = {
    alias: person.alias,
    maskedEmail: maskEmail(person.email),
    issueDetails: "Report details",
    issueStatus: "Status updates",
    history: "Reports & votes",
    designation: person.designation,
    office: person.office,
    rank: person.rank,
    employeeId: person.employeeId,
    dutyStatus: person.dutyStatus,
    zones: person.zones,
    tasks: person.tasks,
    workContact: person.workContact,
    liveLocation: "Live while on duty",
  };

  const rows = shown.filter((f) => f !== "name" && f !== "photo" && values[f]);
  const hidden = (SUBJECT_FIELDS[person.role] || []).filter((f) => !has(f));
  const heading = has("name") ? person.name : has("alias") ? person.alias : "Hidden";

  return (
    <article className="pp-card">
      <header>
        <span className="pp-av">
          {has("photo") && person.photo ? <img src={person.photo} alt="" /> : <i>{has("name") ? initialsOf(person.name) : "?"}</i>}
        </span>
        <div>
          <b>{heading}</b>
          {title && <small>{title}</small>}
        </div>
      </header>

      {rows.length > 0 && (
        <dl>
          {rows.map((f) => (
            <div key={f}>
              <dt>{FIELD_LABELS[f]}</dt>
              <dd>{values[f]}</dd>
            </div>
          ))}
        </dl>
      )}

      {hidden.length > 0 && (
        <p className="pp-hidden">
          <span>Not shared</span>
          {hidden.map((f) => (<em key={f}>{FIELD_LABELS[f]}</em>))}
        </p>
      )}
    </article>
  );
}

export default ContactCard;