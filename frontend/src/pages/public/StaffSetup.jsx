import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Lock, ShieldAlert, CheckCircle2, Radio, ArrowRight, Loader2, BadgeCheck, MapPin, Wrench } from "lucide-react";
import { AuthFrame, Field, PasswordInput, PasswordRules, Status, Submit } from "../../components/public/PublicKit";
import { staffSetupInfo, staffSetPassword, passwordCheck, EXPERTISE } from "../../services/authService";
import { SUPPORT_EMAIL, supportMail } from "../../config/server";

/* ------------------------------------------------------------------
   Staff setup: the one-time link from the clearance email.
   Both /staff-setup?token=… (what the server emails) and the older
   /staff-password?token=… land here.

     1. Confirm it's you   the cleared email (locked) and the clearance
     2. Set a password     password + confirm, live rules
     3. Uplink ready       then the staff sign-in, email filled in and locked
------------------------------------------------------------------- */
const label = (id) => EXPERTISE.find((x) => x.id.toLowerCase() === String(id || "").toLowerCase())?.label || id || "";

export default function StaffSetup() {
  const { search } = useLocation();
  const navigate = useNavigate();
  const token = new URLSearchParams(search).get("token") || "";
  const [info, setInfo] = useState(null); // { name, email, rank, expertise, zone, experience } | {} when the server can't describe it
  const [state, setState] = useState(token ? "loading" : "missing"); // loading | confirm | password | ready | invalid | missing | offline
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (!token) return;
    let live = true;
    staffSetupInfo(token)
      .then((d) => { if (live) { setInfo(d || {}); setState("confirm"); } })
      .catch((err) => {
        if (!live) return;
        if (err?.status === 404 && !err?.body?.message?.match?.(/link|token|expired|invalid/i)) { setInfo({}); setState("confirm"); return; } // server without the lookup yet
        if (err?.status === 0) { setState("offline"); return; }
        setState("invalid");
      });
    return () => { live = false; };
  }, [token]);

  const check = passwordCheck(password, { email: info?.email, name: info?.name });

  const save = async (e) => {
    e.preventDefault();
    if (busy) return;
    setMsg(null);
    if (!check.ok) return setMsg({ type: "bad", text: "Your password needs every rule below." });
    if (password !== confirm) return setMsg({ type: "bad", text: "The two passwords don't match." });
    setBusy(true);
    try {
      await staffSetPassword(token, password);
      setPassword(""); setConfirm("");
      setState("ready");
    } catch (err) {
      if (err?.status === 400 || err?.status === 409) setState("invalid");
      else setMsg({ type: "bad", text: err?.message || "Your password couldn't be saved. Please try again." });
    } finally {
      setBusy(false);
    }
  };

  const toSignIn = () => navigate("/login", { replace: true, state: info?.email ? { role: "staff", email: info.email, locked: true, notice: "Uplink ready. Sign in with your new password." } : { role: "staff", notice: "Uplink ready. Sign in with your new password." } });

  if (state === "loading") {
    return (
      <AuthFrame tone="staff" title="Checking your link" sub="One moment.">
        <p className="pk-state"><Loader2 size={18} className="pk-spin" /> Confirming the setup link with the server…</p>
      </AuthFrame>
    );
  }

  if (state === "missing" || state === "invalid" || state === "offline") {
    const copy = {
      missing: ["This link is incomplete", "Open the full link from your clearance email."],
      invalid: ["This link can't be used", "Setup links work once and expire. If yours did, the admin can send a new one from the Staff Desk."],
      offline: ["The server isn't answering", "Your link is fine. Try again in a few minutes."],
    }[state];
    return (
      <AuthFrame tone="staff" title={copy[0]} sub={copy[1]}>
        <p className="pk-state bad"><ShieldAlert size={18} /> {state === "invalid" ? "Invalid, expired or already used." : state === "offline" ? "No answer from the server." : "No setup code in the address."}</p>
        {state === "offline" ? <button type="button" className="pk-btn wide" onClick={() => window.location.reload()}>Try again</button> : <Link to="/login" state={{ role: "staff" }} className="pk-btn wide ghost">Go to staff sign-in</Link>}
        <p className="pk-note">Need help? Write to <a href={supportMail("Staff setup")} target="_blank" rel="noopener noreferrer">{SUPPORT_EMAIL}</a>.</p>
      </AuthFrame>
    );
  }

  const steps = (
    <ol className="pk-track" aria-label="Setup steps">
      {["Confirm it's you", "Set a password", "Uplink ready"].map((t, i) => {
        const at = { confirm: 0, password: 1, ready: 2 }[state];
        return <li key={t} className={i < at ? "done" : i === at ? "on" : ""}><i>{i < at ? <CheckCircle2 size={12} /> : i + 1}</i>{t}</li>;
      })}
    </ol>
  );

  if (state === "confirm") {
    return (
      <AuthFrame tone="staff" title="Confirm it's you" sub="Your clearance from city command. Your email is your official staff identity and can't be changed here.">
        {steps}
        <div className="pk-ident">
          <Field label="Official email" hint="Locked">
            <div className="pk-iconin locked"><Lock size={15} /><input className="pk-in" value={info?.email || "The email this link was sent to"} readOnly /></div>
          </Field>
          {info?.name ? (
            <div className="pk-clear">
              <span><BadgeCheck size={14} /><b>{info.name}</b></span>
              {info.rank ? <span>{info.rank}</span> : null}
              {info.expertise ? <span><Wrench size={12} /> {label(info.expertise)}</span> : null}
              {info.zone ? <span><MapPin size={12} /> {info.zone}</span> : null}
            </div>
          ) : null}
        </div>
        <button type="button" className="pk-btn wide tone-staff" onClick={() => setState("password")}>This is me · continue <ArrowRight size={14} /></button>
        <p className="pk-note">Not you? Don't continue. Write to <a href={supportMail("Staff setup")} target="_blank" rel="noopener noreferrer">{SUPPORT_EMAIL}</a>.</p>
      </AuthFrame>
    );
  }

  if (state === "password") {
    return (
      <AuthFrame tone="staff" title="Set your password" sub="It opens the field desk. Nobody else, command included, can ever see it.">
        {steps}
        <form onSubmit={save} noValidate>
          <Field label="New password"><PasswordInput value={password} onChange={setPassword} autoComplete="new-password" placeholder="New password" autoFocus /></Field>
          <Field label="Confirm password"><PasswordInput value={confirm} onChange={setConfirm} autoComplete="new-password" placeholder="Type it again" /></Field>
          <PasswordRules password={password} confirm={confirm} email={info?.email} name={info?.name} />
          <Status msg={msg} />
          <Submit busy={busy} tone="staff">Save password</Submit>
        </form>
        <button type="button" className="pk-link" onClick={() => setState("confirm")}>Back</button>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame tone="staff" title="Uplink ready" sub="Your field desk account is live. The setup link is now used up.">
      {steps}
      <div className="pk-uplink" aria-hidden><span><Radio size={22} /></span><i /><i /></div>
      <button type="button" className="pk-btn wide tone-staff" onClick={toSignIn}>Go to staff sign-in <ArrowRight size={14} /></button>
    </AuthFrame>
  );
}
