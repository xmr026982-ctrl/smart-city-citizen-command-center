import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Mail, KeyRound, MonitorSmartphone, Lock, LogOut, Send, ShieldCheck, Clock, ScanLine, BellOff, Moon, ArrowUpRight,
  Download, RotateCcw, Trash2, Server, Radio, Activity,
} from "lucide-react";
import { Field, Segmented, Toggle, TimeInput, toast } from "./Controls";
import { useLiveFeed } from "../../hooks/useLiveFeed";
import { useMinute } from "../../hooks/useMinute";
import { setMany, setSetting } from "../../store/settingsStore";
import { logout, replaceToken, sessionClock, setSignOutNote } from "../../store/authStore";
import { GROUPS, GROUP_HINT, LOCKED_GROUPS, mutedGroups, inQuietHours } from "../../store/notifyStore";
import { rosterEntryOf } from "../../store/dutyStore";
import { expertiseLabel } from "../../config/expertise";
import { PASSWORD_RULES, COMMAND_MIN, passwordCheck } from "../../services/authService";
import { SERVER_ON } from "../../config/server";
import { clock } from "../../utils/time";
import {
  onServer, requestEmailChange, changePassword, sendOwnResetLink, listSessions, revokeSession, signOutEverywhere,
  deviceName, checkDevice, feedHealth,
} from "../../services/settingsService";

/* ------------------------------------------------------------------
   Settings panels with their own logic. Every button here either
   works now or asks the server; nothing pretends.
------------------------------------------------------------------- */

const maskEmail = (e = "") => {
  const [u, d] = String(e).split("@");
  if (!d) return e;
  return `${u.slice(0, 2)}${"•".repeat(Math.max(2, Math.min(6, u.length - 2)))}@${d}`;
};

