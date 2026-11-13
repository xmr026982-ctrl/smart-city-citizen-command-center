import { useEffect, useMemo, useRef, useState } from "react";
import { setTopTag } from "../../store/topbarContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  FileText, MapPinned, Camera, Send, Check, CheckCircle2, AlertTriangle, Siren, Users, Hourglass, Zap,
  ArrowUpRight, ArrowLeft, ArrowRight, RotateCcw, Radar, ShieldCheck, Sparkles, Plus, FileSearch, Lock,
} from "lucide-react";
import { CatGlyph, StatusPill, ago } from "../../components/issues/admin/CommandKit";
import { Citizen, CitizenHead, useCitizenDesk, promiseOf } from "../../components/issues/citizen/CitizenKit";
import ZonePinPicker, { ZoneChips } from "../../components/issues/citizen/ZonePinPicker";
import LocationDoor from "../../components/issues/citizen/LocationDoor";
import PhotoBay from "../../components/issues/citizen/PhotoBay";
import { CATEGORY_LABEL, ISSUE_CATEGORIES } from "../../constants/issueCategories";
import { PRIORITY_LABEL } from "../../constants/issuePriorities";
import { publicStatus } from "../../constants/issueStatuses";
import { WARDS } from "../../constants/issueConstants";
import { useFieldRoster } from "../../store/fieldRoster";
import { span } from "../../utils/sla";
import { CITY_MAP, CITY_BOUNDS, cityMapLink } from "../../config/cityMap";
import { serverNotice } from "../../services/notice";
import {
  EMPTY_REPORT, TITLE_MAX, DESC_MAX, LANDMARK_MAX, DESC_MIN, completeness, routeOf, similarReports, fileReport, meToo, affected,
} from "../../services/citizenService";

/* ------------------------------------------------------------------
   Report Issue: the citizen's report console.

   Built from what a citizen actually has to tell the city, nothing more:
   what it is, what you see, where it is. Four steps on one card, taken
   in order: a step opens only once every step before it is answered
   (going back is always open):
     1 Problem   pick the kind (moves on by itself)
     2 Details   title, what you see, "someone could get hurt"
     3 Location  zone, the exact spot (location door / city map), landmark
     4 Send      already reported nearby? a photo if you have one, a last
                 look at everything, send
   The lock-on pods on top show where you are: brackets lock onto the
   current step, done steps carry a check, steps not yet reachable show
   a lock. Pressing Next, or a locked pod, shows what's missing on the
   step that blocks the way (and shakes it); nothing is marked red before
   the citizen tries. On every step change the card's four corner
   brackets flash once.

   Beside it, the live preview fills in as the citizen answers: the
   report as the city receives it, then what the city does with it
   (crew line, crews on duty, starting priority, the promised window from
   command's Service Windows table). It stands level with the card and
   doesn't move with the scroll.

   Draft is kept per citizen (not photos). A trip to the city map keeps
   the photos in this tab's session storage and comes back to Location
   with ?zone&lat&lng&label, which is checked before it's used.
------------------------------------------------------------------- */

const DRAFT = (id) => `citizen-report-draft-${id || "guest"}`;
const TRIP = (id) => `citizen-report-trip-${id || "guest"}`;
const TRIP_TTL = 30 * 60 * 1000; // a trip to the map older than this is stale

const STEPS = [
  { id: "kind", n: "01", label: "Problem", icon: Zap, fields: ["category"] },
  { id: "details", n: "02", label: "Details", icon: FileText, fields: ["title", "description"] },
  { id: "where", n: "03", label: "Location", icon: MapPinned, fields: ["ward", "pin", "landmark"] },
  { id: "send", n: "04", label: "Send", icon: Send, fields: [] },
];
const INDEX = Object.fromEntries(STEPS.map((s, i) => [s.id, i]));
const REQUIRED = ["kind", "details", "where"];

const HINT = {
  roads: "Potholes, broken signals, blocked roads",
  lighting: "Dark or flickering streetlights",
  water: "No water, leaks, dirty supply",
  waste: "Overflowing bins, missed pickup",
  electricity: "Power cuts, loose or sparking wires",
  safety: "Open manholes, broken railings",
  other: "Anything else the city should fix",
};

