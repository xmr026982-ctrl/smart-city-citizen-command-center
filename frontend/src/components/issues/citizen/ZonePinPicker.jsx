import { useMemo, useRef, useState } from "react";
import { LocateFixed, MapPin, Crosshair, ShieldCheck } from "lucide-react";
import { WARDS } from "../../../constants/issueConstants";
import { CATEGORY_LABEL } from "../../../constants/issueCategories";
import { distanceM, nearestZone } from "../../../services/citizenService";
import { rng } from "../../plate/geo";

/* ------------------------------------------------------------------
   Zone card. A 2 km × 1.3 km frame around the zone's centre, with its
   streets, the open reports already on the board (dots by status) and
   the citizen's pin.

   Two ways to use it:
   - on Report Issue it is the geocard: zone chips on top, the frame as a
     preview (editable={false}); clicking it opens the location door.
   - inside the location door it is the picker (editable): click drops
     the pin, arrow keys nudge it (Shift for bigger steps), Enter drops it
     in the centre.
   `lockKey` replays the lock-on animation when a pin arrives (from the
   door or back from the city map).
   useGpsPin: "Use my location", snapped to the nearest zone.
------------------------------------------------------------------- */

const W = 400; // frame units
const H = 260;
const SPAN_LNG = 0.01942; // ≈ 2 km at Kolkata's latitude
const SPAN_LAT = 0.0117; // ≈ 1.3 km
const REACH_M = 3000; // GPS further than this from every zone is "outside the service area"

export const frameOf = (ward) => {
  const c = WARDS.find((w) => w.name === ward);
  return c ? { c, west: c.lng - SPAN_LNG / 2, north: c.lat + SPAN_LAT / 2 } : null;
};
const toXY = (f, lat, lng) => ({ x: ((lng - f.west) / SPAN_LNG) * W, y: ((f.north - lat) / SPAN_LAT) * H });
const toLL = (f, x, y) => ({
  lat: +(f.north - (Math.min(H, Math.max(0, y)) / H) * SPAN_LAT).toFixed(6),
  lng: +(f.west + (Math.min(W, Math.max(0, x)) / W) * SPAN_LNG).toFixed(6),
});
const clampIn = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const fromCentre = (ward, lat, lng) => {
  const f = frameOf(ward);
  if (!f || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const m = Math.round(distanceM(f.c, { lat, lng }));
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`;
};

// a few seeded street lines per zone, so each frame reads like its own place
function streets(ward) {
  const r = rng([...ward].reduce((s, ch) => s + ch.charCodeAt(0), 7));
  const out = [];
  for (let i = 0; i < 5; i += 1) out.push({ x1: 0, y1: 26 + r() * (H - 52), x2: W, y2: 26 + r() * (H - 52), w: 2 + r() * 4 });
  for (let i = 0; i < 4; i += 1) out.push({ x1: 30 + r() * 340, y1: 0, x2: 30 + r() * 340, y2: H, w: 2 + r() * 4 });
  return out;
}

/* "Use my location": browser GPS, snapped to the nearest zone within reach */
export function useGpsPin({ onWard, onPin }) {
  const [gps, setGps] = useState({ state: "idle", text: "" });
  const locate = () => {
    if (!navigator.geolocation) { setGps({ state: "err", text: "This browser can't share its location. Pin the spot by hand." }); return; }
    setGps({ state: "busy", text: "Finding you…" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const near = nearestZone(here);
        if (!near || near.m > REACH_M) {
          setGps({ state: "err", text: near ? `You're ${(near.m / 1000).toFixed(1)} km from the nearest service zone. Pin the spot by hand.` : "No service zone is near you. Pin the spot by hand." });
          return;
        }
        onWard(near.ward.name);
        const nf = frameOf(near.ward.name);
        const p = toXY(nf, here.lat, here.lng);
        onPin({ ...toLL(nf, p.x, p.y), label: "Your location (GPS)" });
        const acc = Math.round(pos.coords.accuracy || 0);
        setGps({ state: "ok", text: `Pinned in ${near.ward.name}${acc ? ` · GPS accurate to about ${acc} m` : ""}. Move the pin if it's off.` });
      },
      (err) => setGps({ state: "err", text: err.code === 1 ? "Location permission was refused. Pin the spot by hand." : "Your location isn't available right now. Pin the spot by hand." }),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };
  return { gps, locate, reset: () => setGps({ state: "idle", text: "" }) };
}

/* the six zones as chips, each with how many reports are open there */
export function ZoneChips({ ward, onWard, openIssues = [] }) {
  const counts = useMemo(() => Object.fromEntries(WARDS.map((w) => [w.name, openIssues.filter((i) => i.ward === w.name).length])), [openIssues]);
  return (
    <div className="zp-zones" role="radiogroup" aria-label="Zone">
      {WARDS.map((w) => (
        <button key={w.name} type="button" role="radio" aria-checked={ward === w.name} className={ward === w.name ? "on" : ""} onClick={() => onWard(w.name)}>
          {w.name}
          <em title="Open reports in this zone">{counts[w.name] || 0}</em>
        </button>
      ))}
    </div>
  );
}

