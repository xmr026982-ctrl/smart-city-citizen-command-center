import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, UserRound, Send, CheckCircle2, MapPin } from "lucide-react";
import { AuthFrame, Field, Status, Submit } from "../../components/public/PublicKit";
import { submitStaffRequest, EXPERIENCE, EXPERTISE, ZONES, EMAIL_RE } from "../../services/authService";
import { isMash } from "../../utils/textGuard";
import TextHint from "../../components/ui/TextHint";

/* ------------------------------------------------------------------
   Staff clearance request (Person 1's form, every field kept).
   It reaches the admin's Staff Desk as a clearance request. Once the
   admin accepts, the server emails a one-time setup link (/staff-setup).
------------------------------------------------------------------- */
const EMPTY = { name: "", email: "", experience: "", expertise: "", zone: "", note: "" };

export default function StaffRequest() {
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [sent, setSent] = useState(null);
  const set = (k) => (v) => { setF((x) => ({ ...x, [k]: v })); setMsg(null); };

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (f.name.trim().length < 3 || isMash(f.name, { title: true })) return setMsg({ type: "bad", text: "Enter your full name as it appears on your ID." });
    if (!EMAIL_RE.test(f.email.trim())) return setMsg({ type: "bad", text: "Enter your official email. It becomes your staff sign-in." });
    if (!f.experience || !f.expertise || !f.zone) return setMsg({ type: "bad", text: "Pick your experience, your work area and your zone." });
    if (f.note && isMash(f.note)) return setMsg({ type: "bad", text: "The note doesn't read like words. Write it so command can understand it, or leave it empty." });
    setBusy(true);
    try {
      await submitStaffRequest(f);
      setSent({ ...f });
    } catch (err) {
      setMsg({ type: "bad", text: err?.status === 409 ? "A request or an account already exists for this email." : err?.message || "Your request couldn't be sent. Please try again." });
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <AuthFrame tone="staff" title="Request received" sub="City command reviews every clearance request.">
        <div className="pk-receipt">
          <p className="pk-state ok"><CheckCircle2 size={18} /> Your request is on the Staff Desk.</p>
          <ol className="pk-steps">
            <li className="done"><b>Request filed</b><span>{sent.name} · {sent.email}</span></li>
            <li><b>Command reviews it</b><span>Expertise, zone and experience are checked.</span></li>
            <li><b>Setup link by email</b><span>Once cleared, a one-time link lets you set your password. It works once.</span></li>
            <li><b>Sign in to the field desk</b><span>With the same email.</span></li>
          </ol>
        </div>
        <Link to="/" className="pk-btn wide ghost">Back to home</Link>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame tone="staff" title="Apply for staff clearance" sub="For city field staff. Command clears every request before an account exists." back={{ to: "/login", label: "Sign in", state: { role: "staff" } }} wide>
      <form onSubmit={submit} noValidate>
        <div className="pk-two">
          <Field label="Full name">
            <div className="pk-iconin"><UserRound size={15} /><input className="pk-in" value={f.name} onChange={(e) => set("name")(e.target.value)} autoComplete="name" placeholder="As on your ID" maxLength={60} /></div>
            <TextHint text={f.name} title />
          </Field>
          <Field label="Official email" hint="Becomes your sign-in">
            <div className="pk-iconin"><Mail size={15} /><input className="pk-in" type="email" value={f.email} onChange={(e) => set("email")(e.target.value)} autoComplete="email" placeholder="you@example.com" /></div>
          </Field>
        </div>
        <div className="pk-field">
          <span className="pk-label">Experience</span>
          <div className="pk-chips">{EXPERIENCE.map((x) => <button key={x} type="button" className={f.experience === x ? "on" : ""} aria-pressed={f.experience === x} onClick={() => set("experience")(x)}>{x}</button>)}</div>
        </div>
        <div className="pk-field">
          <span className="pk-label">Work area</span>
          <div className="pk-chips">{EXPERTISE.map((x) => <button key={x.id} type="button" className={f.expertise === x.id ? "on" : ""} aria-pressed={f.expertise === x.id} onClick={() => set("expertise")(x.id)}>{x.label}</button>)}</div>
        </div>
        <div className="pk-field">
          <span className="pk-label">Zone</span>
          <div className="pk-zones">{ZONES.map((z) => <button key={z} type="button" className={f.zone === z ? "on" : ""} aria-pressed={f.zone === z} onClick={() => set("zone")(z)}><MapPin size={12} /> {z}</button>)}</div>
        </div>
        <Field label="Note for command" hint={`Optional · ${f.note.length}/240`}>
          <textarea className="pk-in pk-ta" rows={2} maxLength={240} value={f.note} onChange={(e) => set("note")(e.target.value)} placeholder="Licences, crews you've led, the work you do best." />
          <TextHint text={f.note} />
        </Field>
        <Status msg={msg} />
        <Submit busy={busy} tone="staff"><Send size={14} /> Send request</Submit>
      </form>
    </AuthFrame>
  );
}