const QUESTION = {
  kind: ["What kind of problem is it?", "Pick the closest match. It decides which city crew gets your report."],
  details: ["Tell us what you see", "A short title and a few lines. Say since when, and how it affects people."],
  where: ["Where exactly is it?", "Pick the zone, then pin the exact spot so the crew walks straight to it."],
  send: ["Check and send", "Add a photo if you have one, look it over, and send."],
};

function readDraft(id) {
  try {
    const raw = localStorage.getItem(DRAFT(id));
    return raw ? { ...EMPTY_REPORT, ...JSON.parse(raw) } : null;
  } catch {
    return null;
  }
}

// photos (and a flag) carried across the trip to the city map; read only, removed in an effect
function readTrip(id) {
  try {
    const raw = sessionStorage.getItem(TRIP(id));
    const trip = raw ? JSON.parse(raw) : null;
    return trip && Date.now() - (trip.at || 0) < TRIP_TTL ? trip : null;
  } catch {
    return null;
  }
}

// a pin handed back by the city map, checked before it touches the draft
function readReturn(params) {
  if (!params.has("zone") && !params.has("lat")) return null;
  const zone = params.get("zone") || "";
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  const ok = WARDS.some((w) => w.name === zone)
    && Number.isFinite(lat) && Number.isFinite(lng)
    && lat >= CITY_BOUNDS.south && lat <= CITY_BOUNDS.north && lng >= CITY_BOUNDS.west && lng <= CITY_BOUNDS.east;
  if (!ok) return { bad: true };
  return { zone, lat: +lat.toFixed(6), lng: +lng.toFixed(6), label: (params.get("label") || "").trim().replace(/\s+/g, " ").slice(0, LANDMARK_MAX) };
}

function Counter({ value, max, min }) {
  const n = value.trim().length;
  if (min && n < min) return <span className="rc-count low">{min - n} more character{min - n === 1 ? "" : "s"} needed</span>;
  return <span className={`rc-count ${n > max ? "bad" : "ok"}`}>{n}/{max}</span>;
}

const stepDone = (id, state) => (id === "send" ? false : STEPS[INDEX[id]].fields.every((f) => !state.errors[f]));

function firstStep(restored, trip) {
  if (trip) return "where";
  if (!restored) return "kind";
  const st = completeness(restored);
  return REQUIRED.find((id) => STEPS[INDEX[id]].fields.some((f) => st.errors[f])) || "send";
}

