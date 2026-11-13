import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Sparkles, Send, ArrowUpRight } from "lucide-react";
import { useAuth } from "../../store/authStore";
import { proposeImprovement, similarProposal } from "../../store/communityStore";
import { WARDS } from "../../constants/issueConstants";
import { ISSUE_CATEGORIES, CATEGORY_LABEL } from "../../constants/issueCategories";
import TextHint from "../ui/TextHint";
import { isMash } from "../../utils/textGuard";

/* ------------------------------------------------------------------
   Propose an improvement (citizen). Zone, kind, a title and a short
   description. If the zone already has an open proposal saying much the
   same thing, the door says so and offers to back that one instead.
   The city answers within a week.
------------------------------------------------------------------- */
export default function ProposeDoor({ open, zone, onClose, onOpenProposal, onSent }) {
  const me = useAuth();
  const [ward, setWard] = useState(zone);
  const [category, setCategory] = useState("other");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [err, setErr] = useState("");
  const titleRef = useRef(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });

  useEffect(() => {
    if (!open) return undefined;
    setWard(zone); setErr("");
    const t = setTimeout(() => titleRef.current?.focus(), 60);
    const onKey = (e) => { if (e.key === "Escape") closeRef.current(); };
    window.addEventListener("keydown", onKey);
    return () => { clearTimeout(t); window.removeEventListener("keydown", onKey); };
  }, [open, zone]);

  const similar = useMemo(() => (title.trim().length >= 12 ? similarProposal(ward, title) : null), [ward, title]);
  if (!open) return null;

  const send = () => {
    const res = proposeImprovement(me, { title, summary, category, ward });
    if (!res.ok) { setErr(res.reason); return; }
    setTitle(""); setSummary(""); setCategory("other"); setErr("");
    onSent(res.id);
  };

  return createPortal(
    <div className="cx-layer" role="presentation">
      <div className="cx-scrim" onClick={onClose} aria-hidden />
      <aside className="cx-drawer narrow" role="dialog" aria-modal="true" aria-label="Propose an improvement">
        <header className="cx-dhead">
          <span className="cx-dic"><Sparkles size={18} /></span>
          <div className="cx-did">
            <small>Community / New proposal</small>
            <b>Propose an improvement</b>
          </div>
          <button type="button" className="cx-x" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </header>
        <div className="cx-dbody">
          <p className="cx-dsum">Something your zone needs that isn&apos;t a fault to report: a bench, a light, a crossing. Neighbours back it, the city adds its own evidence, and command answers within a week.</p>

          <label className="cx-field">
            <span>Zone</span>
            <div className="cx-seg">
              {WARDS.map((w) => <button key={w.name} type="button" className={ward === w.name ? "on" : ""} aria-pressed={ward === w.name} onClick={() => setWard(w.name)}>{w.name}</button>)}
            </div>
          </label>

          <label className="cx-field">
            <span>Kind</span>
            <div className="cx-seg">
              {ISSUE_CATEGORIES.map((c) => <button key={c} type="button" className={category === c ? "on" : ""} aria-pressed={category === c} onClick={() => setCategory(c)}>{c === "other" ? "Public space" : CATEGORY_LABEL[c]}</button>)}
            </div>
          </label>

          <label className="cx-field">
            <span>Title <em>{title.length}/90</em></span>
            <input ref={titleRef} value={title} maxLength={90} onChange={(e) => { setTitle(e.target.value); setErr(""); }} placeholder="e.g. Pedestrian signal at the lake crossing" />
            <TextHint text={title} title />
          </label>

          {similar ? (
            <div className="cx-similar" role="status">
              <span>Already proposed in {ward}: <b>{similar.title}</b></span>
              <button type="button" className="cx-btn sm" onClick={() => onOpenProposal(similar.id)}>Back it instead <ArrowUpRight size={12} /></button>
            </div>
          ) : null}

          <label className="cx-field">
            <span>What and why <em>{summary.length}/280</em></span>
            <textarea value={summary} maxLength={280} rows={4} onChange={(e) => { setSummary(e.target.value); setErr(""); }} placeholder="Where exactly, who it helps, what happens today without it." />
            <TextHint text={summary} />
          </label>

          {err ? <p className="cx-err" role="alert">{err}</p> : null}

          <div className="cx-row">
            <small>You count as its first resident backer if {ward} is your home zone.</small>
            <button type="button" className="cx-btn go" onClick={send} disabled={!title.trim() || !summary.trim() || isMash(title, { title: true }) || isMash(summary)}><Send size={14} /> Send proposal</button>
          </div>
        </div>
      </aside>
    </div>,
    document.body
  );
}
