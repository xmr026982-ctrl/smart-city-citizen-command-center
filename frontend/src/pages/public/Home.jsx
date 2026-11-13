import { Link } from "react-router-dom";
import { ArrowRight, Radar, Wrench, ShieldCheck } from "lucide-react";
import { HeroVideo, SiteNav } from "../../components/public/PublicKit";
import { PRODUCT } from "../../config/server";

/* Home: the film full screen, the promise top left (clear of the bridge), three ways in. */
export default function Home() {
  return (
    <main className="pk-home">
      <HeroVideo className="pk-home-film" />
      <div className="pk-home-shade" aria-hidden />
      <SiteNav over />
      <section className="pk-home-copy" aria-labelledby="home-title">
        <p className="pk-kick light"><i />{PRODUCT} · live</p>
        <h1 id="home-title">Report it. Track it.<br />See it fixed.</h1>
        <p className="pk-home-lead">
          One live system for Kolkata: citizens report what's broken, field crews are dispatched,
          and city command confirms the fix. Every step is on the record.
        </p>
        <div className="pk-home-cta">
          <Link to="/register" className="pk-btn lg">Get started <ArrowRight size={15} /></Link>
          <Link to="/preview" className="pk-btn lg glass">See how it works</Link>
        </div>
      </section>
      <ul className="pk-home-strip" aria-label="What the system does">
        <li><Radar size={15} /><b>Six zones, live</b><span>Air, traffic, water and power by zone</span></li>
        <li><Wrench size={15} /><b>Report to resolved</b><span>Dispatched to the right crew, on a service window</span></li>
        <li><ShieldCheck size={15} /><b>Command confirms</b><span>No issue closes until the city checks it</span></li>
      </ul>
    </main>
  );
}
