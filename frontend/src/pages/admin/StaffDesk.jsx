import { useMemo, useState } from "react";
import { Search, BadgeCheck, Shield, Users, X, Inbox, Zap, Mail } from "lucide-react";
import { ROLE_META } from "../../config/settingsSchema";
import {
  useDesk, acceptRequest, rejectRequest, removeStaff, setRank, setVerified,
  RANKS, EXPERTISE, expertiseLabel,
} from "../../store/staffDeskStore";
import "../../styles/staff-desk.css";

function StaffDesk() {
  const { roster, requests } = useDesk();
  const acc = ROLE_META.admin.acc;
  const [tab, setTab] = useState("field");
  const [q, setQ] = useState("");
  const [rank, setRankFilter] = useState("all");
  const [skill, setSkill] = useState("all");
  const [openId, setOpenId] = useState("");
  const [reqId, setReqId] = useState("");

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return roster.filter((p) => {
      if (rank !== "all" && p.rank !== rank) return false;
      if (skill !== "all" && p.expertise !== skill) return false;
      if (!needle) return true;
      return [p.name, p.zone, p.rank, expertiseLabel(p.expertise)].join(" ").toLowerCase().includes(needle);
    });
  }, [roster, q, rank, skill]);

  const open = roster.find((p) => p.id === openId) || null;
  const request = requests.find((r) => r.id === reqId) || null;

  return (
    <main className="page desk" style={{ "--acc": acc }}>
      <header className="dk-head">
        <div>
          <p className="dk-crumb">CONTROL CORE <b>/</b> STAFF DESK</p>
          <h1>Staff Desk</h1>
          <p className="dk-sub">Field clearance. Rank is seniority. Expertise is the work they take.</p>
        </div>
        <label className="dk-search">
          <Search size={15} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search staff" />
        </label>
      </header>

      <section className="dk-tiles">
        <Tile icon={Users} label="On field" value={roster.length} />
        <Tile icon={BadgeCheck} label="Verified" value={roster.filter((p) => p.verified).length} />
        <Tile icon={Shield} label="On duty" value={roster.filter((p) => p.onDuty).length} />
        <Tile icon={Inbox} label="Clearance" value={requests.length} />
      </section>

      <div className="dk-tabs">
        <button type="button" className={tab === "field" ? "on" : ""} onClick={() => setTab("field")}>On field</button>
        <button type="button" className={tab === "queue" ? "on" : ""} onClick={() => setTab("queue")}>
          Clearance queue <em>{requests.length}</em>
        </button>
      </div>

      {tab === "field" && (
        <>
          <div className="dk-filters">
            <button type="button" className={skill === "all" ? "on" : ""} onClick={() => setSkill("all")}>All expertise</button>
            {EXPERTISE.map((e) => (
              <button key={e.id} type="button" className={skill === e.id ? "on" : ""} onClick={() => setSkill(e.id)}>{e.label}</button>
            ))}
          </div>
          <div className="dk-filters">
            <button type="button" className={rank === "all" ? "on" : ""} onClick={() => setRankFilter("all")}>All ranks</button>
            {RANKS.map((r) => (
              <button key={r} type="button" className={rank === r ? "on" : ""} onClick={() => setRankFilter(r)}>{r}</button>
            ))}
          </div>
          {!list.length && <div className="dk-empty">No staff match.</div>}
          <section className="dk-grid">
            {list.map((p, i) => (
              <button key={p.id} type="button" className="dk-card tilt" style={{ animationDelay: `${i * 50}ms` }} onClick={() => setOpenId(p.id)}>
                <span className="tilt-glare" />
                <Mark name={p.name} />
                <div className="dk-ident">
                  <strong>{p.name}</strong>
                  <em>{p.rank}</em>
                  <span>{p.zone}</span>
                </div>
                <div className="dk-pills">
                  <i className="skill"><Zap size={10} /> {expertiseLabel(p.expertise)}</i>
                  {p.verified && <i className="ok">Verified</i>}
                  <i className={p.onDuty ? "on" : ""}>{p.onDuty ? "On duty" : "Off duty"}</i>
                </div>
                <dl>
                  <div><dt>Load</dt><dd>{p.load}</dd></div>
                  <div><dt>Closed</dt><dd>{p.closed}</dd></div>
                </dl>
              </button>
            ))}
          </section>
        </>
      )}

      {tab === "queue" && (
        <section className="dk-grid">
          {!requests.length && <div className="dk-empty">Clearance queue is clear.</div>}
          {requests.map((r, i) => (
            <button key={r.id} type="button" className="dk-card tilt" style={{ animationDelay: `${i * 50}ms` }} onClick={() => setReqId(r.id)}>
              <span className="tilt-glare" />
              <Mark name={r.name} />
              <div className="dk-ident">
                <strong>{r.name}</strong>
                <em>Awaiting clearance</em>
                <span>{r.zone}</span>
              </div>
              <div className="dk-pills">
                <i className="skill"><Zap size={10} /> {expertiseLabel(r.expertise)}</i>
                <i>Pending</i>
              </div>
              <p className="dk-qual">{r.experience}</p>
            </button>
          ))}
        </section>
      )}

      {open && <PersonDoor person={open} onClose={() => setOpenId("")} />}
      {request && <RequestDoor request={request} onClose={() => setReqId("")} />}
    </main>
  );
}