function ZonePinPicker({ ward, lat, lng, onWard, onPin, openIssues = [], error, chips = true, editable = true, onOpen, lockKey = 0 }) {
  const svgRef = useRef(null);
  const f = frameOf(ward);
  const has = Number.isFinite(lat) && Number.isFinite(lng);
  const raw = f && has ? toXY(f, lat, lng) : null;
  // a pin from the city map can sit a little outside the 2 km frame: keep it visible on the edge
  const pin = raw ? { x: clampIn(raw.x, 8, W - 8), y: clampIn(raw.y, 8, H - 8), edge: raw.x < 0 || raw.x > W || raw.y < 0 || raw.y > H } : null;
  const roads = useMemo(() => (ward ? streets(ward) : []), [ward]);
  const dots = useMemo(() => {
    if (!f) return [];
    return openIssues
      .filter((i) => i.ward === ward && Number.isFinite(i.lat) && Number.isFinite(i.lng))
      .map((i) => ({ i, ...toXY(f, i.lat, i.lng) }))
      .filter((d) => d.x >= 0 && d.x <= W && d.y >= 0 && d.y <= H);
  }, [f, ward, openIssues]);

  const drop = (e) => {
    if (!editable) { onOpen?.(); return; }
    if (!f || !svgRef.current) return;
    const r = svgRef.current.getBoundingClientRect();
    onPin(toLL(f, ((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H));
  };
  const keys = (e) => {
    if (!f) return;
    if (!editable) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen?.(); }
      return;
    }
    const step = e.shiftKey ? 30 : 10;
    const at = pin || { x: W / 2, y: H / 2 };
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) {
      e.preventDefault();
      onPin(toLL(f, at.x + moves[e.key][0], at.y + moves[e.key][1]));
    } else if (e.key === "Enter" && !pin) {
      e.preventDefault();
      onPin(toLL(f, W / 2, H / 2));
    }
  };

  const away = has ? fromCentre(ward, lat, lng) : null;
  const viewOnly = !editable && !onOpen;

  return (
    <div className="zp">
      {chips ? <ZoneChips ward={ward} onWard={onWard} openIssues={openIssues} /> : null}

      <div className={`zp-stage${f ? "" : " empty"}${error ? " bad" : ""}${editable ? " edit" : viewOnly ? " still" : " open"}`}>
        {f ? (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            role={editable ? "application" : viewOnly ? "img" : "button"}
            aria-label={editable ? `Map frame of ${ward}. Click to drop the pin, or use the arrow keys.` : viewOnly ? `${ward} zone card` : `${ward} zone card. Open the location door to pin the exact spot.`}
            tabIndex={viewOnly ? -1 : 0}
            onClick={viewOnly ? undefined : drop}
            onKeyDown={viewOnly ? undefined : keys}
          >
            <defs>
              <pattern id="zpGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" className="zp-gridline" />
              </pattern>
            </defs>
            <rect width={W} height={H} fill="url(#zpGrid)" />
            {roads.map((r, i) => <line key={i} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} className="zp-road" strokeWidth={r.w} />)}
            <circle cx={W / 2} cy={H / 2} r="46" className="zp-core" />
            <circle cx={W / 2} cy={H / 2} r="3" className="zp-core-dot" />
            <text x={W / 2} y={H / 2 + 60} className="zp-core-label" textAnchor="middle">{ward} centre</text>
            {dots.map((d) => (
              <g key={d.i.id} className={`zp-dot st-${d.i.status}`} transform={`translate(${d.x} ${d.y})`}>
                <circle r="9" className="halo" />
                <circle r="4.5" />
                <title>{`${d.i.id} · ${d.i.title} (${CATEGORY_LABEL[d.i.category] || d.i.category})`}</title>
              </g>
            ))}
            {pin ? (
              <g key={lockKey} className={`zp-pin${lockKey ? " lock" : ""}`} transform={`translate(${pin.x} ${pin.y})`}>
                {lockKey ? <><circle r="64" className="sweep" /><circle r="40" className="sweep b" /></> : null}
                <circle r="26" className="ring a" />
                <circle r="16" className="ring b" />
                <line x1="-38" y1="0" x2="-12" y2="0" /><line x1="12" y1="0" x2="38" y2="0" />
                <line x1="0" y1="-38" x2="0" y2="-12" /><line x1="0" y1="12" x2="0" y2="38" />
                <circle r="7" className="core" />
              </g>
            ) : null}
            <rect x="1" y="1" width={W - 2} height={H - 2} rx="14" className="zp-frame" />
          </svg>
        ) : (
          <div className="zp-empty">
            <MapPin size={20} />
            <strong>Pick a zone first</strong>
            <span>The zone card appears here, then you pin the exact spot.</span>
          </div>
        )}
        {f ? (
          <div className="zp-hud">
            {pin ? (
              editable ? (
                <span><LocateFixed size={12} /> {lat.toFixed(5)} N · {lng.toFixed(5)} E <b>· {away} from centre</b></span>
              ) : (
                <span className="lockd"><ShieldCheck size={12} /> Locked <b>· {away} from centre{pin.edge ? " · off this card" : ""}</b></span>
              )
            ) : (
              <span className="hint"><Crosshair size={12} /> {editable ? "Click the spot, or focus here and press Enter" : viewOnly ? "No spot pinned yet" : "Tap to pin the exact spot"}</span>
            )}
          </div>
        ) : null}
      </div>
      {f ? (
        <div className="zp-legend" aria-hidden>
          <span><i className="st-submitted" /> New</span>
          <span><i className="st-acknowledged" /> Queued</span>
          <span><i className="st-in_progress" /> Being fixed</span>
          <span><i className="pin" /> Your pin</span>
        </div>
      ) : null}
    </div>
  );
}

export default ZonePinPicker;