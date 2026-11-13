import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Siren, Vote, MapPin, Activity, Leaf, Megaphone, Compass, ArrowRight, CircleDot, Lightbulb, Trash2, Construction, Droplets, Zap, ShieldAlert } from "lucide-react";
import { api } from "../../lib/api";
import { SERVER_ON } from "../../config/server";
import { CATEGORY_LABEL } from "../../constants/issueCategories";

/* ------------------------------------------------------------------
   Preview (Person 1's Platform Preview, every section kept):
   the latest open reports on the live board, the four features, more
   than reports, and the call to join. The board is real (GET
   /public/board): kind, zone and public status only, no titles, places
   or names; full reports live behind sign-in.
------------------------------------------------------------------- */
const ICON = { roads: Construction, lighting: Lightbulb, waste: Trash2, water: Droplets, electricity: Zap, safety: ShieldAlert, other: CircleDot };
const STATUS = {
  submitted: { label: "Received", tone: "slate" },
  acknowledged: { label: "Acknowledged", tone: "slate" },
  in_progress: { label: "In progress", tone: "amber" },
  resolved: { label: "Resolved", tone: "green" },
};
// zone centres, placed on the preview map (Kolkata, north at the top)
const ZONE_XY = {
  Shyambazar: { x: 66, y: 16 },
  "College Street": { x: 58, y: 36 },
  "B.B.D. Bagh": { x: 30, y: 38 },
  Dharmatala: { x: 36, y: 52 },
  Ballygunge: { x: 54, y: 68 },
  "B.P. Township": { x: 72, y: 86 },
};

const FEATURES = [
  { icon: Siren, title: "Issue solving", text: "Report a civic problem and follow it from the first report to the confirmed fix." },
  { icon: Vote, title: "Community voting", text: "Back proposals for your zone, vote in polls and see what the city decided." },
  { icon: MapPin, title: "Live locations", text: "Every open report on the city map, by zone, with the crew that has it." },
  { icon: Activity, title: "Status you can trust", text: "Received, acknowledged, in progress, resolved. Command confirms every close." },
];

export default function Preview() {
  const [active, setActive] = useState(0);
  const [board, setBoard] = useState(SERVER_ON ? null : false); // null = loading, false = unreachable
  useEffect(() => {
    if (!SERVER_ON) return undefined;
    let live = true;
    api.get("/public/board").then(({ data }) => { if (live) setBoard(data); }).catch(() => { if (live) setBoard(false); });
    return () => { live = false; };
  }, []);
  const items = (board && board.items) || [];
  const reports = items.map((r, i) => {
    const st = STATUS[r.status] || STATUS.submitted;
    const xy = ZONE_XY[r.ward] || { x: 50, y: 50 };
    return { key: `${r.ward}-${r.at}-${i}`, icon: ICON[r.category] || CircleDot, type: CATEGORY_LABEL[r.category] || "Civic problem", zone: r.ward, status: st.label, tone: st.tone, x: xy.x + (i % 2 ? 4 : -4), y: xy.y + (i % 3) * 3 };
  });
  const count = reports.length;
  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || count < 2) return undefined;
    const t = setInterval(() => setActive((a) => (a + 1) % count), 2600);
    return () => clearInterval(t);
  }, [count]);

  return (
    <main className="pk-page pk-preview">
      <section className="pk-hero">
        <div>
          <p className="pk-kick"><i />Platform preview</p>
          <h1>Make your city <em>better together.</em></h1>
          <p className="pk-lead">A clear, open way for citizens and city teams to find problems, work on them together and close them for good.</p>
          <div className="pk-row">
            <Link to="/register" className="pk-btn">Create an account <ArrowRight size={14} /></Link>
            <Link to="/login" className="pk-btn ghost">Sign in</Link>
          </div>
        </div>
        <div className="pk-hero-stat">
          <span>From report to resolved</span>
          <b>4 steps</b>
          <small>received · acknowledged · in progress · resolved</small>
        </div>
      </section>

      <section className="pk-board" aria-label="The live board">
        <div className="pk-board-map">
          <header><p className="pk-kick"><i />Live city map</p><span className="pk-live"><i />{board ? "Live" : board === null ? "Connecting" : "Offline"}</span></header>
          <div className="pk-map">
            <span className="pk-river" aria-hidden />
            {reports.map((p, i) => (
              <button key={p.key} type="button" className={`pk-pin ${p.tone}${active === i ? " on" : ""}`} style={{ left: `${p.x}%`, top: `${p.y}%` }} onClick={() => setActive(i)} aria-label={`${p.type} · ${p.zone}`}>
                <i />
              </button>
            ))}
          </div>
        </div>
        <div className="pk-board-list">
          <header><p className="pk-kick"><i />Latest reports</p></header>
          {reports.map((s, i) => (
            <button key={s.key} type="button" className={`pk-report ${s.tone}${active === i ? " on" : ""}`} onClick={() => setActive(i)}>
              <span className="pk-report-ic"><s.icon size={16} /></span>
              <span className="pk-report-t"><b>{s.type}</b><small>{s.zone}</small></span>
              <span className={`pk-tag ${s.tone}`}><CircleDot size={10} /> {s.status}</span>
            </button>
          ))}
          {board && !count ? <p className="pk-fine">Nothing open on the board right now.</p> : null}
          {board === false ? <p className="pk-fine">The live board shows here once the city server answers.</p> : null}
          {board ? <p className="pk-fine">{board.open} open now · {board.resolvedWeek} fixed this week. Sign in for the full reports.</p> : null}
        </div>
      </section>

      <section className="pk-section">
        <p className="pk-kick"><i />Features</p>
        <h2>Everything your zone needs.</h2>
        <p className="pk-lead">Simple tools that help citizens speak up, stay informed and work together with the city.</p>
        <div className="pk-features">
          {FEATURES.map((f) => (
            <article key={f.title} className="pk-feature">
              <span className="pk-feature-ic"><f.icon size={18} /></span>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="pk-more">
        <div>
          <p className="pk-kick"><i />More than reports</p>
          <h2>See the full picture.</h2>
          <p className="pk-lead">Air quality by zone, community priorities and nearby services, built around everyday life.</p>
        </div>
        <ul className="pk-tools">
          <li><Leaf size={16} /><b>Air quality</b><small>Live, zone by zone</small></li>
          <li><Megaphone size={16} /><b>City updates</b><small>Announcements for your zone</small></li>
          <li><Compass size={16} /><b>Local services</b><small>Help near you on the map</small></li>
        </ul>
      </section>

      <section className="pk-final">
        <p className="pk-kick"><i />Your city. Your voice.</p>
        <h2>Ready to make Kolkata better?</h2>
        <p className="pk-lead">Join your neighbours and help shape the place you call home.</p>
        <Link to="/register" className="pk-btn lg">Get started <ArrowRight size={15} /></Link>
      </section>
    </main>
  );
}