function left(ms) {
  if (ms <= 0) return "ending";
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} h ${m % 60} min`;
  return `${Math.round(h / 24)} days`;
}

function useCooldown() {
  const [cool, setCool] = useState(0);
  useEffect(() => {
    if (cool <= 0) return undefined;
    const id = setTimeout(() => setCool((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cool]);
  return [cool, setCool];
}

function Block({ icon: Icon, title, badge, children }) {
  return (
    <div className="st-block">
      <div className="st-block-h">
        <Icon size={14} />
        <span>{title}</span>
        {badge ? <em className={`st-badge ${badge.tone || ""}`}>{badge.text}</em> : null}
      </div>
      {children}
    </div>
  );
}

/* ============================== SIGN-IN & SECURITY ============================== */
export function SignInPanel({ role, me, s, onConfirm }) {
  return (
    <div className="st-signin">
      <EmailBlock role={role} me={me} s={s} />
      <PasswordBlock role={role} me={me} />
      <SessionsBlock me={me} onConfirm={onConfirm} />
    </div>
  );
}

function EmailBlock({ role, me, s }) {
  const server = onServer();
  const google = me.provider === "google";
  const [open, setOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [cool, setCool] = useCooldown();
  const pending = s.pendingEmail;

  const badge = !server ? { text: "SAMPLE", tone: "" }
    : google ? { text: "GOOGLE", tone: "ok" }
      : role === "citizen" ? { text: "SIGN-IN", tone: "ok" }
        : { text: "LOCKED", tone: "lock" };

  const send = async (to = newEmail, password = pw) => {
    setErr(""); setBusy(true);
    try {
      await requestEmailChange({ newEmail: to, password });
      setMany({ pendingEmail: to.trim().toLowerCase(), pendingEmailAt: Date.now() });
      setOpen(false); setNewEmail(""); setPw(""); setCool(60);
      toast(`Confirmation link sent to ${to.trim()}`, "info");
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  let body;
  if (!server) {
    body = <p className="st-note">A developer desk has no account email. Sign in through the server to manage it.</p>;
  } else if (role === "staff") {
    body = <p className="st-note"><Lock size={12} /> Your work email is set by command when it clears you. To change it, ask an admin on the Staff Desk.</p>;
  } else if (role === "admin") {
    body = <p className="st-note"><Lock size={12} /> The command sign-in is managed on the server. The server administrator changes it.</p>;
  } else if (google) {
    body = <p className="st-note">Your email comes from your Google account. To use a different address, create an account with it.</p>;
  } else if (pending) {
    body = (
      <div className="st-pending">
        <p><Send size={13} /><span>Waiting for you to confirm <b>{pending}</b>. Open the link in that inbox; until then you keep signing in with your current email.</span></p>
        {err && <p className="st-err">{err}</p>}
        <div className="st-actions">
          <button type="button" className="st-btn" onClick={() => { setMany({ pendingEmail: "", pendingEmailAt: 0 }); setErr(""); }}>Cancel change</button>
        </div>
        <p className="st-fine">The link works once and expires. Didn't get it? Check spam, or cancel and start again.{cool > 0 ? ` You can ask again in ${cool}s.` : ""}</p>
      </div>
    );
  } else if (!open) {
    body = <div className="st-actions"><button type="button" className="st-btn" onClick={() => setOpen(true)}><Mail size={14} /> Change email</button></div>;
  } else {
    body = (
      <form className="st-form tight" onSubmit={(e) => { e.preventDefault(); if (!busy && cool <= 0) send(); }}>
        <div className="st-grid2">
          <Field label="New email address" type="email" value={newEmail} onChange={setNewEmail} placeholder="you@example.com" autoComplete="email" />
          <Field label="Current password" type="password" value={pw} onChange={setPw} autoComplete="current-password" />
        </div>
        <p className="st-fine">We send a confirmation link to the new address. Your email changes only when you open it.</p>
        {err && <p className="st-err">{err}</p>}
        <div className="st-actions">
          <button type="submit" className="st-btn primary" disabled={busy || !newEmail || !pw || cool > 0}>{busy ? "Sending…" : cool > 0 ? `Wait ${cool}s` : "Send confirmation link"}</button>
          <button type="button" className="st-btn" onClick={() => { setOpen(false); setErr(""); setPw(""); }}>Cancel</button>
        </div>
      </form>
    );
  }

  return (
    <Block icon={Mail} title="Sign-in email" badge={badge}>
      <div className="st-current"><span>Email</span><b className="st-mono">{me.email || "None on this desk"}</b></div>
      {body}
    </Block>
  );
}

function PasswordBlock({ role, me }) {
  const server = onServer();
  const google = me.provider === "google";
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(false);
  const [cool, setCool] = useCooldown();

  const check = passwordCheck(next, { email: me.email, name: me.name });
  const mismatch = again && next !== again;
  const ready = cur && check.ok && next === again;

  const submit = async (e) => {
    e.preventDefault();
    if (!ready || busy) return;
    setErr(""); setBusy(true);
    try {
      const data = await changePassword({ current: cur, next });
      if (data?.token) replaceToken(data.token);
      setCur(""); setNext(""); setAgain("");
      toast("Password changed. Every other device has to sign in again.");
    } catch (e2) { setErr(e2.status === 401 || e2.status === 400 ? e2.message || "Your current password isn't right." : e2.message); } finally { setBusy(false); }
  };

  const sendLink = async () => {
    setErr(""); setBusy(true);
    try {
      await sendOwnResetLink();
      setSent(true); setCool(60);
      toast("Reset link sent", "info");
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  let body;
  let badge = null;
  if (!server) {
    body = <p className="st-note">A developer desk has no password. Sign in through the server to change yours.</p>;
  } else if (google) {
    badge = { text: "GOOGLE", tone: "ok" };
    body = (
      <p className="st-note">You sign in with Google, so there's no password here. Google keeps it safe:{" "}
        <a className="st-link" href="https://myaccount.google.com/security" target="_blank" rel="noopener noreferrer">Google account security <ArrowUpRight size={12} /></a>
      </p>
    );
  } else if (role === "staff" || role === "admin") {
    badge = { text: "BY EMAIL", tone: "" };
    body = (
      <>
        <p className="st-note">
          {role === "admin"
            ? <>For the city record's safety, the command password changes only through a one-time link sent to the command email. The new one needs at least {COMMAND_MIN} characters.</>
            : "For your safety, a field password changes only through a one-time link sent to your work email."}
        </p>
        {sent && <p className="st-ok"><Send size={13} /><span>Sent to {maskEmail(me.email)}. The link works once and expires; open it on any device.</span></p>}
        {err && <p className="st-err">{err}</p>}
        <div className="st-actions">
          <button type="button" className="st-btn primary" disabled={busy || cool > 0} onClick={sendLink}>
            <Send size={14} /> {busy ? "Sending…" : cool > 0 ? `Send again in ${cool}s` : sent ? "Send again" : "Email me a reset link"}
          </button>
        </div>
      </>
    );
  } else {
    body = (
      <form className="st-form tight" onSubmit={submit}>
        <div className="st-grid2">
          <Field label="Current password" type="password" value={cur} onChange={setCur} autoComplete="current-password" />
          <span className="st-gap" />
          <Field label="New password" type="password" value={next} onChange={setNext} autoComplete="new-password" />
          <Field label="Confirm new password" type="password" value={again} onChange={setAgain} autoComplete="new-password" error={mismatch ? "Passwords don't match." : ""} />
        </div>
        <div className="st-meterwrap">
          <div className="st-meter" data-l={next ? Math.max(1, check.score) : 0}><i /><i /><i /><i /></div>
          <span className="st-level">{!next ? "Enter a password" : check.ok ? "Strong" : check.common ? "Too common" : check.personal ? "Uses your name" : ["Weak", "Weak", "Fair", "Good", "Good"][check.score]}</span>
        </div>
        <ul className="st-rules">
          {PASSWORD_RULES.map((r) => (<li key={r.id} className={check.passed.includes(r.id) ? "ok" : ""}><i />{r.label}</li>))}
          <li className={next && !check.personal && !check.common ? "ok" : ""}><i />Not your name or email</li>
        </ul>
        <p className="st-fine">Changing it signs out every other device.</p>
        {err && <p className="st-err">{err}</p>}
        <div className="st-actions">
          <button type="submit" className="st-btn primary" disabled={busy || !ready}><KeyRound size={14} /> {busy ? "Updating…" : "Update password"}</button>
        </div>
      </form>
    );
  }

  return <Block icon={KeyRound} title="Password" badge={badge}>{body}</Block>;
}

function SessionsBlock({ me, onConfirm }) {
  const now = useMinute();
  const navigate = useNavigate();
  const server = onServer();
  const clk = sessionClock();
  const [others, setOthers] = useState(null); // null = not listed by the server
  const [busy, setBusy] = useState("");

  useEffect(() => {
    if (!server) return undefined;
    let live = true;
    listSessions()
      .then((list) => { if (live) setOthers(list ? list.filter((x) => !x.current) : null); })
      .catch(() => { if (live) setOthers(null); });
    return () => { live = false; };
  }, [server]);

  const revoke = async (id) => {
    setBusy(id);
    try {
      await revokeSession(id);
      setOthers((l) => (l || []).filter((x) => x.id !== id));
      toast("That device is signed out", "info");
    } catch (e) { toast(e.message || "That device couldn't be signed out", "warn"); } finally { setBusy(""); }
  };

  const signOutHere = () => { logout(); navigate("/login", { replace: true }); };

  const everywhere = () => onConfirm({
    title: "Sign out everywhere?",
    body: "Every device signed in to this account closes, this one included. You'll need your password (or Google) to come back.",
    confirm: "Sign out everywhere", danger: true,
    run: async () => {
      await signOutEverywhere();
      setSignOutNote("You signed out on every device.");
      logout();
      navigate("/login", { replace: true });
    },
  });

  const ends = clk?.exp ? clk.exp - now : null;
  const share = clk?.exp && clk?.iat ? Math.max(0, Math.min(1, (clk.exp - now) / (clk.exp - clk.iat))) : 1;

  return (
    <Block icon={MonitorSmartphone} title="Where you're signed in" badge={others && others.length ? { text: `${others.length + 1} DEVICES` } : null}>
      <ul className="st-devices">
        <li className="cur">
          <span className="st-dev-ring" style={{ "--p": share }} aria-hidden><i /></span>
          <div>
            <b>{deviceName()} <em className="st-badge ok">THIS DEVICE</em></b>
            <span>
              {server
                ? <>Signed in {clk?.iat ? `${clock(clk.iat)} IST` : "with the server"}{ends !== null ? <> · session ends {clock(clk.exp)} IST <em className="st-left">{left(ends)} left</em></> : null}</>
                : "Developer desk · sample data, this browser only"}
            </span>
          </div>
          <button type="button" className="st-btn" onClick={signOutHere}><LogOut size={14} /> Sign out</button>
        </li>
        {(others || []).map((x) => (
          <li key={x.id}>
            <span className="st-dev-dot" aria-hidden />
            <div>
              <b>{x.device || "Another device"}</b>
              <span>{[x.place, x.lastSeen ? `last active ${clock(x.lastSeen)} IST` : ""].filter(Boolean).join(" · ") || "Signed in"}</span>
            </div>
            <button type="button" className="st-btn" disabled={busy === x.id} onClick={() => revoke(x.id)}>Sign out</button>
          </li>
        ))}
      </ul>
      {server && (
        <div className="st-actions">
          <button type="button" className="st-btn danger" onClick={everywhere}><ShieldCheck size={14} /> Sign out everywhere</button>
          <span className="st-fine">Lost a phone or used a shared computer? This closes every session at once.</span>
        </div>
      )}
    </Block>
  );
}

/* ============================== ALERTS ============================== */
const POPUP_OPTIONS = [{ v: "all", l: "Everything" }, { v: "urgent", l: "Urgent only" }, { v: "off", l: "Off" }];

export function AlertsPanel({ role, s }) {
  const navigate = useNavigate();
  useMinute();
  const locked = LOCKED_GROUPS[role] || [];
  const muted = mutedGroups(role, s);
  const quietNow = inQuietHours(s);
  const flip = (g) => setSetting("inboxMuted", muted.includes(g) ? muted.filter((x) => x !== g) : [...muted, g]);

  return (
    <div className="st-alerts">
      <div className="st-alert-sec">
        <div className="st-info">
          <span className="st-label">In your inbox <em className="st-tag account">ACCOUNT</em></span>
          <p>Muted groups leave your inbox, the unread count and pop-ups. Locked ones carry work you must act on.</p>
        </div>
        <div className="st-groups" style={{ "--cols": GROUPS[role].length === 4 ? 2 : 3 }}>
          {GROUPS[role].map((g) => {
            const isLocked = locked.includes(g.id);
            const on = isLocked || !muted.includes(g.id);
            return (
              <div key={g.id} className={`st-group${on ? " on" : ""}${isLocked ? " locked" : ""}`}>
                <div>
                  <b>{g.label}</b>
                  <small>{GROUP_HINT[g.id] || ""}</small>
                </div>
                {isLocked
                  ? <span className="st-always"><Lock size={11} /> Always on</span>
                  : <Toggle checked={on} onChange={() => flip(g.id)} label={`${g.label} in my inbox`} />}
              </div>
            );
          })}
        </div>
      </div>

      <div className="st-row">
        <div className="st-info">
          <span className="st-label">Pop-up alerts <em className="st-tag account">ACCOUNT</em></span>
          <p>New notifications that slide in on any page. Urgent means decisions, breaches, new work and problems after a fix.</p>
        </div>
        <div className="st-ctl"><Segmented value={s.popups || "all"} options={POPUP_OPTIONS} onChange={(v) => setSetting("popups", v)} label="Pop-up alerts" /></div>
      </div>

      <div className="st-row">
        <div className="st-info">
          <span className="st-label"><Moon size={13} className="st-ic" /> Quiet hours {quietNow && <em className="st-tag saving">QUIET NOW</em>}</span>
          <p>Between these times (IST) only urgent alerts pop up. Everything still lands in your inbox.</p>
        </div>
        <div className="st-ctl st-quiet">
          <Toggle checked={!!s.quietHours} onChange={(v) => setSetting("quietHours", v)} label="Quiet hours" />
          <TimeInput value={s.quietFrom} onChange={(v) => setSetting("quietFrom", v)} label="Quiet from" />
          <span className="st-to">to</span>
          <TimeInput value={s.quietTo} onChange={(v) => setSetting("quietTo", v)} label="Quiet until" />
        </div>
      </div>

      <div className="st-alert-foot">
        <span>{muted.length ? <><BellOff size={13} /> {muted.length} group{muted.length === 1 ? "" : "s"} muted</> : "Nothing muted"}</span>
        <button type="button" className="st-btn" onClick={() => navigate("/notifications")}>Open Notifications <ArrowUpRight size={13} /></button>
      </div>
    </div>
  );
}

/* ============================== THIS DEVICE (Display & 3D) ============================== */
const PERF_NAME = { high: "High", balanced: "Balanced", lite: "Lite" };

export function DevicePanel({ s }) {
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const run = async () => {
    setBusy(true); setRes(null);
    try { setRes(await checkDevice()); } finally { setBusy(false); }
  };
  return (
    <div className="st-device">
      <div className="st-device-h">
        <div className="st-info">
          <span className="st-label"><ScanLine size={14} className="st-ic" /> Check this device</span>
          <p>Measures graphics, processor and frame rate, then suggests the 3D quality that stays smooth here.</p>
        </div>
        <button type="button" className="st-btn primary" disabled={busy} onClick={run}>{busy ? "Measuring…" : res ? "Check again" : "Run check"}</button>
      </div>
      {busy && <div className="st-scan" aria-hidden><i /></div>}
      {res && (
        <>
          <ul className="st-results">
            {res.checks.map((r) => (<li key={r.name} className={r.ok ? "ok" : "bad"}><i />{r.name}<span>{r.detail}</span></li>))}
          </ul>
          <div className="st-reco">
            <span>Suggested: <b>{PERF_NAME[res.recommend]}</b> · {res.reason}</span>
            {s.perfMode === res.recommend
              ? <em className="st-badge ok">IN USE</em>
              : <button type="button" className="st-btn primary" onClick={() => { setSetting("perfMode", res.recommend); toast(`3D quality set to ${PERF_NAME[res.recommend]}`); }}>Use {PERF_NAME[res.recommend]}</button>}
          </div>
        </>
      )}
    </div>
  );
}

/* ============================== ROSTER (staff) ============================== */
export function RosterPanel({ me }) {
  const p = rosterEntryOf(me);
  const items = [
    ["Rank", p?.rank],
    ["Expertise", p?.expertise ? expertiseLabel(p.expertise) : ""],
    ["Zone", p?.zone || me.ward],
    ["Experience", p?.experience],
  ].filter(([, v]) => v);
  return (
    <div className="st-roster">
      {items.length ? items.map(([k, v]) => (
        <div key={k}><span>{k}</span><b>{v}</b></div>
      )) : <p className="st-note">Command sets your rank, expertise and zone when it clears you.</p>}
      <p className="st-fine"><Lock size={11} /> Set by command on the Staff Desk. Dispatch matches work to your expertise and zone.</p>
    </div>
  );
}

/* ============================== ACCESS BY ROLE (admin) ============================== */
const CAPS = [
  ["See city health and the map", true, true, true],
  ["Report issues and follow fixes", true, false, false],
  ["Back proposals and vote in polls", true, false, false],
  ["Update work on site", false, "own", true],
  ["Post work notices", false, true, true],
  ["Answer proposals", false, "zone", true],
  ["Close an issue", false, "asks", true],
  ["Dispatch crews and set service windows", false, false, true],
  ["Announcements and polls", false, false, true],
  ["Clear new staff (Staff Desk)", false, false, true],
];
const PART = { own: "Own work", zone: "Own zone", asks: "Asks command" };
const cell = (v) => (v === true ? <span className="yes">✓</span> : v ? <span className="part">{PART[v]}</span> : <span className="no">—</span>);

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
      <p className="st-note">The server enforces these on every request from the role in the sign-in token. Hiding a button is never the lock.</p>
    </div>
  );
}

/* ============================== SYSTEM STATUS (admin) ============================== */
export function DiagPanel() {
  const feed = useLiveFeed();
  useMinute();
  const h = feedHealth();
  const server = onServer();
  return (
    <div className="st-diag">
      <div className="st-stats">
        <div className={server ? "ok" : "warn"}><span><Server size={11} /> Server</span><b>{server ? "Connected" : SERVER_ON ? "Developer desk" : "Local only"}</b></div>
        <div className={h.ok ? "ok" : "warn"}><span><Radio size={11} /> Live feed</span><b>{feed.mode}</b><small>updated {h.age}s ago</small></div>
        <div><span><Activity size={11} /> Zones tracked</span><b>{Object.keys(feed.zones).length}</b></div>
        <div><span><Clock size={11} /> Uptime</span><b>{feed.city.uptime.toFixed(1)}%</b><small>{feed.city.sensors.toLocaleString("en-IN")} sensors</small></div>
      </div>
    </div>
  );
}

/* ============================== DATA & ACCOUNT ============================== */
export function DataPanel({ role, onExport, onReset, onDelete }) {
  const server = onServer();
  return (
    <div className="st-data">
      <div className="st-row">
        <div className="st-info"><span className="st-label">Download my settings</span><p>Everything on this page as a JSON file. No password, token or photo is in it.</p></div>
        <div className="st-ctl"><button type="button" className="st-btn" onClick={onExport}><Download size={14} /> Download</button></div>
      </div>
      <div className="st-row">
        <div className="st-info"><span className="st-label">Reset this device</span><p>Screen preferences on this browser go back to their defaults. Your account isn't touched.</p></div>
        <div className="st-ctl"><button type="button" className="st-btn" onClick={onReset}><RotateCcw size={14} /> Reset</button></div>
      </div>
      {role === "citizen" && (
        <div className="st-row danger">
          <div className="st-info">
            <span className="st-label">Delete my account</span>
            <p>{server ? "Removes your account and signs you out. Your reports stay on the board without your name, so crews can still fix them." : "Needs a server sign-in."}</p>
          </div>
          <div className="st-ctl"><button type="button" className="st-btn danger" disabled={!server} onClick={onDelete}><Trash2 size={14} /> Delete…</button></div>
        </div>
      )}
      {role === "staff" && <p className="st-note pad">Leaving the field roster? Ask command: an admin removes your access on the Staff Desk.</p>}
      {role === "admin" && <p className="st-note pad">Command accounts are created and removed on the server.</p>}
    </div>
  );
}

/* ============================== CONFIRM MODAL ============================== */
/* cfg: { title, body, confirm, danger, word?, password?, run: async ({ password }) } */
export function ConfirmModal({ cfg, onClose }) {
  const [typed, setTyped] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!cfg) return undefined;
    setTyped(""); setPassword(""); setErr(""); setBusy(false);
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cfg, onClose]);

  if (!cfg) return null;
  const ok = (!cfg.word || typed.trim().toUpperCase() === cfg.word) && (!cfg.password || password);

  const go = async () => {
    if (!ok || busy) return;
    setErr(""); setBusy(true);
    try {
      await cfg.run({ password });
      onClose();
    } catch (e) {
      setErr(e?.message || "That didn't work.");
      setBusy(false);
    }
  };

  return (
    <div className="st-back" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <form className="st-modal" role="dialog" aria-modal="true" aria-label={cfg.title} onSubmit={(e) => { e.preventDefault(); go(); }}>
        <h3>{cfg.title}</h3>
        <p>{cfg.body}</p>
        {cfg.password && <Field label="Your password" type="password" value={password} onChange={setPassword} autoComplete="current-password" />}
        {cfg.word && <Field label={`Type ${cfg.word} to confirm`} value={typed} onChange={setTyped} />}
        {err && <p className="st-err">{err}</p>}
        <div className="st-actions">
          <button type="button" className="st-btn" disabled={busy} onClick={onClose}>Cancel</button>
          <button type="submit" className={`st-btn ${cfg.danger ? "danger solid" : "primary"}`} disabled={!ok || busy}>
            {busy ? "Working…" : cfg.confirm || "Confirm"}
          </button>
        </div>
      </form>
    </div>
  );
}
