import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, MessageSquare, MapPin, Send, CheckCircle2, Lightbulb, UserRound, X } from "lucide-react";
import { Field, Status, Submit } from "../../components/public/PublicKit";
import { sendContact, CONTACT_TOPICS, EMAIL_RE } from "../../services/authService";
import { SUPPORT_EMAIL, PRODUCT, supportMail } from "../../config/server";
import { isMash } from "../../utils/textGuard";
import TextHint from "../../components/ui/TextHint";

/* ------------------------------------------------------------------
   Contact (Person 1's page, kept whole): email the team, or open
   Citizen Support, pick the problem, read the instant tip, send.
   City problems in the street are reports, not messages: they go
   through Report Issue so a crew gets them.
------------------------------------------------------------------- */
const EMPTY = { name: "", email: "", issueType: "", message: "" };

export default function Contact() {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [sent, setSent] = useState(false);
  const set = (k) => (v) => { setF((x) => ({ ...x, [k]: v })); setMsg(null); };
  const topic = CONTACT_TOPICS.find((t) => t.id === f.issueType);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (f.name.trim().length < 2 || isMash(f.name, { title: true })) return setMsg({ type: "bad", text: "Enter your name." });
    if (!EMAIL_RE.test(f.email.trim())) return setMsg({ type: "bad", text: "Enter an email we can reply to." });
    if (!f.issueType) return setMsg({ type: "bad", text: "Pick what it's about." });
    if (f.message.trim().length < 15) return setMsg({ type: "bad", text: "Tell us a little more (at least 15 characters)." });
    if (isMash(f.message)) return setMsg({ type: "bad", text: "That doesn't read like words. Write it so the team can understand it." });
    setBusy(true);
    try {
      await sendContact(f);
      setSent(true);
      setF(EMPTY);
    } catch (err) {
      setMsg({ type: "bad", text: err?.status === 503 || err?.status === 0 ? `Messages can't be sent right now. Write to ${SUPPORT_EMAIL} instead.` : err?.message || "Your message couldn't be sent." });
    } finally {
      setBusy(false);
    }
  };

  const close = () => { if (busy) return; setOpen(false); setSent(false); setMsg(null); };

  return (
    <main className="pk-page pk-contact">
      <section className="pk-hero solo">
        <p className="pk-kick"><i />Contact</p>
        <h1>Get in touch.</h1>
        <p className="pk-lead">Questions about {PRODUCT}, your account or an idea for the city. We read every message.</p>
      </section>

      <section className="pk-features two">
        <article className="pk-feature">
          <span className="pk-feature-ic"><Mail size={18} /></span>
          <h3>Write to the team</h3>
          <p>Questions about the platform, partnerships or press. We reply by email.</p>
          <a className="pk-btn ghost" href={supportMail()} target="_blank" rel="noopener noreferrer"><Mail size={14} /> {SUPPORT_EMAIL}</a>
        </article>
        <article className="pk-feature">
          <span className="pk-feature-ic"><MessageSquare size={18} /></span>
          <h3>Citizen support</h3>
          <p>Trouble signing in, recovering an account or using a service? Pick your problem for an instant tip, then send it.</p>
          <button type="button" className="pk-btn" onClick={() => setOpen(true)}>Contact support</button>
        </article>
      </section>

      <section className="pk-more">
        <div>
          <p className="pk-kick"><i />A problem in the street?</p>
          <h2>Report it, don't email it.</h2>
          <p className="pk-lead">A pothole, a dark streetlight or overflowing bins go through Report Issue, so the right crew gets them on a service window.</p>
          <div className="pk-row"><Link to="/login" state={{ role: "citizen" }} className="pk-btn">Sign in to report</Link></div>
        </div>
        <ul className="pk-tools">
          <li><MapPin size={16} /><b>Where</b><small>Kolkata, West Bengal</small></li>
          <li><Mail size={16} /><b>Email</b><small>{SUPPORT_EMAIL}</small></li>
        </ul>
      </section>

      {open ? (
        <div className="pk-modal" role="dialog" aria-modal="true" aria-labelledby="support-title" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }} onKeyDown={(e) => { if (e.key === "Escape") close(); }}>
          <div className="pk-card wide">
            <button type="button" className="pk-x" onClick={close} aria-label="Close"><X size={16} /></button>
            {sent ? (
              <>
                <h2 className="pk-title" id="support-title">Message sent</h2>
                <p className="pk-state ok"><CheckCircle2 size={18} /> The team replies to your email, usually within two working days.</p>
                <button type="button" className="pk-btn wide" onClick={close}>Done</button>
              </>
            ) : (
              <>
                <h2 className="pk-title" id="support-title">Citizen support</h2>
                <p className="pk-sub">Pick what it's about first: the tip may solve it straight away.</p>
                <form onSubmit={submit} noValidate>
                  <div className="pk-field">
                    <span className="pk-label">What's it about?</span>
                    <div className="pk-chips">{CONTACT_TOPICS.map((t) => <button key={t.id} type="button" className={f.issueType === t.id ? "on" : ""} aria-pressed={f.issueType === t.id} onClick={() => set("issueType")(t.id)}>{t.label}</button>)}</div>
                  </div>
                  {topic?.tip ? <p className="pk-tip"><Lightbulb size={14} /> {topic.tip}</p> : null}
                  <div className="pk-two">
                    <Field label="Your name"><div className="pk-iconin"><UserRound size={15} /><input className="pk-in" value={f.name} onChange={(e) => set("name")(e.target.value)} autoComplete="name" maxLength={60} /></div><TextHint text={f.name} title /></Field>
                    <Field label="Email for the reply"><div className="pk-iconin"><Mail size={15} /><input className="pk-in" type="email" value={f.email} onChange={(e) => set("email")(e.target.value)} autoComplete="email" placeholder="you@example.com" /></div></Field>
                  </div>
                  <Field label="Message" hint={`${f.message.length}/800`}>
                    <textarea className="pk-in pk-ta" rows={4} maxLength={800} value={f.message} onChange={(e) => set("message")(e.target.value)} placeholder="What happened, on which page, and what you expected." />
                    <TextHint text={f.message} />
                  </Field>
                  <p className="pk-fine">Never include a password. The team will never ask for one.</p>
                  <Status msg={msg} />
                  <Submit busy={busy}><Send size={14} /> Send message</Submit>
                </form>
              </>
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}
