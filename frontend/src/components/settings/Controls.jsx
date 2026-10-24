import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { Eye, EyeOff, RotateCcw } from "lucide-react";

/* ------------------------------ toasts ------------------------------ */
let toasts = [];
let toastId = 0;
const toastListeners = new Set();
const emitToasts = () => toastListeners.forEach((l) => l());
const subToasts = (cb) => { toastListeners.add(cb); return () => toastListeners.delete(cb); };
const getToasts = () => toasts;

export function toast(msg, tone = "ok") {
  const id = ++toastId;
  toasts = [...toasts, { id, msg, tone }];
  emitToasts();
  setTimeout(() => { toasts = toasts.filter((t) => t.id !== id); emitToasts(); }, 3200);
}

export function Toaster() {
  const list = useSyncExternalStore(subToasts, getToasts);
  return (
    <div className="st-toasts" aria-live="polite">
      {list.map((t) => (<div key={t.id} className={`st-toast ${t.tone}`}><i />{t.msg}</div>))}
    </div>
  );
}

/* ------------------------------ panel ------------------------------ */
export function Panel({ id, code, title, icon: Icon, onReset, children }) {
  return (
    <section id={`sec-${id}`} className="st-panel">
      <i className="st-c tl" />
      <i className="st-c br" />
      <header>
        <span className="st-code">{code}</span>
        <h2><Icon size={16} />{title}</h2>
        <span className="st-trace" />
        {onReset && (
          <button type="button" className="st-ghost" onClick={onReset}><RotateCcw size={13} />Reset</button>
        )}
      </header>
      <div className="st-body">{children}</div>
    </section>
  );
}

/* ------------------------------ controls ------------------------------ */
export function Toggle({ checked, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className={`st-switch ${checked ? "on" : ""}`} onClick={() => onChange(!checked)}>
      <span />
    </button>
  );
}

export function Segmented({ value, options, onChange, label }) {
  return (
    <div className="st-seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.v)} type="button" role="radio" aria-checked={value === o.v} className={value === o.v ? "on" : ""} onClick={() => onChange(o.v)}>
          {o.l}
        </button>
      ))}
    </div>
  );
}

export function Slider({ value, min, max, step = 1, unit = "", onChange, label }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="st-slider">
      <input type="range" min={min} max={max} step={step} value={value} aria-label={label} style={{ "--pct": `${pct}%` }} onChange={(e) => onChange(Number(e.target.value))} />
      <output>{value}{unit}</output>
    </div>
  );
}

export function Select({ value, options, onChange, label }) {
  return (
    <select className="st-select" value={value} aria-label={label} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (<option key={o.v} value={o.v}>{o.l}</option>))}
    </select>
  );
}

export function Chips({ value, options, onChange, label }) {
  const flip = (v) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <div className="st-chips" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.v} type="button" aria-pressed={value.includes(o.v)} className={value.includes(o.v) ? "on" : ""} onClick={() => flip(o.v)}>
          {o.l}
        </button>
      ))}
    </div>
  );
}

export function TimeInput({ value, onChange, label }) {
  return <input type="time" className="st-select st-time" value={value} aria-label={label} onChange={(e) => onChange(e.target.value)} />;
}

// Saves when you leave the box or press Enter. Shows an error instead of saving bad input.
export function TextField({ value, onCommit, validate, placeholder, label }) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  const [err, setErr] = useState("");

  useEffect(() => { setDraft(value); }, [value]);

  const commit = () => {
    if (draft === value) { setErr(""); return; }
    const e = validate ? validate(draft) : "";
    setErr(e);
    if (!e) onCommit(draft.trim());
  };

  return (
    <div className="st-text">
      <input
        id={id}
        className="st-plain"
        aria-label={label}
        aria-invalid={!!err}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
      />
      {err && <span className="st-err">{err}</span>}
    </div>
  );
}

// Labelled input used by the email / password / confirm forms.
export function Field({ label, type = "text", value, onChange, placeholder, error, autoComplete, inputMode, maxLength, className = "" }) {
  const id = useId();
  const [show, setShow] = useState(false);
  const isPw = type === "password";
  return (
    <div className={`st-field ${className}`}>
      <label htmlFor={id}>{label}</label>
      <div className="st-input">
        <input
          id={id}
          type={isPw && show ? "text" : type}
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          inputMode={inputMode}
          maxLength={maxLength}
          aria-invalid={!!error}
          onChange={(e) => onChange(e.target.value)}
        />
        {isPw && (
          <button type="button" className="eye" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow((v) => !v)}>
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
      {error ? <span className="st-err">{error}</span> : null}
    </div>
  );
}

/* ------------------------------ row ------------------------------ */
const TAGS = { live: "LIVE", sync: "NEEDS SERVER" };

export function Row({ row, value, onChange, onAction, validators }) {
  let control = null;
  switch (row.type) {
    case "toggle": control = <Toggle checked={!!value} onChange={onChange} label={row.label} />; break;
    case "segmented": control = <Segmented value={value} options={row.options} onChange={onChange} label={row.label} />; break;
    case "select": control = <Select value={value} options={row.options} onChange={onChange} label={row.label} />; break;
    case "slider": control = <Slider value={value} min={row.min} max={row.max} step={row.step} unit={row.unit} onChange={onChange} label={row.label} />; break;
    case "chips": control = <Chips value={value || []} options={row.options} onChange={onChange} label={row.label} />; break;
    case "time": control = <TimeInput value={value} onChange={onChange} label={row.label} />; break;
    case "text": control = <TextField value={value ?? ""} onCommit={onChange} validate={validators[row.validate]} placeholder={row.placeholder} label={row.label} />; break;
    case "readonly": {
      const nameOf = (v) => (row.options ? ((row.options.find((o) => o.v === v) || {}).l ?? v) : v);
      control = (
        <span className="st-lock">
          {Array.isArray(value) ? value.map(nameOf).join(", ") : `${nameOf(value)}${row.unit || ""}`}
          <em>{row.note || "Read-only"}</em>
        </span>
      );
      break;
    }
    case "action":
      control = (
        <button type="button" className={`st-btn ${row.danger ? "danger" : ""}`} onClick={() => onAction(row.action)}>{row.button}</button>
      );
      break;
    default: control = null;
  }

  return (
    <div className={`st-row ${row.type === "chips" ? "wide" : ""}`}>
      <div className="st-info">
        <span className="st-label">
          {row.label}
          {row.tag && <em className={`st-tag ${row.tag}`}>{TAGS[row.tag]}</em>}
        </span>
        {row.hint && <p>{row.hint}</p>}
      </div>
      <div className="st-ctl">{control}</div>
    </div>
  );
}