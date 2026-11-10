import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { CheckCircle2, ShieldAlert, Loader2 } from "lucide-react";
import { AuthFrame } from "../../components/public/PublicKit";
import { confirmEmailChange } from "../../services/settingsService";
import { useAuth, updateSessionUser } from "../../store/authStore";
import { SUPPORT_EMAIL, supportMail } from "../../config/server";

/* ------------------------------------------------------------------
   /confirm-email?token=…  (the link sent to a new email address from
   Settings · Sign-in & Security). Confirms once, signed in or not.
   The email changes only here, after the person proves the inbox.
------------------------------------------------------------------- */
export default function ConfirmEmail() {
  const { search } = useLocation();
  const token = new URLSearchParams(search).get("token") || "";
  const me = useAuth();
  const [state, setState] = useState(token ? "working" : "missing"); // working | done | bad | missing
  const [email, setEmail] = useState("");
  const [why, setWhy] = useState("");
  const asked = useRef(false);

  useEffect(() => {
    if (!token || asked.current) return;
    asked.current = true;
    confirmEmailChange(token)
      .then((data) => {
        const user = data?.user;
        if (user) {
          setEmail(user.email || "");
          updateSessionUser(user); // only acts when this browser holds that account
        }
        setState("done");
      })
      .catch((err) => {
        setWhy(err?.status === 0 ? "The server isn't reachable right now. Try the link again in a minute." : "");
        setState("bad");
      });
  }, [token]);

  const next = me ? <Link to="/settings#signin" className="pk-btn wide">Back to Settings</Link> : <Link to="/login" className="pk-btn wide">Sign in</Link>;

  if (state === "missing") {
    return (
      <AuthFrame title="This link is incomplete" sub="Open the full link from the confirmation email.">
        <p className="pk-state bad"><ShieldAlert size={18} /> The confirmation code is missing from the address.</p>
        {next}
      </AuthFrame>
    );
  }
  if (state === "working") {
    return (
      <AuthFrame title="Confirming your email" sub="One moment while the server checks the link.">
        <p className="pk-state"><Loader2 size={18} className="pk-spin" /> Checking…</p>
      </AuthFrame>
    );
  }
  if (state === "bad") {
    return (
      <AuthFrame title="This link can't be used" sub={why || "It has expired or was already used. Your email hasn't changed."}>
        <p className="pk-state bad"><ShieldAlert size={18} /> Start the change again from Settings to get a fresh link.</p>
        {next}
        <p className="pk-note">Didn't ask for this? Write to <a href={supportMail("Email change")} target="_blank" rel="noopener noreferrer">{SUPPORT_EMAIL}</a>.</p>
      </AuthFrame>
    );
  }
  return (
    <AuthFrame title="Email confirmed" sub={email ? `You now sign in with ${email}.` : "You now sign in with your new email."}>
      <p className="pk-state ok"><CheckCircle2 size={18} /> The old address no longer works for sign-in. The link can't be used again.</p>
      {next}
    </AuthFrame>
  );
}
