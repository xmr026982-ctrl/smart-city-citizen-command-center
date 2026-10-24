import { useRef } from "react";
import { Camera } from "lucide-react";
import "../../styles/people.css";
import AnimatedNumber from "../dashboard/AnimatedNumber";
import { ROLE_META, WARDS } from "../../config/settingsSchema";
import { initialsOf, idCode, securityScore, securityLabel, securityTips } from "../../store/settingsStore";

const R = 44;
const C = 2 * Math.PI * R;

function OperatorCard({ role, s, onJump, onPhoto, onRemovePhoto }) {
  const fileRef = useRef(null);
  const meta = ROLE_META[role] || ROLE_META.citizen;
  const score = securityScore(s);
  const tone = score >= 85 ? "great" : score >= 65 ? "good" : score >= 45 ? "fair" : "risk";
  const tips = securityTips(s).slice(0, 2);
  const ward = WARDS.find((w) => w.v === s.homeWard)?.l;
  const duty = { on: "On duty", break: "On break", off: "Off duty" }[s.dutyStatus];

  // staff show their real employee ID; everyone else gets a stable generated code
  const code = role === "staff" && s.employeeId ? s.employeeId : idCode(meta.code, s.displayName);
  const subtitle = role === "staff" && s.rank ? `${meta.label} · ${s.rank}` : `${meta.label} · ${meta.clearance}`;

  const pills = [
    { t: `2FA ${s.twoFactor ? "ON" : "OFF"}`, on: !!s.twoFactor },
    { t: s.emailVerified ? "EMAIL VERIFIED" : "EMAIL UNVERIFIED", on: !!s.emailVerified },
    { t: `${(s.sessions || []).length} DEVICES`, on: true },
  ];
  if (role === "citizen" && ward) pills.push({ t: `WARD · ${ward.toUpperCase()}`, on: true });
  if (role === "staff" && duty) pills.push({ t: duty.toUpperCase(), on: s.dutyStatus === "on" });

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
          {s.avatar ? <img src={s.avatar} alt="" /> : <b>{initialsOf(s.displayName)}</b>}
          <span className="cam"><Camera size={16} /></span>
          <i className="scanbar" />
        </button>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={onFile} />
      </div>

      <div className="st-ident">
        <span className="st-code">{code}</span>
        <h2>{s.displayName}</h2>
        <p>{subtitle}</p>
        <p className="mono">{s.email}</p>
        <div className="st-pills">
          {pills.map((p) => (<span key={p.t} className={`st-pill ${p.on ? "on" : ""}`}><i />{p.t}</span>))}
        </div>
        {s.avatar && <button type="button" className="st-link" onClick={onRemovePhoto}>Remove photo</button>}
      </div>

      <div className={`st-gauge ${tone}`}>
        <div className="ringbox">
          <svg viewBox="0 0 110 110">
            <circle cx="55" cy="55" r={R} className="bg" />
            <circle cx="55" cy="55" r={R} className="fg" style={{ strokeDasharray: `${(score / 100) * C} ${C}` }} transform="rotate(-90 55 55)" />
          </svg>
          <div className="num"><b><AnimatedNumber value={score} /></b><span>SEC INDEX</span></div>
        </div>
        <div className="info">
          <strong>{securityLabel(score)}</strong>
          {tips.length === 0 ? (
            <p>Everything looks locked down.</p>
          ) : (
            <ul>
              {tips.map((t) => (
                <li key={t.text}>
                  <button type="button" onClick={() => onJump(t.to)}>{t.text}<em>+{t.pts}</em></button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

export default OperatorCard;