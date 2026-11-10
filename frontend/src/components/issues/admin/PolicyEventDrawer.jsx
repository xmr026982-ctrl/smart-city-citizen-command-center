import { clock, day, stamp } from "../../../utils/time";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Hourglass, X, ArrowUpRight, ArrowRight, Clock, Shield } from "lucide-react";
import { ago } from "./CommandKit";
import "../../../styles/gate-door.css";
import "../../../styles/policy-drawer.css";

/* ------------------------------------------------------------------
   Service Windows event file (Audit Log). Opens from a "Service windows
   changed" line: each change as before → after (longer, shorter, set,
   removed), who made it and when, and a way into Service Windows.
   Newer events carry the change list (e.changes); older ones are read
   from the line's own text, so every past change opens too.
------------------------------------------------------------------- */

export const isPolicyEvent = (e) => Boolean(e && (e.topic === "windows" || /^Service windows changed/.test(e.action || "")));

function parseChange(text) {
  const t = String(text).trim();
  let m = t.match(/^(.*?) ceiling set to (\d+)h$/);
  if (m) return { name: `${m[1]} ceiling`, from: null, to: +m[2], kind: "set" };
  m = t.match(/^(.*?) ceiling removed \(was (\d+)h\)$/);
  if (m) return { name: `${m[1]} ceiling`, from: +m[2], to: null, kind: "removed" };
  m = t.match(/^(.*?) (\d+)h → (\d+)h$/);
  if (m) return { name: m[1], from: +m[2], to: +m[3], kind: +m[3] > +m[2] ? "longer" : "shorter" };
  return { name: t, from: null, to: null, kind: "note" };
}

const KIND_LABEL = { longer: "More time", shorter: "Less time", set: "New ceiling", removed: "Ceiling removed", note: "Changed" };
const h = (v) => (v == null ? "—" : v >= 24 && v % 24 === 0 ? `${v / 24}d` : `${v}h`);

function PolicyEventDrawer({ event, onClose }) {
  const navigate = useNavigate();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const boxRef = useRef(null);

  useEffect(() => {
    if (!event) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") { e.stopImmediatePropagation(); closeRef.current(); } };
    window.addEventListener("keydown", onKey, true);
    const t = setTimeout(() => boxRef.current?.focus(), 60);
    return () => { clearTimeout(t); window.removeEventListener("keydown", onKey, true); document.body.style.overflow = prev; };
  }, [event]);

  if (!event) return null;
  const list = (event.changes && event.changes.length ? event.changes : String(event.action).replace(/^Service windows changed: /, "").split(" · ")).map(parseChange);
  const at = new Date(event.at);

  return createPortal(
    <div className="ix">
      <div className="gd-veil" onClick={onClose} />
      <aside className="gd violet pd" role="dialog" aria-modal="true" aria-label="Service windows change">
        <span className="gd-edge" aria-hidden />
        <header className="gd-head">
          <div className="gd-id">
            <span className="gd-mark"><Hourglass size={18} /></span>
            <div>
              <p className="gd-kicker">Audit · Service windows</p>
              <p className="gd-code">{clock(at)} · {day(at)}</p>
            </div>
          </div>
          <button type="button" className="gd-x" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </header>

        <div className="gd-body" ref={boxRef} tabIndex={-1}>
          <div>
            <h2>Service windows changed</h2>
            <p className="gd-lead">
              {list.length} deadline{list.length === 1 ? "" : "s"} changed. New reports get the new windows; reports already running keep the window they were given.
            </p>
          </div>

          <div className="pd-list">
            {list.map((c, i) => (
              <div key={`${c.name}-${i}`} className={`pd-row ${c.kind}`} style={{ animationDelay: `${i * 50}ms` }}>
                <div className="pd-name">
                  <b>{c.name}</b>
                  <em>{KIND_LABEL[c.kind]}</em>
                </div>
                {c.kind === "note" ? null : (
                  <div className="pd-vals">
                    <span className="from">{h(c.from)}</span>
                    <ArrowRight size={13} />
                    <span className="to">{h(c.to)}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="pd-facts">
            <div><em><Shield size={11} /> By</em><b>{event.actor || "Command"}</b><small>Command</small></div>
            <div><em><Clock size={11} /> When</em><b>{stamp(at)}</b><small>{ago(event.at)}</small></div>
          </div>
        </div>

        <footer className="gd-foot">
          <button type="button" className="gd-btn" onClick={onClose}>Close</button>
          <button type="button" className="gd-btn go" onClick={() => { onClose(); navigate("/admin/windows"); }}>
            Open Service Windows <ArrowUpRight size={14} />
          </button>
        </footer>
      </aside>
    </div>,
    document.body
  );
}

export default PolicyEventDrawer;
