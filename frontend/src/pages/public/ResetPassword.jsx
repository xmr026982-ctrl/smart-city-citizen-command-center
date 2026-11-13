import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { CheckCircle2, ShieldAlert } from "lucide-react";
import { AuthFrame, Field, PasswordInput, PasswordRules, Status, Submit } from "../../components/public/PublicKit";
import { resetPassword, passwordCheck } from "../../services/authService";
import { SUPPORT_EMAIL, supportMail } from "../../config/server";

/* ------------------------------------------------------------------
   /reset-password?token=…[&desk=staff|admin]
   The link from a "Forgot password" email, or from Settings for staff
   and command. The server adds desk= so this page shows the right rules
   (command: 16+ characters). The server checks the rules again and
   decides; desk= only changes what is shown.
------------------------------------------------------------------- */
const DESKS = ["citizen", "staff", "admin"];

export default function ResetPassword() {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const token = params.get("token") || "";
  const desk = DESKS.includes(params.get("desk")) ? params.get("desk") : "citizen";
  const command = desk === "admin";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [done, setDone] = useState(false);
  const check = passwordCheck(password, { desk });

  const help = (
    <p className="pk-note">
      Didn't ask for this? Ignore the email, or write to{" "}
      <a href={supportMail(command ? "Command password reset" : "Password reset")} target="_blank" rel="noopener noreferrer">{SUPPORT_EMAIL}</a>.
    </p>
  );
  // sign-in opens on the same desk
  const signIn = <Link to="/login" state={{ role: desk }} className="pk-btn wide">Sign in</Link>;

  if (!token) {
    return (
      <AuthFrame tone={desk} title="This link is incomplete" sub="Open the full link from your reset email, or ask for a new one.">
        <p className="pk-state bad"><ShieldAlert size={18} /> The reset code is missing from the address.</p>
        <Link to="/login" state={{ role: desk }} className="pk-btn wide">Back to sign-in</Link>
      </AuthFrame>
    );
  }

  if (done) {
    return (
      <AuthFrame tone={desk} title="Password changed" sub="Your new password works from now on. Every other device has to sign in again.">
        <p className="pk-state ok"><CheckCircle2 size={18} /> Saved. The reset link can't be used again.</p>
        {signIn}
      </AuthFrame>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setMsg(null);
    if (!check.ok) return setMsg({ type: "bad", text: "Your password needs every rule below." });
    if (password !== confirm) return setMsg({ type: "bad", text: "The two passwords don't match." });
    setBusy(true);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err) {
      const text =
        err?.status === 422 ? err.message || "The server didn't accept that password. Check every rule below."
          : err?.status === 400 ? "This reset link has expired or was already used. Ask for a new one from the sign-in screen."
            : err?.status === 0 ? "The server isn't reachable right now. Try again in a minute; the link still works until it expires."
              : err?.message || "The password couldn't be changed.";
      setMsg({ type: "bad", text });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthFrame
      tone={desk}
      title={command ? "Set a new command password" : "Set a new password"}
      sub={command ? "Command opens the whole city record: at least 16 characters. A few unrelated words with a number and a symbol is easiest to remember." : "Choose a password you don't use anywhere else."}
    >
      <form onSubmit={submit} noValidate>
        <Field label="New password"><PasswordInput value={password} onChange={setPassword} autoComplete="new-password" placeholder="New password" autoFocus /></Field>
        <Field label="Confirm password"><PasswordInput value={confirm} onChange={setConfirm} autoComplete="new-password" placeholder="Type it again" /></Field>
        <PasswordRules password={password} confirm={confirm} desk={desk} />
        <Status msg={msg} />
        <Submit busy={busy} tone={desk}>Save new password</Submit>
      </form>
      {help}
    </AuthFrame>
  );
}
