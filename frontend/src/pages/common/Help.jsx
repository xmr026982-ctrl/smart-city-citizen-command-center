import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, Mail, LifeBuoy, Map, FilePlus2, Activity, Bell, ClipboardList, ArrowUpRight, ArrowRight, X, Users,
  UserCog, Shield, Hourglass, FileText, UserPlus, Settings as SettingsIcon, KeyRound, Keyboard, Lightbulb, ChevronLeft, ChevronRight,
} from "lucide-react";
import "../../styles/help.css";
import { useAuth } from "../../store/authStore";
import { TOPICS, STATUS, GROUPS, QUICK, KEYS } from "../../config/helpContent";
import { ROLE_META } from "../../config/settingsSchema";
import { SUPPORT_EMAIL, supportMail } from "../../config/server";
import { useUrlParam } from "../../hooks/useUrlParam";

/* ------------------------------------------------------------------
   Help: one page per desk, from config/helpContent.js.
     Start here   the three things this desk asks about most
     Topics       grouped: your desk, every desk, your account
     A topic      what it is, the steps in order, a tip, the page itself
     Search       across every topic of this desk, matches marked
   The open topic lives in the address (/help?topic=report): Back returns
   to the last one, and a link can open a topic directly.
   Support is for access only; a city problem is a report.
------------------------------------------------------------------- */

const DESK = { citizen: "Citizen Services", staff: "Field Desk", admin: "Civic Command" };
const ICONS = {
  city: Activity, field: Activity, report: FilePlus2, mine: FileText, follow: UserPlus, assigned: ClipboardList,
  command: Shield, windows: Hourglass, desk: UserCog, map: Map, community: Users, alerts: Bell, settings: SettingsIcon, access: KeyRound,
};
const LADDER = { report: true, mine: true, assigned: true, command: true };
/* the page each topic's button opens, by the name the app gives it */
const PAGE = {
  city: "City Health", field: "Field Health", report: "Report Issue", mine: "My Reports", follow: "Open reports", assigned: "Assigned Work",
  command: "Issue Command", windows: "Service Windows", desk: "Staff Desk", map: "Map", community: "Community", alerts: "Notifications",
  settings: "Settings", access: "Sign-in & Security",
};
const LANES = {
  citizen: "A broken streetlight, a pothole, a leak: that's a report, and the city handles it from there. Write to support only when you can't sign in or a page won't open.",
  staff: "A file question goes to command on the file itself. Write to support only when you can't sign in or a page won't open.",
  admin: "Write to support only for access: the command sign-in, or a desk that won't open.",
};

const hexRgb = (hex) => {
  const h = String(hex || "#0284c7").replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(" ");
};

/* the matching part of a line, marked */
function Marked({ text, needle }) {
  if (!needle) return text;
  const i = text.toLowerCase().indexOf(needle);
  if (i < 0) return text;
  return <>{text.slice(0, i)}<mark>{text.slice(i, i + needle.length)}</mark>{text.slice(i + needle.length)}</>;
}

