import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { UserRound, HardHat, ShieldCheck, ArrowRight, Lock, KeyRound, Mail } from "lucide-react";
import ZoneLock from "../../components/public/ZoneLock";
import { AuthFrame, Field, PasswordInput, ZonePicker, Status, Submit, GoogleButton, Divider } from "../../components/public/PublicKit";
import { signIn, googleSignIn, forgotPassword, ZONES, EMAIL_RE } from "../../services/authService";
import { googleIdToken, GOOGLE_ON } from "../../lib/firebase";
import { setServerSession, takeSignOutNote } from "../../store/authStore";
import { ROLE_HOME, SUPPORT_EMAIL, PRODUCT, supportMail } from "../../config/server";

/* ------------------------------------------------------------------
   Sign in (Person 1's flow, kept whole):
     1. pick the desk: citizen, field staff, city command
     2. citizen: email, then password · staff and admin: email + password
        a citizen account saved without a zone is asked for one (once)
        citizens can also continue with Google (and pick a zone if new)
     3. forgot password: a reset link by email (every desk; command's goes to the command inbox)
   The server checks everything; this page only asks.
   Arriving from staff setup: the staff desk opens with the email locked.
------------------------------------------------------------------- */

const DESKS = [
  { id: "citizen", icon: UserRound, name: "Citizen", line: "Report issues, follow fixes, your zone's board" },
  { id: "staff", icon: HardHat, name: "Field staff", line: "Your assigned work, your zone, service windows" },
  { id: "admin", icon: ShieldCheck, name: "City command", line: "Dispatch, Staff Desk and the city's record" },
];

const TITLE = { citizen: "Citizen sign-in", staff: "Field staff sign-in", admin: "Command sign-in" };

const COOLDOWN_AFTER = 5; // failed tries in a row on this screen
const COOLDOWN_S = 30;

