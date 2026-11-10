import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Building2, Eye, EyeOff, Check, ArrowLeft, MapPin, Mail, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { PRODUCT, SUPPORT_EMAIL, supportMail } from "../../config/server";
import { rulesFor, passwordCheck, ZONES } from "../../services/authService";
import "../../styles/public.css";

/* ------------------------------------------------------------------
   The public side of Smart Kolkata: the site (Home, Preview, About,
   Contact) and the sign-in pages. One look, one set of parts.
------------------------------------------------------------------- */

export const HERO_VIDEO = "/media/hero.mp4";
export const HERO_POSTER = "/media/hero-poster.jpg";

export function BrandMark({ to = "/", sub = "Citizen Command Center", tone = "" }) {
  return (
    <Link to={to} className={`pk-brand ${tone}`} aria-label={`${PRODUCT} home`}>
      <span className="pk-brand-mark"><Building2 size={18} strokeWidth={1.8} /><i /></span>
      <span className="pk-brand-text">
        <b>{PRODUCT}</b>
        <small>{sub}</small>
      </span>
    </Link>
  );
}

/* The hero film: muted, looping, never blocks the page. Respects reduced motion. */
export function HeroVideo({ className = "" }) {
  const ref = useRef(null);
  const [still, setStill] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const apply = () => setStill(Boolean(mq?.matches));
    apply();
    mq?.addEventListener?.("change", apply);
    return () => mq?.removeEventListener?.("change", apply);
  }, []);
  useEffect(() => {
    const v = ref.current;
    if (!v) return undefined;
    // pause when the tab is hidden: no work for a film nobody sees
    const onVis = () => { if (document.hidden) v.pause(); else if (!still) v.play().catch(() => {}); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [still]);
  if (still) return <img className={`pk-video ${className}`} src={HERO_POSTER} alt="" aria-hidden />;
  return (
    <video
      ref={ref}
      className={`pk-video ${className}`}
      src={HERO_VIDEO}
      poster={HERO_POSTER}
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      aria-hidden
      tabIndex={-1}
    />
  );
}

const LINKS = [
  { to: "/", label: "Home", end: true },
  { to: "/preview", label: "Preview" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
];

export function SiteNav({ over = false }) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);
  return (
    <header className={`pk-nav${over ? " over" : ""}${open ? " open" : ""}`}>
      <BrandMark />
      <nav aria-label="Main">
        {LINKS.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? "on" : "")}>{l.label}</NavLink>
        ))}
      </nav>
      <div className="pk-nav-act">
        <Link to="/login" className="pk-btn ghost sm">Sign in</Link>
        <Link to="/register" className="pk-btn sm">Create account</Link>
      </div>
      <button type="button" className="pk-burger" aria-label="Menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}><i /><i /><i /></button>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="pk-foot">
      <div className="pk-foot-l">
        <b>© 2026 {PRODUCT}</b>
        <span>An independent civic project, not affiliated with the Kolkata Municipal Corporation.</span>
      </div>
      <div className="pk-foot-r">
        <Link to="/contact">Contact</Link>
        <a href={supportMail()} target="_blank" rel="noopener noreferrer"><Mail size={12} /> {SUPPORT_EMAIL}</a>
        <span className="pk-foot-credit">Film: Kolkata at night, a 3D render made for {PRODUCT}</span>
      </div>
    </footer>
  );
}

/* Site pages: nav on top, footer below. Home draws its own nav over the film. */
export function PublicLayout() {
  const { pathname } = useLocation();
  const home = pathname === "/";
  return (
    <div className={`pk-site${home ? " home" : ""}`}>
      {home ? null : <SiteNav />}
      <Outlet />
      <SiteFooter />
    </div>
  );
}

/* ------------------------------------------------------------------
   Sign-in frame: the film on the left (with a line about the desk you
   are opening), the form on the right. Each role brings its accent.
------------------------------------------------------------------- */
const TONE_COPY = {
  citizen: ["Citizen services", "Report it, follow it, see it fixed. Every report reaches the crew that fixes it."],
  staff: ["Field desk", "Your files, your zone, your service windows. Command confirms every close."],
  admin: ["Civic command", "Dispatch, service windows, the Staff Desk and the record of every action."],
  "": ["Citizen Command Center", "One live system for Kolkata's citizens, field crews and city command."],
};