export default function Help() {
  const me = useAuth();
  const role = me?.role || "citizen";
  const meta = ROLE_META[role] || ROLE_META.citizen;
  const navigate = useNavigate();
  const searchRef = useRef(null);
  const [q, setQ] = useState("");
  const [gate, setGate] = useState(false);

  // this desk's topics, with their copy for this role
  const topics = useMemo(
    () => TOPICS.filter((t) => t.roles.includes(role)).map((t) => ({ ...t, ...t.copy[role], to: t.to?.[role] })),
    [role]
  );
  const [topicId, setTopicId] = useUrlParam("topic", { allowed: topics.map((t) => t.id), fallback: topics[0].id });
  const topic = topics.find((t) => t.id === topicId) || topics[0];
  const index = topics.indexOf(topic);
  const open = (id) => { setQ(""); setTopicId(id, { push: true }); window.scrollTo?.({ top: 0, behavior: "smooth" }); };

  const needle = q.trim().toLowerCase();
  const hits = useMemo(() => {
    if (!needle) return [];
    return topics
      .map((t) => {
        const lines = [t.lead, ...(t.steps || []), t.tip].filter(Boolean).filter((l) => l.toLowerCase().includes(needle));
        const titleHit = t.title.toLowerCase().includes(needle);
        return titleHit || lines.length ? { t, lines: lines.slice(0, 3), score: (titleHit ? 10 : 0) + lines.length } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);
  }, [needle, topics]);

  // "/" searches, Esc clears the search
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target.tagName || "").toLowerCase();
      if (e.key === "/" && !["input", "textarea", "select"].includes(tag)) { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === "Escape" && tag === "input" && q) { setQ(""); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [q]);

  useEffect(() => {
    document.body.style.overflow = gate ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [gate]);

  const groups = Object.keys(GROUPS).map((g) => ({ g, list: topics.filter((t) => t.group === g) })).filter((x) => x.list.length);
  const TopicIcon = ICONS[topic.id] || LifeBuoy;

  return (
    <main className={`page help tone-${role}`} style={{ "--acc": meta.acc, "--acc-rgb": hexRgb(meta.acc) }}>
      <header className="hp-head">
        <div>
          <p className="hp-crumb"><i />Help <b>/</b> {DESK[role]}</p>
          <h1>Help</h1>
          <p className="hp-sub">How this desk works, step by step. Every topic opens the page it describes.</p>
        </div>
        <label className="hp-search">
          <Search size={16} />
          <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${topics.length} topics`} aria-label="Search help" />
          {q ? <button type="button" className="hp-clear" onClick={() => setQ("")} aria-label="Clear search"><X size={14} /></button> : <kbd>/</kbd>}
        </label>
      </header>

      <section className="hp-quick" aria-label="Start here">
        {(QUICK[role] || []).map((x, i) => {
          const Icon = ICONS[x.topic] || LifeBuoy;
          const on = !needle && topic.id === x.topic;
          return (
            <button key={x.topic} type="button" className={`hp-q${on ? " on" : ""}`} onClick={() => open(x.topic)} aria-pressed={on}>
              <span className="hp-q-n">{String(i + 1).padStart(2, "0")}</span>
              <span className="hp-q-ic"><Icon size={17} /></span>
              <span className="hp-q-t"><b>{x.title}</b><small>{x.line}</small></span>
              <ArrowRight size={16} className="hp-q-go" />
              {on ? <><i className="hp-c tl" /><i className="hp-c br" /></> : null}
            </button>
          );
        })}
      </section>

      <div className="hp-grid">
        <aside className="hp-side">
          <nav className="hp-rail" aria-label="Help topics">
            {groups.map(({ g, list }) => (
              <div key={g} className="hp-group">
                <p className="hp-gl">{GROUPS[g]}</p>
                {list.map((t) => {
                  const Icon = ICONS[t.id] || LifeBuoy;
                  const on = !needle && t.id === topic.id;
                  return (
                    <button key={t.id} type="button" className={on ? "on" : ""} aria-current={on ? "page" : undefined} onClick={() => open(t.id)}>
                      <Icon size={15} />
                      <span>{t.title}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>

          <div className="hp-keys">
            <p className="hp-gl"><Keyboard size={12} /> Keys on every desk page</p>
            <dl>
              {KEYS.map((k) => (<div key={k.k}><dt><kbd>{k.k}</kbd></dt><dd>{k.what}</dd></div>))}
            </dl>
          </div>
        </aside>

        <div className="hp-main">
          {needle ? (
            <section className="hp-results" aria-live="polite">
              <p className="hp-gl">{hits.length ? `${hits.length} topic${hits.length === 1 ? "" : "s"} for “${q.trim()}”` : `Nothing for “${q.trim()}”`}</p>
              {hits.length ? hits.map(({ t, lines }) => {
                const Icon = ICONS[t.id] || LifeBuoy;
                return (
                  <button key={t.id} type="button" className="hp-hit" onClick={() => open(t.id)}>
                    <span className="hp-q-ic"><Icon size={16} /></span>
                    <span className="hp-hit-t">
                      <b><Marked text={t.title} needle={needle} /></b>
                      {lines.map((l) => <small key={l}><Marked text={l} needle={needle} /></small>)}
                    </span>
                    <ArrowRight size={15} className="hp-q-go" />
                  </button>
                );
              }) : (
                <div className="hp-empty">
                  <p>No topic on this desk mentions that. Try a shorter word, like “close”, “zone” or “password”.</p>
                  <button type="button" className="hp-ghost" onClick={() => setQ("")}>Show all topics</button>
                </div>
              )}
            </section>
          ) : (
            <article className="hp-card" key={topic.id}>
              <i className="hp-c tl" /><i className="hp-c br" />
              <header>
                <span className="hp-card-ic"><TopicIcon size={18} /></span>
                <div>
                  <p className="hp-kick">{GROUPS[topic.group]} · {String(index + 1).padStart(2, "0")} of {String(topics.length).padStart(2, "0")}</p>
                  <h2>{topic.title}</h2>
                </div>
                {topic.to ? (
                  <button type="button" className="hp-go" onClick={() => navigate(topic.to)}>Open {PAGE[topic.id] || topic.title} <ArrowUpRight size={15} /></button>
                ) : null}
              </header>
              <p className="hp-lead">{topic.lead}</p>
              <ol>
                {(topic.steps || []).map((s) => <li key={s}>{s}</li>)}
              </ol>
              {topic.tip ? <p className="hp-tip"><Lightbulb size={15} /><span>{topic.tip}</span></p> : null}
              {LADDER[topic.id] ? (
                <div className="hp-ladder">
                  <p className="hp-gl">Where a {role === "citizen" ? "report" : "file"} is</p>
                  <ol className="hp-status" style={{ "--n": (STATUS[role] || STATUS.citizen).length }}>
                    {(STATUS[role] || STATUS.citizen).map((st, i) => (
                      <li key={st.id}><b>{String(i + 1).padStart(2, "0")}</b><strong>{st.label}</strong><em>{st.note}</em></li>
                    ))}
                  </ol>
                </div>
              ) : null}
              <footer className="hp-pager">
                <button type="button" className="hp-ghost" disabled={index === 0} onClick={() => open(topics[index - 1].id)}>
                  <ChevronLeft size={15} /> {index > 0 ? topics[index - 1].title : "First topic"}
                </button>
                <button type="button" className="hp-ghost" disabled={index === topics.length - 1} onClick={() => open(topics[index + 1].id)}>
                  {index < topics.length - 1 ? topics[index + 1].title : "Last topic"} <ChevronRight size={15} />
                </button>
              </footer>
            </article>
          )}

          <button type="button" className="hp-mail" onClick={() => setGate(true)}>
            <span className="hp-card-ic"><Mail size={16} /></span>
            <span><b>Can't sign in, or a page won't open?</b><small>{LANES[role]}</small></span>
            <ArrowUpRight size={16} />
          </button>
        </div>
      </div>

      {gate ? <MailGate desk={DESK[role]} onClose={() => setGate(false)} /> : null}
    </main>
  );
}

function MailGate({ desk, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const openGmail = () => {
    window.open(supportMail(`Desk support · ${desk}`), "_blank", "noopener,noreferrer");
    onClose();
  };
  return (
    <div className="hp-veil" onClick={onClose}>
      <section className="hp-gate" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Write to support">
        <i className="hp-c tl" /><i className="hp-c br" />
        <header>
          <div>
            <p>Support</p>
            <h2>Write to support</h2>
          </div>
          <button type="button" className="hp-x" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </header>
        <div className="hp-gate-body">
          <p>Gmail opens with the address and subject filled in. Say what you tried and what you see. Never send your password.</p>
          <dl>
            <div><dt>To</dt><dd>{SUPPORT_EMAIL}</dd></div>
            <div><dt>Desk</dt><dd>{desk}</dd></div>
            <div><dt>For</dt><dd>Sign-in, and a page that won't open</dd></div>
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
