import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, UserRound } from "lucide-react";
import { AuthFrame, Field, PasswordInput, PasswordRules, ZonePicker, Status, Submit, GoogleButton, Divider } from "../../components/public/PublicKit";
import { register, googleSignIn, passwordCheck, ZONES, EMAIL_RE } from "../../services/authService";
import { googleIdToken, GOOGLE_ON } from "../../lib/firebase";
import { setServerSession } from "../../store/authStore";
import { ROLE_HOME } from "../../config/server";
import { isMash } from "../../utils/textGuard";
import TextHint from "../../components/ui/TextHint";

/* Citizen sign-up: name, email, zone, password (with live rules). Or Google, then a zone.
   Staff never sign up here: they apply for clearance (/staff-request). */
export default function SignUp() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [zone, setZone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [google, setGoogle] = useState(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(null);

  const check = passwordCheck(password, { email, name });
  const nameOk = name.trim().length >= 2 && !isMash(name, { title: true }) && /\p{L}/u.test(name);

  const done = (data) => {
    const u = setServerSession(data);
    if (!u) throw new Error("The server's answer couldn't be read. Please sign in.");
    navigate(ROLE_HOME[u.role], { replace: true });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setMsg(null);
    if (!nameOk) return setMsg({ type: "bad", text: "Enter your full name as people should see it." });
    if (!EMAIL_RE.test(email.trim())) return setMsg({ type: "bad", text: "Enter a valid email address." });
    if (!ZONES.includes(zone)) return setMsg({ type: "bad", text: "Pick your zone." });
    if (!check.ok) return setMsg({ type: "bad", text: "Your password needs every rule below." });
    if (password !== confirm) return setMsg({ type: "bad", text: "The two passwords don't match." });
    setBusy("up");
    try {
      done(await register({ name, email, password, zone }));
    } catch (err) {
      setMsg({ type: "bad", text: err?.status === 409 ? "An account already uses this email. Sign in instead, or reset the password." : err?.message || "Sign-up didn't work. Please try again." });
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

  const finishGoogle = async (e) => {
    e.preventDefault();
    if (!ZONES.includes(zone)) return setMsg({ type: "bad", text: "Pick your zone." });
    setBusy("google");
    try {
      const data = await googleSignIn({ idToken: google.idToken, zone });
      if (!data?.token) throw new Error("The server didn't finish the sign-up. Please start again.");
      done(data);
    } catch (err) {
      setMsg({ type: "bad", text: err?.message || "Google sign-up didn't finish." });
    } finally {
      setBusy("");
    }
  };

  if (google) {
    return (
      <AuthFrame tone="citizen" title="Pick your zone" sub={`Joining with Google as ${google.email || "your account"}.`} back={{ to: "/register", label: "Back" }}>
        <form onSubmit={finishGoogle} noValidate>
          <ZonePicker value={zone} onChange={setZone} />
          <Status msg={msg} />
          <Submit busy={busy === "google"} tone="citizen" disabled={!zone}>Create my account</Submit>
        </form>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame tone="citizen" title="Create a citizen account" sub="Report problems in your zone and follow them until they're fixed." wide>
      {GOOGLE_ON ? (
        <>
          <GoogleButton onClick={withGoogle} busy={busy === "google"} label="Sign up with Google" />
          <Divider>or with email</Divider>
        </>
      ) : null}
      <form onSubmit={submit} noValidate>
        <div className="pk-two">
          <Field label="Full name">
            <div className="pk-iconin"><UserRound size={15} /><input className="pk-in" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Your name" maxLength={60} /></div>
            <TextHint text={name} title />
          </Field>
          <Field label="Email">
            <div className="pk-iconin"><Mail size={15} /><input className="pk-in" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" /></div>
          </Field>
        </div>
        <ZonePicker value={zone} onChange={setZone} />
        <div className="pk-two">
          <Field label="Password">
            <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" placeholder="New password" />
          </Field>
          <Field label="Confirm password">
            <PasswordInput value={confirm} onChange={setConfirm} autoComplete="new-password" placeholder="Type it again" />
          </Field>
        </div>
        <PasswordRules password={password} confirm={confirm} email={email} name={name} />
        <Status msg={msg} />
        <Submit busy={busy === "up"} tone="citizen">Create account</Submit>
      </form>
      <p className="pk-alt">Already have an account? <Link to="/login" state={{ role: "citizen" }}>Sign in</Link></p>
      <p className="pk-alt">City staff? <Link to="/staff-request">Apply for staff clearance</Link> instead.</p>
    </AuthFrame>
  );
}
