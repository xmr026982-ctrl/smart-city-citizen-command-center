import { Link } from "react-router-dom";
import { Users, HardHat, ShieldCheck, Lock, ArrowRight } from "lucide-react";
import { PRODUCT } from "../../config/server";

/* About: what Smart Kolkata is, who it serves, how it keeps people safe. */
const DESKS = [
  { icon: Users, tone: "citizen", title: "Citizens", text: "Report problems in their zone, follow every step, back proposals and vote in polls." },
  { icon: HardHat, tone: "staff", title: "Field crews", text: "Get work matched to their expertise and zone, update it on site and ask command to close." },
  { icon: ShieldCheck, tone: "admin", title: "City command", text: "Dispatch crews, set service windows, clear new staff and confirm every fix." },
];

export default function About() {
  return (
    <main className="pk-page pk-about">
      <section className="pk-hero solo">
        <p className="pk-kick"><i />About {PRODUCT}</p>
        <h1>A smarter, more connected <em>Kolkata.</em></h1>
        <p className="pk-lead">
          {PRODUCT} brings citizens, field crews and city command into one live system. A report becomes a
          work order, the work order reaches the right crew, and the city confirms the fix before it closes.
        </p>
      </section>
      <section className="pk-features three">
        {DESKS.map((d) => (
          <article key={d.title} className={`pk-feature tone-${d.tone}`}>
            <span className="pk-feature-ic"><d.icon size={18} /></span>
            <h3>{d.title}</h3>
            <p>{d.text}</p>
          </article>
        ))}
      </section>
      <section className="pk-more">
        <div>
          <p className="pk-kick"><i />Built to be trusted</p>
          <h2>Your account is checked by the server, every time.</h2>
          <p className="pk-lead">Passwords are stored only as secure hashes and never shown to anyone, the admin included. Staff join only after command clears them, with a one-time setup link.</p>
        </div>
        <ul className="pk-tools">
          <li><Lock size={16} /><b>One account, one desk</b><small>Each desk opens only for its own role</small></li>
          <li><ShieldCheck size={16} /><b>Cleared staff only</b><small>Official email, one-time setup</small></li>
        </ul>
      </section>
      <section className="pk-final">
        <h2>See it working.</h2>
        <div className="pk-row center"><Link to="/preview" className="pk-btn lg">Platform preview <ArrowRight size={15} /></Link><Link to="/register" className="pk-btn lg ghost">Create an account</Link></div>
        <p className="pk-fine">{PRODUCT} is an independent civic project. It is not run by, or affiliated with, the Kolkata Municipal Corporation.</p>
      </section>
    </main>
  );
}
