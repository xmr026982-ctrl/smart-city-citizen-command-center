import { useEffect, useState } from "react";
import { Field, toast } from "./Controls";
import { useLiveFeed } from "../../hooks/useLiveFeed";
import { setMany, setSetting } from "../../store/settingsStore";
import {
  DEMO, DEMO_CODE, requestEmailChange, confirmEmailChange, changePassword,
  revokeSession, revokeOtherSessions, runSelfTest,
} from "../../services/settingsService";

/* ============================== EMAIL ============================== */
export function EmailPanel({ s }) {
  const [step, setStep] = useState(0);
  const [newEmail, setNewEmail] = useState("");
  const [pw, setPw] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [cool, setCool] = useState(0);

  useEffect(() => {
    if (cool <= 0) return undefined;
    const id = setTimeout(() => setCool((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cool]);

  const send = async () => {
    setErr(""); setBusy(true);
    try {
      await requestEmailChange({ newEmail: newEmail.trim(), password: pw });
      setStep(1); setCool(30);
      toast(`Verification code sent to ${newEmail.trim()}`, "info");
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const confirm = async () => {
    setErr(""); setBusy(true);
    try {
      await confirmEmailChange({ code: code.trim() });
      setMany({ email: newEmail.trim(), emailVerified: true });
      setStep(0); setNewEmail(""); setPw(""); setCode("");
      toast("Email address updated");
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="st-form">
      <div className="st-current">
        <span>Current email</span>
        <b>{s.email}</b>
        <em className={`st-badge ${s.emailVerified ? "ok" : "warn"}`}>{s.emailVerified ? "VERIFIED" : "UNVERIFIED"}</em>
      </div>

      {step === 0 ? (
        <>
          <div className="st-grid2">
            <Field label="New email address" type="email" value={newEmail} onChange={setNewEmail} placeholder="you@gmail.com" autoComplete="email" />
            <Field label="Current password" type="password" value={pw} onChange={setPw} autoComplete="current-password" />
          </div>
          {err && <p className="st-err">{err}</p>}
          <div className="st-actions">
            <button type="button" className="st-btn primary" disabled={busy || !newEmail || !pw} onClick={send}>
              {busy ? "Sending…" : "Send verification code"}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="st-note">We sent a 6-digit code to <b>{newEmail.trim()}</b>.{DEMO && <> Demo mode: no email is sent, use <b>{DEMO_CODE}</b>.</>}</p>
          <Field label="Verification code" value={code} onChange={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" maxLength={6} placeholder="000000" className="st-codefield" />
          {err && <p className="st-err">{err}</p>}
          <div className="st-actions">
            <button type="button" className="st-btn primary" disabled={busy || code.length !== 6} onClick={confirm}>{busy ? "Checking…" : "Confirm & switch"}</button>
            <button type="button" className="st-btn" disabled={cool > 0 || busy} onClick={send}>{cool > 0 ? `Resend in ${cool}s` : "Resend code"}</button>
            <button type="button" className="st-btn" onClick={() => { setStep(0); setErr(""); }}>Back</button>
          </div>
        </>
      )}
    </div>
  );
}

/* ============================== PASSWORD ============================== */
const RULES = [
  { t: "12+ characters", ok: (p) => p.length >= 12 },
  { t: "Upper & lower case", ok: (p) => /[a-z]/.test(p) && /[A-Z]/.test(p) },
  { t: "A number", ok: (p) => /\d/.test(p) },
  { t: "A symbol", ok: (p) => /[^A-Za-z0-9]/.test(p) },
];
const LEVELS = ["", "Weak", "Fair", "Good", "Strong"];

export function PasswordPanel({ s }) {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [others, setOthers] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const level = next ? RULES.filter((r) => r.ok(next)).length : 0;
  const mismatch = again && next !== again;
  const ready = cur && level >= 3 && next === again;
  const days = s.passwordChangedAt ? Math.max(0, Math.round((Date.now() - s.passwordChangedAt) / 864e5)) : null;

  const submit = async () => {
    setErr(""); setBusy(true);
    try {
      await changePassword({ current: cur, next });
      const patch = { passwordChangedAt: Date.now() };
      if (others) patch.sessions = (s.sessions || []).filter((x) => x.current);
      setMany(patch);
      setCur(""); setNext(""); setAgain("");
      toast(others ? "Password changed. Other devices signed out." : "Password changed");
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="st-form">
      <div className="st-current">
        <span>Last changed</span>
        <b>{days === null ? "Unknown" : days === 0 ? "Today" : `${days} days ago`}</b>
        <em className={`st-badge ${days !== null && days < 90 ? "ok" : "warn"}`}>{days !== null && days < 90 ? "FRESH" : "DUE"}</em>
      </div>

      <div className="st-grid2">
        <Field label="Current password" type="password" value={cur} onChange={setCur} autoComplete="current-password" />
        <span />
        <Field label="New password" type="password" value={next} onChange={setNext} autoComplete="new-password" />
        <Field label="Confirm new password" type="password" value={again} onChange={setAgain} autoComplete="new-password" error={mismatch ? "Passwords don't match." : ""} />
      </div>

      <div className="st-meterwrap">
        <div className="st-meter" data-l={level}><i /><i /><i /><i /></div>
        <span className="st-level">{LEVELS[level] || "Enter a password"}</span>
      </div>
      <ul className="st-rules">
        {RULES.map((r) => (<li key={r.t} className={r.ok(next) ? "ok" : ""}><i />{r.t}</li>))}
      </ul>

      <label className="st-check">
        <input type="checkbox" checked={others} onChange={(e) => setOthers(e.target.checked)} />
        Sign out of all other devices after changing
      </label>
      {DEMO && <p className="st-note">Demo mode: your current password isn't verified until the server is connected.</p>}
      {err && <p className="st-err">{err}</p>}
      <div className="st-actions">
        <button type="button" className="st-btn primary" disabled={busy || !ready} onClick={submit}>{busy ? "Updating…" : "Update password"}</button>
      </div>
    </div>
  );
}

/* ============================== SESSIONS ============================== */
function ago(ts) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 2) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

export function SessionsPanel({ s }) {
  const [busy, setBusy] = useState("");
  const list = s.sessions || [];
  const others = list.filter((x) => !x.current);

  const revoke = async (id) => {
    setBusy(id);
    try {
      await revokeSession(id);
      setSetting("sessions", list.filter((x) => x.id !== id));
      toast("Device signed out", "info");
    } finally { setBusy(""); }
  };
  const revokeAll = async () => {
    setBusy("all");
    try {
      await revokeOtherSessions();
      setSetting("sessions", list.filter((x) => x.current));
      toast("All other devices signed out");
    } finally { setBusy(""); }
  };

  return (
    <div className="st-sessions">
      <div className="st-sess-head">
        <span>ACTIVE DEVICES · {list.length}</span>
        {others.length > 0 && (
          <button type="button" className="st-btn danger" disabled={busy === "all"} onClick={revokeAll}>Sign out all others</button>
        )}
      </div>
      <ul>
        {list.map((x) => (
          <li key={x.id} className={x.current ? "cur" : ""}>
            <i />
            <div>
              <b>{x.device}{x.current && <em className="st-badge ok">THIS DEVICE</em>}</b>
              <span>{x.place} · {x.current ? "active now" : ago(x.ts)}</span>
            </div>
            {!x.current && (
              <button type="button" className="st-btn" disabled={busy === x.id} onClick={() => revoke(x.id)}>Sign out</button>
            )}
          </li>
        ))}
      </ul>
      {DEMO && <p className="st-note">Demo data: real devices appear once the server tracks sessions.</p>}
    </div>
  );
}

/* ============================== ROLES MATRIX (admin) ============================== */
const CAPS = [
  ["View city metrics", true, true, true],
  ["Report issues", true, true, true],
  ["Vote on proposals", true, true, false],
  ["Update issue status", false, "limited", true],
  ["Moderate reports", false, "limited", true],
  ["Assign work orders", false, false, true],
  ["Manage users & roles", false, false, true],
  ["Edit thresholds & policy", false, false, true],
  ["Export audit trail", false, false, true],
];
const cell = (v) => (v === true ? <span className="yes">✓</span> : v === "limited" ? <span className="part">◐ Limited</span> : <span className="no">—</span>);

export function RolesMatrix() {
  return (
    <div className="st-matrix">
      <table>
        <thead>
          <tr><th>Capability</th><th>Citizen</th><th>Staff</th><th>Admin</th></tr>
        </thead>
        <tbody>
          {CAPS.map(([name, a, b, c]) => (
            <tr key={name}><td>{name}</td><td>{cell(a)}</td><td>{cell(b)}</td><td>{cell(c)}</td></tr>
          ))}
        </tbody>
      </table>
      <p className="st-note">Reference only. Real enforcement is done by the server through JWT roles.</p>
    </div>
  );
}

/* ============================== DIAGNOSTICS ============================== */
export function DiagPanel() {
  const feed = useLiveFeed();
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true); setRes(null);
    try { setRes(await runSelfTest()); } finally { setBusy(false); }
  };

  return (
    <div className="st-diag">
      <div className="st-stats">
        <div><span>Feed mode</span><b>{feed.mode}</b></div>
        <div><span>Zones tracked</span><b>{Object.keys(feed.zones).length}</b></div>
        <div><span>Sensors</span><b>{feed.city.sensors.toLocaleString("en-US")}</b></div>
        <div><span>Uptime</span><b>{feed.city.uptime.toFixed(1)}%</b></div>
      </div>
      <div className="st-actions">
        <button type="button" className="st-btn primary" disabled={busy} onClick={run}>{busy ? "Scanning…" : "Run self-test"}</button>
      </div>
      {res && (
        <ul className="st-results">
          {res.map((r) => (<li key={r.name} className={r.ok ? "ok" : "bad"}><i />{r.name}<span>{r.detail}</span></li>))}
        </ul>
      )}
    </div>
  );
}

/* ============================== CONFIRM MODAL ============================== */
export function ConfirmModal({ cfg, onClose }) {
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (!cfg) return undefined;
    setTyped("");
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cfg, onClose]);

  if (!cfg) return null;
  const ok = !cfg.word || typed.trim().toUpperCase() === cfg.word;

  return (
    <div className="st-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="st-modal" role="dialog" aria-modal="true" aria-label={cfg.title}>
        <h3>{cfg.title}</h3>
        <p>{cfg.body}</p>
        {cfg.word && <Field label={`Type ${cfg.word} to confirm`} value={typed} onChange={setTyped} />}
        <div className="st-actions">
          <button type="button" className="st-btn" onClick={onClose}>Cancel</button>
          <button type="button" className={`st-btn ${cfg.danger ? "danger solid" : "primary"}`} disabled={!ok} onClick={() => { cfg.onConfirm(); onClose(); }}>
            {cfg.confirm || "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}