import { useRef } from "react";
import { Camera, ShieldCheck } from "lucide-react";
import { ROLE_META, zoneNameOf } from "../../config/settingsSchema";
import { initialsOf, idCode } from "../../store/settingsStore";
import { sessionClock } from "../../store/authStore";
import { onServer } from "../../services/settingsService";
import { useMinute } from "../../hooks/useMinute";
import { clock } from "../../utils/time";

const R = 44;
const C = 2 * Math.PI * R;
const DUTY = { on: "On duty", break: "On break", off: "Off duty" };

function short(ms) {
  if (ms <= 0) return "0m";
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return h < 48 ? `${h}h ${String(m % 60).padStart(2, "0")}m` : `${Math.round(h / 24)}d`;
}

/* ------------------------------------------------------------------
   The identity plate at the top of Settings: who is signed in, how,
   and how long this session has left (the ring is the token's own
   lifetime, ticking down). Every value comes from the session.
------------------------------------------------------------------- */
function OperatorCard({ role, me, s, onJump, onPhoto, onRemovePhoto }) {
  const now = useMinute();
  const fileRef = useRef(null);
  const meta = ROLE_META[role] || ROLE_META.citizen;
  const server = onServer();
  const clk = sessionClock();

  const code = idCode(meta.code, me.name);
  const zone = role === "citizen" ? zoneNameOf(s.homeWard) || me.ward : role === "staff" ? me.ward : "";
  const pills = [
    { t: meta.clearance.toUpperCase(), on: true },
    server ? { t: "SERVER VERIFIED", on: true } : { t: "DEVELOPER DESK", on: false },
    server ? { t: me.provider === "google" ? "GOOGLE SIGN-IN" : "PASSWORD SIGN-IN", on: true } : null,
    zone ? { t: `ZONE · ${zone.toUpperCase()}`, on: true } : null,
    role !== "citizen" && DUTY[s.dutyStatus] ? { t: DUTY[s.dutyStatus].toUpperCase(), on: s.dutyStatus === "on" } : null,
  ].filter(Boolean);

  const total = clk?.exp && clk?.iat ? clk.exp - clk.iat : 0;
  const rest = clk?.exp ? Math.max(0, clk.exp - now) : 0;
  const share = total ? rest / total : 1;
  const tone = !server ? "dev" : share > 0.25 ? "ok" : share > 0.08 ? "low" : "end";
  const idle = Number(s.idleSignOut) || 0;

  const onFile = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (file) onPhoto(file);
  };

  return (
    <section className="st-op">
      <div className="st-avatar">
        <svg className="ring a" viewBox="0 0 120 120" aria-hidden="true">
          <circle cx="60" cy="60" r="57" fill="none" stroke="currentColor" strokeWidth="1.4" strokeDasharray="2 7" />
        </svg>
        <svg className="ring b" viewBox="0 0 120 120" aria-hidden="true">
          <circle cx="60" cy="60" r="51" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="70 250" />
          <circle cx="60" cy="60" r="51" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="24 296" strokeDashoffset="-170" opacity=".5" />
        </svg>
        <button type="button" className="core" onClick={() => fileRef.current && fileRef.current.click()} aria-label="Change profile photo">
          {s.avatar ? <img src={s.avatar} alt="" /> : <b>{initialsOf(s.displayName || me.name)}</b>}
          <span className="cam"><Camera size={16} /></span>
          <i className="scanbar" />
        </button>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={onFile} />
      </div>

      <div className="st-ident">
        <span className="st-code">{code}</span>
        <h2>{s.displayName || me.name}</h2>
        <p>{meta.label}{s.displayName && s.displayName !== me.name ? ` · ${me.name}` : ""}</p>
        {me.email ? <p className="mono">{me.email}</p> : null}
        <div className="st-pills">
          {pills.map((p) => (<span key={p.t} className={`st-pill ${p.on ? "on" : ""}`}><i />{p.t}</span>))}
        </div>
        {s.avatar && <button type="button" className="st-link" onClick={onRemovePhoto}>Remove photo</button>}
      </div>

      <div className={`st-gauge ${tone}`}>
        <div className="ringbox">
          <svg viewBox="0 0 110 110" aria-hidden="true">
            <circle cx="55" cy="55" r={R} className="bg" />
            <circle cx="55" cy="55" r={R} className="fg" style={{ strokeDasharray: `${share * C} ${C}` }} transform="rotate(-90 55 55)" />
            {Array.from({ length: 24 }, (_, i) => (
              <line key={i} x1="55" y1="4" x2="55" y2={i % 6 ? "7" : "9"} className="tick" transform={`rotate(${i * 15} 55 55)`} />
            ))}
          </svg>
          <div className="num">
            <b>{server ? (clk?.exp ? short(rest) : "Live") : "DEV"}</b>
            <span>{server ? "SESSION" : "LOCAL"}</span>
          </div>
        </div>
        <div className="info">
          <strong><ShieldCheck size={14} /> {server ? "Session secured" : "Sample desk"}</strong>
          {server ? (
            <ul className="st-hud">
              {clk?.iat ? <li><span>Signed in</span><b>{clock(clk.iat)} IST</b></li> : null}
              {clk?.exp ? <li><span>Ends</span><b>{clock(clk.exp)} IST</b></li> : null}
              <li><span>Away sign-out</span><b>{idle ? (idle >= 60 ? `${idle / 60} h` : `${idle} min`) : "Off"}</b></li>
            </ul>
          ) : (
            <p>Sample data on this browser. Nothing reaches the server.</p>
          )}
          <button type="button" className="st-hud-go" onClick={() => onJump("signin")}>Sign-in & security</button>
        </div>
      </div>
    </section>
  );
}

export default OperatorCard;
