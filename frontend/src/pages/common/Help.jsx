import { useEffect, useMemo, useState } from "react";
import { Search, Mail, LifeBuoy, Map, FilePlus2, Activity, Bell, ClipboardList, ArrowUpRight, X, Users, FileText, UserCog } from "lucide-react";
import { getRole } from "../../store/authStore";
import { TOPICS, STATUS, SUPPORT } from "../../config/helpContent";
import { ROLE_META } from "../../config/settingsSchema";

const DESK = { citizen: "Citizen Services", staff: "Field Desk", admin: "Civic Command" };
const ICONS = {
  city: Activity, field: Activity, map: Map, report: FilePlus2, community: Users,
  assigned: ClipboardList, records: FileText, desk: UserCog, alerts: Bell, access: LifeBuoy,
};
const LANES = {
  citizen: [
    ["This page", "Search, or open a topic. The list follows the desk you are signed in to."],
    ["A city issue", "File it from Report Issue. Do not email it. The desk handles it."],
    ["Account or sign-in", "Only for access and a desk that will not open."],
  ],
  staff: [
    ["This page", "Search, or open a topic. The list follows the desk you are signed in to."],
    ["A file on you", "Open it from Assigned Work. Status updates belong there."],
    ["Account or sign-in", "Only for access and a desk that will not open."],
  ],
  admin: [
    ["This page", "Search, or open a topic. The list follows the desk you are signed in to."],
    ["A city file", "Find it in Issue Records. Assign and confirm from there."],
    ["Account or sign-in", "Only for access and a desk that will not open."],
  ],
};

function Help() {
  const role = getRole() || "citizen";
  const meta = ROLE_META[role] || ROLE_META.citizen;
  const [q, setQ] = useState("");
  const [open, setOpen] = useState("");
  const [gate, setGate] = useState(false);

  const topics = useMemo(() => {
    const mine = TOPICS
      .filter((t) => t.roles.includes(role))
      .map((t) => ({ ...t, ...(t.copy[role] || {}) }));
    const needle = q.trim().toLowerCase();
    if (!needle) return mine;
    return mine.filter((t) =>
      [t.title, t.lead, ...(t.steps || [])].join(" ").toLowerCase().includes(needle)
    );
  }, [role, q]);

  const current = topics.find((t) => t.id === open) || topics[0];
  const lanes = LANES[role] || LANES.citizen;

  useEffect(() => {
    document.body.style.overflow = gate ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [gate]);

  return (
    <main className="page help" style={{ "--acc": meta.acc }}>
      <header className="hp-head">
        <div>
          <p className="hp-crumb">HELP <b>/</b> {DESK[role].toUpperCase()}</p>
          <h1>Help</h1>
          <p className="hp-sub">Answers for this desk. A city problem is a report. Account faults go to support.</p>
        </div>
        <label className="hp-search">
          <Search size={15} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search help" />
          <kbd>/</kbd>
        </label>
      </header>

      <div className="hp-grid">
        <nav className="hp-rail" aria-label="Help topics">
          {topics.map((topic, i) => {
            const Icon = ICONS[topic.id] || LifeBuoy;
            return (
              <button
                key={topic.id}
                type="button"
                className={current?.id === topic.id ? "on" : ""}
                onClick={() => setOpen(topic.id)}
              >
                <span className="n">{String(i + 1).padStart(2, "0")}</span>
                <Icon size={15} />
                {topic.title}
              </button>
            );
          })}
        </nav>

        <div className="hp-main">
          {!current && <div className="hp-empty">No answers match.</div>}

          {current && (
            <article className="hp-card">
              <i className="hp-c tl" /><i className="hp-c br" />
              <header>
                <h2>{current.title}</h2>
                <span className="hp-trace" />
              </header>
              <p className="hp-lead">{current.lead}</p>
              <ol>
                {(current.steps || []).map((step) => <li key={step}>{step}</li>)}
              </ol>
              {current.id === "report" && <StatusRail />}
            </article>
          )}

          <section className="hp-lanes">
            {lanes.map(([title, body]) => (
              <article key={title}>
                <strong>{title}</strong>
                <p>{body}</p>
              </article>
            ))}
          </section>

          <button type="button" className="hp-mail" onClick={() => setGate(true)}>
            <Mail size={16} />
            <span>
              <b>Account and sign-in only</b>
              {SUPPORT}
            </span>
            <ArrowUpRight size={16} />
          </button>
        </div>
      </div>

      {gate && <MailGate desk={DESK[role]} onClose={() => setGate(false)} />}
    </main>
  );
}

function MailGate({ desk, onClose }) {
  const openGmail = () => {
    const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(SUPPORT)}&su=${encodeURIComponent(`Smart City desk support · ${desk}`)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    onClose();
  };

  return (
    <div className="hp-veil" onClick={onClose}>
      <section className="hp-gate" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <i className="hp-c tl" /><i className="hp-c br" />
        <header>
          <div>
            <p>SUPPORT GATE</p>
            <h2>Open Gmail</h2>
          </div>
          <button type="button" className="hp-x" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </header>
        <div className="hp-gate-body">
          <p>This opens your Gmail with the support address already set. Write the fault, then send.</p>
          <dl>
            <div><dt>To</dt><dd>{SUPPORT}</dd></div>
            <div><dt>Desk</dt><dd>{desk}</dd></div>
            <div><dt>For</dt><dd>Account, sign-in, and a desk that will not open</dd></div>
          </dl>
          <div className="hp-gate-actions">
            <button type="button" className="hp-go" onClick={openGmail}>Open Gmail <ArrowUpRight size={15} /></button>
            <button type="button" className="hp-ghost" onClick={onClose}>Stay here</button>
          </div>
        </div>
      </section>
    </div>
  );
}

function StatusRail() {
  return (
    <ol className="hp-status">
      {STATUS.map((step, i) => (
        <li key={step.id}>
          <b>{String(i + 1).padStart(2, "0")}</b>
          <strong>{step.label}</strong>
          <em>{step.note}</em>
        </li>
      ))}
    </ol>
  );
}

export default Help;