export default function SignIn() {
  const navigate = useNavigate();
  const { state, search } = useLocation();
  const next = new URLSearchParams(search).get("next") || "";
  const preset = state?.role && DESKS.some((d) => d.id === state.role) ? state.role : "";
  const [role, setRole] = useState(preset);
  const [step, setStep] = useState(preset ? "cred" : "role"); // role | cred | forgot | zone
  const [email, setEmail] = useState(state?.email || "");
  const emailLocked = Boolean(state?.locked && state?.email);
  const [password, setPassword] = useState("");
  const [askPassword, setAskPassword] = useState(Boolean(preset && preset !== "citizen") || emailLocked);
  const [zone, setZone] = useState("");
  const [google, setGoogle] = useState(null); // { idToken, email } while a new Google citizen picks a zone
  const [busy, setBusy] = useState("");
  // a note from the last sign-out (session ended, away too long, account deleted) shows once
  const [msg, setMsg] = useState(() => {
    if (state?.notice) return { type: "ok", text: state.notice };
    const note = takeSignOutNote();
    return note ? { type: "ok", text: note } : null;
  });
  const fails = useRef(0);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (!wait) return undefined;
    const t = setTimeout(() => setWait((w) => Math.max(0, w - 1)), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const pick = (id) => {
    setRole(id);
    setStep("cred");
    setAskPassword(id !== "citizen");
    setPassword("");
    setMsg(null);
  };

  const done = (data) => {
    const u = setServerSession(data);
    if (!u) throw new Error("The server's answer couldn't be read. Please try again.");
    const home = ROLE_HOME[u.role];
    // back to the page that asked for sign-in, if it's a desk page (the desk's own guard still checks the role)
    const safe = /^\/(citizen|staff|admin|map|community|notifications|help|settings)(\/|$|\?)/.test(next) && !next.startsWith("//");
    navigate(safe ? next : home, { replace: true });
  };

  const fail = (err) => {
    fails.current += 1;
    if (fails.current >= COOLDOWN_AFTER) { fails.current = 0; setWait(COOLDOWN_S); }
    setMsg({ type: "bad", text: err?.status === 401 ? "Email or password is incorrect for this desk." : err?.message || "Sign-in didn't work. Please try again." });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (busy || wait) return;
    setMsg(null);
    const mail = email.trim();
    if (!EMAIL_RE.test(mail)) { setMsg({ type: "bad", text: "Enter the email you signed up with." }); return; }
    if (role === "citizen" && !askPassword) { setAskPassword(true); return; }
    if (!password) { setMsg({ type: "bad", text: "Enter your password." }); return; }
    if (step === "zone" && !ZONES.includes(zone)) { setMsg({ type: "bad", text: "Pick your zone to continue." }); return; }
    setBusy("in");
    try {
      const data = await signIn({ email: mail, password, role, zone: step === "zone" ? zone : undefined });
      if (data?.requiresZone) {
        setStep("zone");
        setMsg({ type: "ok", text: "One more thing: your account has no zone yet. Pick yours to continue." });
        return;
      }
      fails.current = 0;
      done(data);
    } catch (err) {
      fail(err);
    } finally {
      setBusy("");
    }
  };

  const withGoogle = async () => {
    if (busy) return;
    setMsg(null);
    setBusy("google");
    try {
      const g = await googleIdToken();
      const data = await googleSignIn({ idToken: g.idToken });
      if (data?.requiresZone || (data?.user && !ZONES.includes(data.user.zone))) {
        setGoogle(g);
        setEmail(g.email || data?.email || "");
        setStep("zone");
        setMsg({ type: "ok", text: "Google account confirmed. Pick your zone to finish." });
        return;
      }
      if (data?.user?.role !== "citizen") throw new Error("Google sign-in is for citizen accounts only.");
      done(data);
    } catch (err) {
      setMsg({ type: "bad", text: err?.message || "Google sign-in didn't finish." });
    } finally {
      setBusy("");
    }
  };

  const finishGoogle = async (picked) => {
    if (!ZONES.includes(picked)) { setMsg({ type: "bad", text: "Lock a zone to continue." }); return; }
    setZone(picked);
    setMsg(null);
    setBusy("google");
    try {
      const data = await googleSignIn({ idToken: google.idToken, zone: picked });
      if (data?.requiresZone || !data?.user) throw new Error("The server didn't finish the sign-in. Please start again.");
      done(data);
    } catch (err) {
      setMsg({ type: "bad", text: err?.message || "Google sign-in didn't finish." });
    } finally {
      setBusy("");
    }
  };

  const sendReset = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (!EMAIL_RE.test(email.trim())) { setMsg({ type: "bad", text: "Enter the email of your account." }); return; }
    setBusy("forgot");
    try {
      await forgotPassword(email);
      // the same answer whether or not the account exists: nobody can probe for emails
      setMsg({ type: "ok", text: "If an account uses that email, a reset link is on its way. It works once and expires soon." });
    } catch (err) {
      setMsg({ type: "bad", text: err?.message || "The reset link couldn't be sent. Please try again." });
    } finally {
      setBusy("");
    }
  };

  /* ---------- 1. pick the desk ---------- */
  if (step === "role") {
    return (
      <AuthFrame title="Sign in" sub="Choose your desk. Each desk opens only for its own accounts.">
        <Status msg={msg} />
        <div className="pk-desks">
          {DESKS.map((d) => (
            <button key={d.id} type="button" className={`pk-desk tone-${d.id}`} onClick={() => pick(d.id)}>
              <span className="pk-desk-ic"><d.icon size={18} /></span>
              <span className="pk-desk-t"><b>{d.name}</b><small>{d.line}</small></span>
              <ArrowRight size={16} className="pk-desk-go" />
            </button>
          ))}
        </div>
        <p className="pk-alt">New to {PRODUCT}? <Link to="/register">Create a citizen account</Link></p>
        <p className="pk-alt">Joining the field? <Link to="/staff-request">Apply for staff clearance</Link></p>
      </AuthFrame>
    );
  }

  const back = emailLocked ? { to: "/", label: "Home" } : null;

  /* ---------- 3. forgot password ---------- */
  if (step === "forgot") {
    return (
      <AuthFrame
        tone={role}
        title={role === "admin" ? "Reset the command password" : "Reset your password"}
        sub={role === "admin" ? "We'll email a one-time link to the command email on file. Only that inbox can use it." : role === "staff" ? "We'll email a one-time link to your work email." : "We'll email you a one-time link to set a new password."}
      >
        <form onSubmit={sendReset} noValidate>
          <Field label={role === "admin" ? "Command email" : role === "staff" ? "Work email" : "Email"}>
            <div className="pk-iconin"><Mail size={15} /><input className="pk-in" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" autoFocus /></div>
          </Field>
          <Status msg={msg} />
          <Submit busy={busy === "forgot"} tone={role}>Send reset link</Submit>
        </form>
        <button type="button" className="pk-link" onClick={() => { setStep("cred"); setMsg(null); }}>Back to sign-in</button>
        {role === "admin" ? <SupportNote subject="Command access" lead="No access to that inbox?" /> : null}
      </AuthFrame>
    );
  }

  /* ---------- Google: a new citizen picks a zone ---------- */
  if (step === "zone" && google) {
    return (
      <AuthFrame tone="citizen" title="Choose your home zone" sub="Your board, alerts and announcements follow this zone.">
        <ZoneLock email={google.email} busy={busy === "google"} onEngage={finishGoogle} />
        <Status msg={msg} />
        <button type="button" className="pk-link" disabled={busy === "google"} onClick={() => { setGoogle(null); setStep("cred"); setMsg(null); }}>Use another account</button>
      </AuthFrame>
    );
  }

  /* ---------- 2. credentials ---------- */
  return (
    <AuthFrame tone={role} title={TITLE[role]} back={back} sub={role === "admin" ? "Command accounts are issued by the server administrator." : role === "staff" ? "Use the official email your clearance was issued to." : "Welcome back."}>
      {!emailLocked ? <button type="button" className="pk-switch" onClick={() => { setStep("role"); setMsg(null); setPassword(""); }}>Not your desk? Switch</button> : null}
      <form onSubmit={submit} noValidate>
        <Field label="Email" hint={emailLocked ? "Your clearance email" : ""}>
          <div className={`pk-iconin${emailLocked ? " locked" : ""}`}>
            {emailLocked ? <Lock size={15} /> : <Mail size={15} />}
            <input
              className="pk-in"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (role === "citizen" && askPassword && step !== "zone") setAskPassword(false); }}
              autoComplete="username"
              placeholder="you@example.com"
              readOnly={emailLocked}
              autoFocus={!email}
            />
          </div>
        </Field>
        {askPassword ? (
          <Field label="Password">
            <PasswordInput value={password} onChange={setPassword} autoFocus={Boolean(email)} />
          </Field>
        ) : null}
        {step === "zone" ? <ZonePicker value={zone} onChange={setZone} /> : null}
        <Status msg={wait ? { type: "bad", text: `Too many tries. Wait ${wait}s before trying again.` } : msg} />
        <Submit busy={busy === "in"} tone={role} disabled={Boolean(wait)}>
          {role === "citizen" && !askPassword ? "Continue" : step === "zone" ? "Save zone and sign in" : "Sign in"}
        </Submit>
        <button type="button" className="pk-link" onClick={() => { setStep("forgot"); setMsg(null); }}><KeyRound size={13} /> Forgot password?</button>
      </form>
      {role === "admin" ? <SupportNote subject="Command access" lead="Lost the command inbox too?" /> : null}

      {role === "citizen" && GOOGLE_ON ? (
        <>
          <Divider />
          <GoogleButton onClick={withGoogle} busy={busy === "google"} />
        </>
      ) : null}

      {role === "citizen" ? <p className="pk-alt">New here? <Link to="/register">Create a citizen account</Link></p> : null}
      {role === "staff" && !emailLocked ? <p className="pk-alt">Not cleared yet? <Link to="/staff-request">Apply for staff clearance</Link></p> : null}
    </AuthFrame>
  );
}

/* Support by Gmail (a mailto: link does nothing without a mail app). */
function SupportNote({ subject, lead }) {
  return (
    <p className="pk-note"><Lock size={12} /> {lead} Write to <a href={supportMail(subject)} target="_blank" rel="noopener noreferrer">{SUPPORT_EMAIL}</a>.</p>
  );
}