export function AuthFrame({ tone = "", title, sub, back, children, wide = false }) {
  const [k, line] = TONE_COPY[tone] || TONE_COPY[""];
  return (
    <main className={`pk-auth tone-${tone || "city"}`}>
      <aside className="pk-auth-film" aria-hidden>
        <HeroVideo />
        <div className="pk-auth-shade" />
        <div className="pk-auth-film-top"><BrandMark sub="Citizen Command Center" tone="light" /></div>
        <div className="pk-auth-film-copy">
          <p className="pk-kick"><i />{k}</p>
          <p className="pk-auth-line">{line}</p>
        </div>
      </aside>
      <section className="pk-auth-side">
        <div className="pk-auth-top">
          <span className="pk-auth-mini"><BrandMark /></span>
          {back ? <Link to={back.to} state={back.state} className="pk-back"><ArrowLeft size={14} /> {back.label}</Link> : <Link to="/" className="pk-back"><ArrowLeft size={14} /> Home</Link>}
        </div>
        <div className={`pk-card${wide ? " wide" : ""}`}>
          <i className="pk-card-br tl" aria-hidden /><i className="pk-card-br br" aria-hidden />
          {title ? <h1 className="pk-title">{title}</h1> : null}
          {sub ? <p className="pk-sub">{sub}</p> : null}
          {children}
        </div>
        <p className="pk-auth-legal">Signing in is checked by the server every time. {PRODUCT} never asks for your password by email or phone.</p>
      </section>
    </main>
  );
}

export function Field({ label, hint, children, error }) {
  return (
    <label className={`pk-field${error ? " bad" : ""}`}>
      <span className="pk-label">{label}{hint ? <em>{hint}</em> : null}</span>
      {children}
    </label>
  );
}

export function PasswordInput({ value, onChange, autoComplete = "current-password", placeholder = "Password", autoFocus = false, id }) {
  const [show, setShow] = useState(false);
  return (
    <div className="pk-pass">
      <input
        id={id}
        className="pk-in"
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        autoFocus={autoFocus}
        spellCheck={false}
      />
      <button type="button" className="pk-eye" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"} tabIndex={-1}>
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}

/* Live rules under a new password: each lights up as it's met, plus a strength bar. */
export function PasswordRules({ password, email, name, confirm, desk = "" }) {
  const c = passwordCheck(password, { email, name, desk });
  const match = confirm !== undefined ? Boolean(password) && password === confirm : null;
  return (
    <div className="pk-rules" aria-live="polite">
      <span className={`pk-meter s${password ? Math.max(1, c.score) : 0}`}><i /><i /><i /><i /></span>
      <ul>
        {rulesFor(desk).map((r) => (
          <li key={r.id} className={c.passed.includes(r.id) ? "ok" : ""}><Check size={11} /> {r.label}</li>
        ))}
        {match !== null ? <li className={match ? "ok" : ""}><Check size={11} /> Both entries match</li> : null}
      </ul>
      {password && c.personal ? <p className="pk-warn"><AlertTriangle size={12} /> Don't use your name or email in your password.</p> : null}
      {password && c.common ? <p className="pk-warn"><AlertTriangle size={12} /> That password is too easy to guess.</p> : null}
    </div>
  );
}

export function ZonePicker({ value, onChange, label = "Your zone" }) {
  return (
    <div className="pk-field">
      <span className="pk-label">{label}<em>Your City Health, Community and alerts follow it</em></span>
      <div className="pk-zones" role="radiogroup" aria-label={label}>
        {ZONES.map((z) => (
          <button key={z} type="button" role="radio" aria-checked={value === z} className={value === z ? "on" : ""} onClick={() => onChange(z)}>
            <MapPin size={12} /> {z}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Status({ msg }) {
  if (!msg?.text) return null;
  const Icon = msg.type === "ok" ? CheckCircle2 : AlertTriangle;
  return (
    <p className={`pk-status ${msg.type === "ok" ? "ok" : "bad"}`} role={msg.type === "ok" ? "status" : "alert"}>
      <Icon size={14} /> <span>{msg.text}</span>
    </p>
  );
}

export function Submit({ busy, children, disabled, tone = "" }) {
  return (
    <button type="submit" className={`pk-btn wide ${tone}`} disabled={busy || disabled}>
      {busy ? <Loader2 size={15} className="pk-spin" /> : null}
      {children}
    </button>
  );
}

export function GoogleButton({ onClick, busy, label = "Continue with Google" }) {
  return (
    <button type="button" className="pk-google" onClick={onClick} disabled={busy}>
      {busy ? <Loader2 size={15} className="pk-spin" /> : (
        <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
        </svg>
      )}
      {label}
    </button>
  );
}

export function Divider({ children = "or" }) {
  return <p className="pk-or"><span>{children}</span></p>;
}