function Tile({ icon: Icon, label, value }) {
  return (
    <article className="dk-tile tilt">
      <span className="tilt-glare" />
      <header><Icon size={16} /><span>{label}</span></header>
      <strong>{value}</strong>
    </article>
  );
}

function Mark({ name }) {
  return (
    <span className="dk-avatar">
      <svg className="ring a" viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r="57" fill="none" stroke="currentColor" strokeWidth="1.4" strokeDasharray="2 7" />
      </svg>
      <svg className="ring b" viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r="51" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="70 250" />
        <circle cx="60" cy="60" r="51" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="24 296" strokeDashoffset="-170" opacity=".5" />
      </svg>
      <span className="core">
        <b>{initials(name)}</b>
        <i className="scanbar" />
      </span>
    </span>
  );
}

function PersonDoor({ person, onClose }) {
  const [confirm, setConfirm] = useState(false);

  return (
    <div className="dk-veil" onClick={onClose}>
      <aside className="dk-door" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <header>
          <div>
            <p>FIELD FILE</p>
            <h2>{person.name}</h2>
          </div>
          <button type="button" className="dk-x" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </header>
        <div className="dk-door-body">
          <div className="dk-id">
            <Mark name={person.name} />
            <div>
              <strong>{person.rank}</strong>
              <span>{expertiseLabel(person.expertise)} · {person.zone}</span>
            </div>
          </div>

          {person.email && (
            <div className="dk-email">
              <Mail size={14} />
              <span>{person.email}</span>
            </div>
          )}

          <dl className="dk-meta">
            <div><dt>Expertise</dt><dd>{expertiseLabel(person.expertise)}</dd></div>
            <div><dt>Open load</dt><dd>{person.load}</dd></div>
            <div><dt>Closed</dt><dd>{person.closed}</dd></div>
            <div><dt>Duty</dt><dd>{person.onDuty ? "On duty" : "Off duty"}</dd></div>
            <div><dt>Badge</dt><dd>{person.verified ? "Verified" : "Unverified"}</dd></div>
            <div><dt>Zone</dt><dd>{person.zone}</dd></div>
          </dl>

          <label className="dk-field">
            Rank
            <select value={person.rank} onChange={(e) => setRank(person.id, e.target.value)}>
              {RANKS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </label>

          <button type="button" className={person.verified ? "dk-badge on" : "dk-badge"} onClick={() => setVerified(person.id, !person.verified)}>
            <BadgeCheck size={15} />
            {person.verified ? "Verified badge on" : "Give verified badge"}
          </button>

          {!confirm && <button type="button" className="dk-remove" onClick={() => setConfirm(true)}>Remove from the system</button>}
          {confirm && (
            <div className="dk-confirm">
              <p className="dk-confirm-kicker">CONFIRM REMOVAL</p>
              <strong>{person.name}</strong>
              <p>This removes them from the system. They leave the field and this desk. Past files stay in the record.</p>
              <div>
                <button type="button" onClick={() => { removeStaff(person.id); onClose(); }}>Remove from the system</button>
                <button type="button" className="ghost" onClick={() => setConfirm(false)}>Keep</button>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function RequestDoor({ request, onClose }) {
  const [rank, setRankValue] = useState("Field Operative");
  const [deny, setDeny] = useState(false);

  return (
    <div className="dk-veil" onClick={onClose}>
      <aside className="dk-door" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <header>
          <div>
            <p>CLEARANCE</p>
            <h2>{request.name}</h2>
          </div>
          <button type="button" className="dk-x" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </header>
        <div className="dk-door-body">
          <div className="dk-id">
            <Mark name={request.name} />
            <div>
              <strong>Awaiting clearance</strong>
              <span>{request.zone}</span>
            </div>
          </div>
          <dl className="dk-meta">
            <div><dt>Expertise</dt><dd>{expertiseLabel(request.expertise)}</dd></div>
            <div><dt>Experience</dt><dd>{request.experience}</dd></div>
            <div><dt>Zone</dt><dd>{request.zone}</dd></div>
            <div><dt>Filed</dt><dd>{new Date(request.filedAt).toLocaleDateString()}</dd></div>
          </dl>
          <div className="dk-qual-block">
            <span>Filed note</span>
            <p>{request.note}</p>
          </div>
          <label className="dk-field">
            Rank on accept
            <select value={rank} onChange={(e) => setRankValue(e.target.value)}>
              {RANKS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </label>
          {!deny && (
            <div className="dk-actions">
              <button type="button" className="dk-appoint" onClick={() => { acceptRequest(request.id, rank); onClose(); }}>Accept clearance</button>
              <button type="button" className="dk-remove" onClick={() => setDeny(true)}>Reject</button>
            </div>
          )}
          {deny && (
            <div className="dk-confirm">
              <p className="dk-confirm-kicker">DENY CLEARANCE</p>
              <strong>{request.name}</strong>
              <p>The request is closed. Access stays denied. This cannot be undone from here.</p>
              <div>
                <button type="button" onClick={() => { rejectRequest(request.id); onClose(); }}>Reject request</button>
                <button type="button" className="ghost" onClick={() => setDeny(false)}>Keep open</button>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function initials(name) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

export default StaffDesk;