function ReportIssue() {
  const { user, issues, mine } = useCitizenDesk(); // the desk hook ticks every 30 s, so windows and crews stay live
  const { roster } = useFieldRoster();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [restored] = useState(() => readDraft(user?.id));
  const [trip] = useState(() => readTrip(user?.id));
  const [draft, setDraft] = useState(restored || EMPTY_REPORT);
  const [photos, setPhotos] = useState(() => trip?.photos || []);
  const [step, setStep] = useState(() => firstStep(restored, trip));
  const [dir, setDir] = useState("fwd");
  const [checked, setChecked] = useState(() => new Set()); // steps where Next was pressed: their errors show
  const [sent, setSent] = useState(null); // { kind: "filed" | "joined", id, window, warning? }
  // "kept from last time" only for a real return visit, not for the trip back from the map
  const [restoredNote, setRestoredNote] = useState(Boolean(!trip && restored && restored.title));
  const [joinError, setJoinError] = useState("");
  const [door, setDoor] = useState(false);
  const [lockKey, setLockKey] = useState(0);
  const [tripNote, setTripNote] = useState(trip?.lost ? `Your ${trip.lost} photo${trip.lost === 1 ? " was" : "s were"} too large to carry to the map. Add ${trip.lost === 1 ? "it" : "them"} again on Send.` : "");
  const [flash, setFlash] = useState(0); // replays the corner flash on a step change
  const consoleRef = useRef(null);
  const stageRef = useRef(null);
  const advanceRef = useRef(null);

  // the trip is over once we're back
  useEffect(() => {
    try { sessionStorage.removeItem(TRIP(user?.id)); } catch { /* ignore */ }
  }, [user?.id]);

  // a pin handed back by the city map (?zone&lat&lng&label), applied once
  useEffect(() => {
    const back = readReturn(params);
    if (!back) return;
    setParams({}, { replace: true });
    setStep("where");
    if (back.bad) {
      setTripNote("The map sent back a spot this page couldn't read. Open the exact spot again and re-pin it.");
      return;
    }
    setDraft((d) => ({ ...d, ward: back.zone, lat: back.lat, lng: back.lng, pinLabel: back.label, landmark: d.landmark.trim() ? d.landmark : back.label }));
    setLockKey(Date.now());
  }, [params, setParams]);

  // keep the draft (not the photos) for this citizen
  useEffect(() => {
    if (sent) return;
    try {
      const empty = JSON.stringify(draft) === JSON.stringify(EMPTY_REPORT);
      if (empty) localStorage.removeItem(DRAFT(user?.id));
      else localStorage.setItem(DRAFT(user?.id), JSON.stringify(draft));
    } catch { /* storage blocked: the draft lives for this visit only */ }
  }, [draft, sent, user?.id]);

  useEffect(() => () => clearTimeout(advanceRef.current), []);

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const state = completeness(draft);
  const route = routeOf(draft, roster);
  const similar = useMemo(() => similarReports(draft, user, issues), [draft, user, issues]);

  // the report's zone rides along in the top bar while the form is open
  useEffect(() => { setTopTag(draft.ward || null); }, [draft.ward]);
  useEffect(() => () => setTopTag(null), []);
  const openBoard = useMemo(() => issues.filter((i) => i.status !== "resolved"), [issues]);
  const myOpen = mine.filter((i) => i.status !== "resolved").length;
  const pinned = Number.isFinite(draft.lat) && Number.isFinite(draft.lng);
  const at = INDEX[step];
  const errors = {};
  REQUIRED.forEach((id) => {
    if (!checked.has(id)) return;
    STEPS[INDEX[id]].fields.forEach((f) => { if (state.errors[f]) errors[f] = state.errors[f]; });
  });
  const doneCount = REQUIRED.filter((id) => stepDone(id, state)).length;
  // a step opens once every step before it is answered
  const blockerBefore = (i) => STEPS.slice(0, i).find((s) => REQUIRED.includes(s.id) && !stepDone(s.id, state));
  const similarCount = similar.mine.length + similar.others.length;

  const go = (id) => {
    clearTimeout(advanceRef.current);
    if (id === step) return;
    setDir(INDEX[id] > at ? "fwd" : "back");
    setStep(id);
    setFlash(Date.now());
    requestAnimationFrame(() => {
      const top = consoleRef.current?.getBoundingClientRect().top;
      if (top !== undefined && top < 70) consoleRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };
  // show what's missing on the step that blocks the way, and nudge it
  const block = (id) => {
    setChecked((c) => new Set(c).add(id));
    if (id !== step) { go(id); return; }
    // already on it: a short shake, without remounting the fields (focus and typing stay)
    stageRef.current?.animate?.(
      [{ transform: "translateX(0)" }, { transform: "translateX(-7px)" }, { transform: "translateX(6px)" }, { transform: "translateX(-4px)" }, { transform: "translateX(0)" }],
      { duration: 340, easing: "ease-out" }
    );
  };
  // forward moves go through here: open only if everything before is answered
  const tryGo = (id) => {
    const i = INDEX[id];
    if (i <= at) { go(id); return; }
    const blocker = blockerBefore(i);
    if (blocker) block(blocker.id);
    else go(id);
  };
  const next = () => { if (at < STEPS.length - 1) tryGo(STEPS[at + 1].id); };
  const back = () => { if (at > 0) go(STEPS[at - 1].id); };

  const pickKind = (c) => {
    set({ category: c });
    clearTimeout(advanceRef.current);
    if (step === "kind") advanceRef.current = setTimeout(() => { setDir("fwd"); setStep("details"); setFlash(Date.now()); }, 380);
  };

  const [filing, setFiling] = useState(false);
  const submit = async () => {
    if (filing) return;
    if (!state.ready) {
      block(REQUIRED.find((id) => !stepDone(id, state)) || "kind");
      return;
    }
    setFiling(true);
    const res = await fileReport(draft, photos, user); // with the server this waits for its answer
    setFiling(false);
    if (!res.ok) {
      if (res.errors?.server) serverNotice(res.errors.server);
      return;
    }
    try { localStorage.removeItem(DRAFT(user?.id)); } catch { /* ignore */ }
    setSent({ kind: "filed", id: res.id, window: res.window, priority: res.priority, warning: res.warning });
    requestAnimationFrame(() => document.querySelector(".page")?.scrollTo({ top: 0, behavior: "smooth" }));
  };

  const join = (issue) => {
    const res = meToo(issue.id, user);
    if (!res.ok) { setJoinError(res.reason); return; }
    try { localStorage.removeItem(DRAFT(user?.id)); } catch { /* ignore */ }
    setSent({ kind: "joined", id: issue.id, window: issue.slaHours });
    requestAnimationFrame(() => document.querySelector(".page")?.scrollTo({ top: 0, behavior: "smooth" }));
  };

  const fresh = () => {
    clearTimeout(advanceRef.current);
    setDraft(EMPTY_REPORT);
    setPhotos([]);
    setChecked(new Set());
    setSent(null);
    setJoinError("");
    setRestoredNote(false);
    setTripNote("");
    setLockKey(0);
    setDir("back");
    setStep("kind");
    setFlash(Date.now());
  };

  const pickWard = (ward) => setDraft((d) => (d.ward === ward ? d : { ...d, ward, lat: null, lng: null, pinLabel: "" }));
  const lockSpot = ({ lat, lng, label }) => {
    setDraft((d) => ({ ...d, lat, lng, pinLabel: label || "", landmark: d.landmark.trim() || !label || label.startsWith("Your location") ? d.landmark : label }));
    setLockKey(Date.now());
    setDoor(false);
  };
  // leaving for the city map: the draft is already saved; carry the photos for the trip
  const openMap = (ward) => {
    const stamp = Date.now();
    try {
      sessionStorage.setItem(TRIP(user?.id), JSON.stringify({ at: stamp, photos }));
    } catch {
      try { sessionStorage.setItem(TRIP(user?.id), JSON.stringify({ at: stamp, photos: [], lost: photos.length })); } catch { /* ignore */ }
    }
    navigate(cityMapLink(ward, draft.category));
  };

  const onKeys = (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !door) {
      e.preventDefault();
      if (step === "send") submit(); else next();
    }
  };

  const sentIssue = sent ? issues.find((i) => i.id === sent.id) : null;

  return (
    <Citizen>
      <LocationDoor
        open={door && !sent}
        ward={draft.ward}
        lat={draft.lat}
        lng={draft.lng}
        pinLabel={draft.pinLabel}
        openIssues={openBoard}
        onWard={pickWard}
        onConfirm={lockSpot}
        onOpenMap={openMap}
        onClose={() => setDoor(false)}
      />
      <CitizenHead crumb="REPORT ISSUE" title="Report an issue">
        {myOpen ? <span className="ac-live"><i /> {myOpen} of your reports open</span> : null}
      </CitizenHead>

      {sent && sentIssue ? (
        <SentPanel sent={sent} issue={sentIssue} route={routeOf(sentIssue, roster)} onTrack={() => navigate(sent.kind === "joined" ? "/citizen/saved" : "/citizen/my-reports", { state: { open: sent.id } })} onAnother={fresh} />
      ) : (
        <>
          {tripNote ? (
            <div className="ac-banner">
              <span><AlertTriangle size={15} /> {tripNote}</span>
              <button type="button" className="ac-btn sm" onClick={() => setTripNote("")}>Got it</button>
            </div>
          ) : null}
          {restoredNote ? (
            <div className="ac-banner">
              <span><RotateCcw size={15} /> Your unsent report was kept from last time. Photos aren&apos;t kept in drafts.</span>
              <button type="button" className="ac-btn sm" onClick={() => { fresh(); try { localStorage.removeItem(DRAFT(user?.id)); } catch { /* ignore */ } }}>Start fresh</button>
            </div>
          ) : null}

          <div className="rk" ref={consoleRef} onKeyDown={onKeys}>
            <section className="rk-card" aria-labelledby="rk-q">
              <span className={`rk-frame${flash ? " flash" : ""}`} key={flash} aria-hidden>
                <i className="tl" /><i className="tr" /><i className="bl" /><i className="br" />
              </span>

              {/* ---------- lock-on pods ---------- */}
              <nav className="rk-pods" aria-label="Report steps">
                <span className="rk-wire" aria-hidden>
                  <i style={{ transform: `scaleX(${at / (STEPS.length - 1)})` }} />
                  {flash ? <b key={flash} /> : null}
                </span>
                {STEPS.map((s, i) => {
                  const on = s.id === step;
                  const done = stepDone(s.id, state);
                  const bad = s.fields.some((f) => errors[f]);
                  const locked = !on && i > at && Boolean(blockerBefore(i));
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className={`rk-pod${on ? " on" : ""}${done && !on ? " done" : ""}${bad && !on ? " bad" : ""}${locked ? " locked" : ""}`}
                      aria-current={on ? "step" : undefined}
                      aria-disabled={locked || undefined}
                      title={locked ? "Answer the steps before this one first" : undefined}
                      onClick={() => tryGo(s.id)}
                    >
                      {on ? <span className="rk-lockon" key={step} aria-hidden><i /><i /><i /><i /></span> : null}
                      <span className="rk-pod-ic">{locked ? <Lock size={12} /> : done && !on ? <Check size={13} strokeWidth={3} /> : <s.icon size={13} />}</span>
                      <em>{s.n}</em>
                      <b>{s.label}</b>
                    </button>
                  );
                })}
              </nav>

              {/* ---------- stage ---------- */}
              <div className={`rk-stage ${dir}`} key={step}>
                <div ref={stageRef}>
                <header className="rk-q">
                  <h2 id="rk-q">{QUESTION[step][0]}</h2>
                  <p>{QUESTION[step][1]}</p>
                </header>

                {step === "kind" ? (
                  <>
                    <div className="rk-kinds" role="radiogroup" aria-label="Kind of problem">
                      {ISSUE_CATEGORIES.map((c, i) => (
                        <button key={c} type="button" role="radio" aria-checked={draft.category === c} className={draft.category === c ? "on" : ""} style={{ animationDelay: `${i * 30}ms` }} onClick={() => pickKind(c)}>
                          <CatGlyph category={c} size={38} />
                          <span>
                            <b>{CATEGORY_LABEL[c]}</b>
                            <small>{HINT[c]}</small>
                          </span>
                          <i className="rk-tick"><Check size={12} /></i>
                        </button>
                      ))}
                    </div>
                    {errors.category ? <p className="rc-err">{errors.category}</p> : null}
                  </>
                ) : null}

                {step === "details" ? (
                  <div className="rk-fields">
                    <label className="rc-field">
                      <span className="rc-label">Short title <Counter value={draft.title} max={TITLE_MAX} /></span>
                      <input autoFocus value={draft.title} maxLength={TITLE_MAX + 20} placeholder="Example: Streetlight out near the park gate" onChange={(e) => set({ title: e.target.value })} aria-invalid={Boolean(errors.title)} />
                      {errors.title ? <span className="rc-err">{errors.title}</span> : null}
                    </label>
                    <label className="rc-field">
                      <span className="rc-label">What you see <Counter value={draft.description} max={DESC_MAX} min={DESC_MIN} /></span>
                      <textarea rows={4} value={draft.description} maxLength={DESC_MAX + 50} placeholder="What's wrong, since when, and how it affects people. Example: The light has been out for a week; the lane is dark after 7 pm." onChange={(e) => set({ description: e.target.value })} aria-invalid={Boolean(errors.description)} />
                      {errors.description ? <span className="rc-err">{errors.description}</span> : null}
                    </label>
                    <button type="button" role="switch" aria-checked={draft.danger} className={`rc-danger${draft.danger ? " on" : ""}`} onClick={() => set({ danger: !draft.danger })}>
                      <span className="rc-danger-ic"><Siren size={16} /></span>
                      <span className="rc-danger-copy">
                        <b>Someone could get hurt right now</b>
                        <em>Live wire, open manhole, fallen tree, gas smell. The city treats it as High priority.</em>
                      </span>
                      <span className="rc-toggle"><i /></span>
                    </button>
                  </div>
                ) : null}

                {step === "where" ? (
                  <div className="rk-where">
                    <div>
                      <p className={`rc-label${errors.ward ? " bad" : ""}`}>Zone</p>
                      <ZoneChips ward={draft.ward} onWard={pickWard} openIssues={openBoard} />
                      {errors.ward ? <p className="rc-err">{errors.ward}</p> : null}
                    </div>
                    <div className="rk-where-grid">
                      <ZonePinPicker
                        ward={draft.ward}
                        lat={draft.lat}
                        lng={draft.lng}
                        openIssues={openBoard}
                        error={errors.pin}
                        chips={false}
                        editable={false}
                        onOpen={() => setDoor(true)}
                        lockKey={lockKey}
                        onWard={pickWard}
                        onPin={() => {}}
                      />
                      <div className="rk-where-side">
                        <button
                          type="button"
                          className={`rc-loc${pinned ? " on" : ""}${errors.pin ? " bad" : ""}`}
                          disabled={!draft.ward}
                          onClick={() => setDoor(true)}
                          aria-label={pinned ? "Change the exact spot" : "Pin the exact spot"}
                        >
                          <span className="rc-loc-ic">{pinned ? <Check size={16} /> : <MapPinned size={16} />}</span>
                          <span className="rc-loc-copy">
                            <em>Exact spot</em>
                            <b>{pinned ? draft.pinLabel || "Dropped pin" : draft.ward ? `Pin it in ${draft.ward}` : "Pick a zone first"}</b>
                            {pinned ? (
                              <span className="rc-loc-ll"><span><i>LAT</i> {draft.lat.toFixed(6)}</span><span><i>LNG</i> {draft.lng.toFixed(6)}</span></span>
                            ) : (
                              <small>{draft.ward ? (CITY_MAP.installed ? "Opens the city map in this zone" : "Opens the pin panel for this zone") : "Choose a zone above"}</small>
                            )}
                          </span>
                          {draft.ward ? <span className="rc-loc-go">{pinned ? "Change" : "Pin"} <ArrowUpRight size={12} /></span> : null}
                        </button>
                        {errors.pin ? <p className="rc-err">{errors.pin}</p> : null}
                        <label className="rc-field">
                          <span className="rc-label">Nearest landmark or address <Counter value={draft.landmark} max={LANDMARK_MAX} /></span>
                          <input value={draft.landmark} maxLength={LANDMARK_MAX + 20} placeholder="Example: Opposite the metro gate" onChange={(e) => set({ landmark: e.target.value })} aria-invalid={Boolean(errors.landmark)} />
                          {errors.landmark ? <span className="rc-err">{errors.landmark}</span> : null}
                        </label>
                      </div>
                    </div>
                  </div>
                ) : null}

                {step === "send" ? (
                  <div className="rk-review">
                    {similarCount ? (
                      <div className="rk-similar">
                        <p className="rk-similar-head"><FileSearch size={14} /> {similar.others.length ? "Is this the same problem? Someone nearby already reported it." : "You already reported something like this."}</p>
                        <div className="rc-similar">
                          {similar.mine.map(({ issue }) => (
                            <div key={issue.id} className="rc-sim mine">
                              <div>
                                <b>{issue.title}</b>
                                <small><span className="ac-id">{issue.id}</span> · yours · {ago(issue.createdAt)}</small>
                              </div>
                              <button type="button" className="ac-btn sm" onClick={() => navigate("/citizen/my-reports", { state: { open: issue.id } })}>Track it <ArrowUpRight size={12} /></button>
                            </div>
                          ))}
                          {similar.others.map(({ issue, m }) => (
                            <div key={issue.id} className="rc-sim">
                              <div>
                                <b>{issue.title}</b>
                                <small>
                                  <span className="ac-id">{issue.id}</span> · <StatusPill status={publicStatus(issue.status)} /> · {m !== null ? `${m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`} away · ` : ""}{affected(issue)} affected
                                </small>
                              </div>
                              <button type="button" className="ac-btn sm primary" onClick={() => join(issue)}><Plus size={12} /> Affects me too</button>
                            </div>
                          ))}
                        </div>
                        {joinError ? <p className="rc-err">{joinError}</p> : null}
                        <p className="rk-similar-note">Same problem? Join it instead: the city sees more people affected and you follow it on Saved. Different problem? Send yours.</p>
                      </div>
                    ) : null}

                    <section className="rk-rv photo">
                      <header>
                        <span><Camera size={13} /> Photo</span>
                        <i className="rk-rv-state">{photos.length ? <><Check size={11} /> {photos.length} added</> : "Optional"}</i>
                      </header>
                      <div className="rk-rv-body wide"><PhotoBay photos={photos} onChange={setPhotos} /></div>
                    </section>

                    <div className="rk-rv-pair">
                      <ReviewBlock title="Problem" icon={Zap} ok={stepDone("kind", state) && stepDone("details", state)} onEdit={() => go(state.errors.category ? "kind" : "details")}>
                        {draft.category ? <span className="rk-rv-kind"><CatGlyph category={draft.category} size={24} /> {CATEGORY_LABEL[draft.category]}</span> : <span className="rk-rv-miss">Kind of problem missing</span>}
                        <b>{draft.title.trim() || <span className="rk-rv-miss">Title missing</span>}</b>
                        <p>{draft.description.trim() || <span className="rk-rv-miss">What you see is missing</span>}</p>
                        {draft.danger ? <span className="ac-tag red"><Siren size={9} /> Someone could get hurt</span> : null}
                      </ReviewBlock>
                      <ReviewBlock title="Location" icon={MapPinned} ok={stepDone("where", state)} onEdit={() => go("where")}>
                        <b>{draft.ward ? `${draft.ward}${draft.pinLabel ? ` · ${draft.pinLabel}` : ""}` : <span className="rk-rv-miss">Zone missing</span>}</b>
                        {pinned ? <span className="rc-loc-ll"><span><i>LAT</i> {draft.lat.toFixed(6)}</span><span><i>LNG</i> {draft.lng.toFixed(6)}</span></span> : <span className="rk-rv-miss">Exact spot not pinned</span>}
                        <p>{draft.landmark.trim() || <span className="rk-rv-miss">Landmark missing</span>}</p>
                      </ReviewBlock>
                    </div>
                  </div>
                ) : null}
                </div>
              </div>

              {/* ---------- nav ---------- */}
              <footer className="rk-nav">
                <button type="button" className="ac-btn" onClick={back} disabled={at === 0}><ArrowLeft size={14} /> Back</button>
                <span className="rk-nav-hint">{step === "send" ? (state.ready ? "Ready to send" : "Something is missing") : <>Step {at + 1} of {STEPS.length} · <kbd>Ctrl</kbd> + <kbd>Enter</kbd></>}</span>
                {step === "send" ? (
                  <button type="button" className={`ac-btn primary rk-send${state.ready ? " ready" : ""}`} onClick={submit} disabled={filing} aria-busy={filing}><Send size={15} /> {filing ? "Sending…" : "Send report"}</button>
                ) : (
                  <button type="button" className="ac-btn primary rk-next" onClick={next}>Next <ArrowRight size={14} /></button>
                )}
              </footer>
            </section>

            {/* ---------- live preview ---------- */}
            <LivePreview draft={draft} route={route} photos={photos} pinned={pinned} done={doneCount} ready={state.ready} similar={similarCount} onCheck={() => tryGo("send")} step={step} />
          </div>
        </>
      )}
    </Citizen>
  );
}

function ReviewBlock({ title, icon: Icon, ok, onEdit, children }) {
  return (
    <section className={`rk-rv${ok ? " ok" : " miss"}`}>
      <header>
        <span><Icon size={13} /> {title}</span>
        <i className="rk-rv-state">{ok ? <><Check size={11} /> Done</> : "Needs attention"}</i>
        <button type="button" className="ac-btn sm" onClick={onEdit}>Edit</button>
      </header>
      <div className="rk-rv-body">{children}</div>
    </section>
  );
}

function PreviewRow({ label, icon: Icon, on, hot, children }) {
  return (
    <div className={`rk-t-row${on ? " on" : ""}${hot ? " hot" : ""}`}>
      <span><Icon size={12} /> {label}</span>
      <b>{on ? children : <i className="rk-wait" aria-label="waiting" />}</b>
    </div>
  );
}

/* The report as the city will receive it, filling in as the citizen answers. */
function LivePreview({ draft, route, photos, pinned, done, ready, similar, onCheck, step }) {
  return (
    <aside className={`rk-ticket${ready ? " ready" : ""}`} aria-label="Your report as the city receives it">
      <span className="rk-t-orbit" aria-hidden />
      <div className="rk-t-body">
        <span className="rk-t-scan" aria-hidden />
        <header className="rk-t-head">
          <span className="rk-t-live"><i /> Live preview</span>
          <span className="rk-t-id">ISS-<em>····</em></span>
        </header>
        <div className="rk-t-hero">
          {draft.category ? <CatGlyph category={draft.category} size={40} /> : <span className="rk-t-blank"><FileText size={18} /></span>}
          <div>
            <p>{draft.category ? CATEGORY_LABEL[draft.category] : "Kind of problem"}</p>
            <h4>{draft.title.trim() || "Your report"}</h4>
          </div>
        </div>
        {draft.danger ? <p className="rk-t-danger"><Siren size={12} /> Someone could get hurt · goes in as High</p> : null}

        <div className="rk-t-rows">
          <PreviewRow label="Zone" icon={MapPinned} on={Boolean(draft.ward)}>{draft.ward}</PreviewRow>
          <PreviewRow label="Spot" icon={Radar} on={pinned}>{pinned ? `${draft.lat.toFixed(4)}, ${draft.lng.toFixed(4)}` : null}</PreviewRow>
          <PreviewRow label="Photo" icon={Camera} on={photos.length > 0}>{photos.length} attached</PreviewRow>
        </div>

        <p className="rk-t-sub">What the city does with it</p>
        <div className="rk-t-rows">
          <PreviewRow label="Crew line" icon={Zap} on={Boolean(draft.category)}>{route.lineLabel}</PreviewRow>
          <PreviewRow label="On duty" icon={Users} on={Boolean(draft.category && draft.ward)}>{route.crewInZone ? `${route.crewInZone} crew${route.crewInZone === 1 ? "" : "s"} in ${draft.ward}` : `${route.crewOnDuty} city-wide`}</PreviewRow>
          <PreviewRow label="Starts as" icon={AlertTriangle} on hot={draft.danger}>{PRIORITY_LABEL[route.priority]} priority</PreviewRow>
        </div>

        <div className={`rk-t-promise${draft.category ? " on" : ""}`}>
          <span><Hourglass size={13} /> City promise</span>
          <b>{draft.category ? `Fixed ${promiseOf({ slaHours: route.window })}` : "Pick the problem"}</b>
          <small>{draft.category ? `${span(route.window)} from the moment you send it` : "From the city's published service windows"}</small>
        </div>

        {similar && step !== "send" ? (
          <button type="button" className="rk-t-similar" onClick={onCheck}><FileSearch size={13} /> {similar} similar report{similar === 1 ? "" : "s"} nearby · check before sending</button>
        ) : null}

        <footer className="rk-t-foot">
          <div className="rk-t-meter" aria-hidden>{[0, 1, 2].map((i) => <i key={i} className={i < done ? "on" : ""} />)}</div>
          <span>{ready ? <><CheckCircle2 size={13} /> Ready to send</> : `${done} of 3 parts ready`}</span>
          <small><ShieldCheck size={11} /> Your name is never shown publicly</small>
        </footer>
      </div>
    </aside>
  );
}

/* After filing (or joining): the receipt and what happens next. */
function SentPanel({ sent, issue, route, onTrack, onAnother }) {
  const joined = sent.kind === "joined";
  return (
    <section className="rc-sent" role="status">
      <span className="rc-sent-ring" aria-hidden><i /><i /><CheckCircle2 size={34} /></span>
      <p className="rc-sent-kicker">{joined ? "Added to an existing report" : "Report received"}</p>
      <h2>{joined ? "You're on this report now" : "Thank you. The city has your report."}</h2>
      <div className="rc-sent-id">
        <span className="ac-id">{issue.id}</span>
        <b>{issue.title}</b>
      </div>
      <div className="rc-sent-facts">
        <div><em>City promise</em><b>Fixed {promiseOf(issue)}</b></div>
        <div><em>Crew line</em><b>{route.lineLabel}</b></div>
        <div><em>{joined ? "People affected" : "Starts as"}</em><b>{joined ? affected(issue) : `${PRIORITY_LABEL[issue.priority]} priority`}</b></div>
      </div>
      {sent.warning ? <p className="rc-sent-warn"><AlertTriangle size={14} /> {sent.warning}</p> : null}
      <ol className="rc-next">
        <li><b>1</b>Command reviews it and assigns a crew from the {route.lineLabel || "field"} line.</li>
        <li><b>2</b>You see each move as it happens: received, queued, being fixed, resolved.</li>
        <li><b>3</b>When it&apos;s fixed, the city confirms it before you see Resolved.</li>
      </ol>
      <div className="rc-sent-acts">
        <button type="button" className="ac-btn primary" onClick={onTrack}><Sparkles size={14} /> Track this report</button>
        <button type="button" className="ac-btn" onClick={onAnother}><Plus size={14} /> Report another issue</button>
      </div>
    </section>
  );
}

export default ReportIssue;
