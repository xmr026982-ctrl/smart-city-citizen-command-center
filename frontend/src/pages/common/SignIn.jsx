import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { login, useAuth } from "../../store/authStore";
import Button from "../../components/ui/Button";
import { Input, Label } from "../../components/ui/Input";

const HOME = {
  citizen: "/citizen/report",
  staff: "/staff/assigned",
  admin: "/admin/command",
};

function SignIn() {
  const session = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  if (session) return <Navigate to={HOME[session.role]} replace />;

  const handleSubmit = (event) => {
    event.preventDefault();
    const result = login(email, password);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    navigate(HOME[result.user.role], { replace: true });
  };

  return (
    <main className="signin-shell">
      <section className="signin-panel">
        <div className="signin-brand">
          <span className="sidebar-mark">W</span>
          <div>
            <strong>Wardline</strong>
            <p className="mono">Issue Command · Secure session</p>
          </div>
        </div>

        <p className="eyebrow" style={{ marginTop: 28 }}>Authorized access</p>
        <h1 style={{ marginTop: 10, fontSize: 36 }}>Sign in to your desk</h1>
        <p style={{ marginTop: 10, color: "var(--muted)", maxWidth: 420 }}>
          This session is locked to your assigned identity. You cannot open another
          staff, admin, or citizen account from here.
        </p>

        <form className="signin-form" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <Label htmlFor="email" required>
              Official email
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              invalid={Boolean(error)}
              placeholder="your.name@smartcity.in"
              onChange={(e) => {
                setEmail(e.target.value);
                setError("");
              }}
            />
          </div>

          <div className="field">
            <Label htmlFor="password" required>
              Access key
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              invalid={Boolean(error)}
              placeholder="Enter your access key"
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
            />
            {error ? <p className="field-error">{error}</p> : null}
          </div>

          <Button type="submit">Enter command desk</Button>
        </form>

        <p className="signin-note">
          Person 1 will replace this gate with JWT login. Until then, use only the
          credentials issued to you.
        </p>
      </section>
    </main>
  );
}

export default SignIn;