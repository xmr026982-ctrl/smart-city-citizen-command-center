import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Siren, Vote, MapPin, Activity, Leaf, Megaphone, Compass, ArrowRight, CircleDot, Lightbulb, Trash2, Construction } from "lucide-react";

/* ------------------------------------------------------------------
   Preview (Person 1's Platform Preview, every section kept):
   a sample of the live board, the four features, more than reports,
   and the call to join. The figures here are an illustration, marked
   as such: the real ones live behind sign-in.
------------------------------------------------------------------- */
const SAMPLE = [
  { icon: Construction, type: "Pothole cluster", place: "Esplanade crossing", zone: "Dharmatala", status: "In progress", tone: "amber" },
  { icon: Trash2, type: "Overflowing bins", place: "Gariahat market", zone: "Ballygunge", status: "Received", tone: "slate" },
  { icon: Lightbulb, type: "Streetlight fault", place: "Bidhan Sarani", zone: "Shyambazar", status: "Resolved", tone: "green" },
];

const FEATURES = [
  { icon: Siren, title: "Issue solving", text: "Report a civic problem and follow it from the first report to the confirmed fix." },
  { icon: Vote, title: "Community voting", text: "Back proposals for your zone, vote in polls and see what the city decided." },
  { icon: MapPin, title: "Live locations", text: "Every open report on the city map, by zone, with the crew that has it." },
  { icon: Activity, title: "Status you can trust", text: "Received, acknowledged, in progress, resolved. Command confirms every close." },
];

const PINS = [
  { x: 28, y: 34, tone: "amber" },
  { x: 62, y: 58, tone: "slate" },
  { x: 44, y: 72, tone: "green" },
];

export default function Preview() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return undefined;
    const t = setInterval(() => setActive((a) => (a + 1) % SAMPLE.length), 2600);
    return () => clearInterval(t);
  }, []);

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

      <section className="pk-board" aria-label="Sample of the live board">
        <div className="pk-board-map">
          <header><p className="pk-kick"><i />Live city map</p><span className="pk-live"><i />Sample</span></header>
          <div className="pk-map">
            <span className="pk-river" aria-hidden />
            {PINS.map((p, i) => (
              <button key={i} type="button" className={`pk-pin ${p.tone}${active === i ? " on" : ""}`} style={{ left: `${p.x}%`, top: `${p.y}%` }} onClick={() => setActive(i)} aria-label={SAMPLE[i].type}>
                <i />
              </button>
            ))}
          </div>
        </div>
        <div className="pk-board-list">
          <header><p className="pk-kick"><i />Reports near you</p></header>
          {SAMPLE.map((s, i) => (
            <button key={s.type} type="button" className={`pk-report ${s.tone}${active === i ? " on" : ""}`} onClick={() => setActive(i)}>
              <span className="pk-report-ic"><s.icon size={16} /></span>
              <span className="pk-report-t"><b>{s.type}</b><small>{s.place} · {s.zone}</small></span>
              <span className={`pk-tag ${s.tone}`}><CircleDot size={10} /> {s.status}</span>
            </button>
          ))}
          <p className="pk-fine">Sample data for this preview. Live reports are visible once you sign in.</p>
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
