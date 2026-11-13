import { useEffect, useMemo, useState } from "react";
import { Check, Crosshair, LocateFixed, MapPin } from "lucide-react";
import { api } from "../../lib/api";
import { SERVER_ON } from "../../config/server";
import { ZONES as ZONE_NAMES } from "../../services/authService";
import { ZONES as CITY_PLACES } from "../../config/zones";

/* Zone lock: the one step a new Google citizen sees (sign-in and sign-up).
   Google has confirmed the account; the citizen locks a home zone on a live
   map of the six citizen zones and engages.
   - Positions come from the zones' real coordinates (config/zones.js),
     spread to fill the plate.
   - Location is used only if the site already has permission; otherwise
     "Locate me" asks first. Outside the six zones nothing is pre-locked.
   - Open-report counts come from GET /public/board (byZone).
   - The log lines are the real steps: shown while the server saves the zone. */

const W = 400, H = 232, PAD_L = 112, PAD_R = 62, PAD_T = 30, PAD_B = 26;
const LABEL = { // where each name sits: clear of the reticle's arms (24 px) and of its neighbours
  "B.B.D. Bagh": { dx: -27, dy: 4, a: "end" },
  Dharmatala: { dx: -27, dy: 16, a: "end" },
  "College Street": { dx: 27, dy: 4, a: "start" },
  Shyambazar: { dx: 27, dy: 4, a: "start" },
  Ballygunge: { dx: 27, dy: 4, a: "start" },
  "B.P. Township": { dx: 0, dy: -28, a: "middle" },
};
const NEAR_KM = 6; // further than this from every zone = outside coverage

const PLACES = ZONE_NAMES.map((name) => {
  const p = CITY_PLACES.find((z) => z.name === name);
  return { name, lat: p?.lat ?? 22.57, lng: p?.lng ?? 88.36 };
});
const B = PLACES.reduce((b, p) => ({ minLat: Math.min(b.minLat, p.lat), maxLat: Math.max(b.maxLat, p.lat), minLng: Math.min(b.minLng, p.lng), maxLng: Math.max(b.maxLng, p.lng) }),
  { minLat: 90, maxLat: -90, minLng: 180, maxLng: -180 });
const project = (lat, lng) => {
  const x = PAD_L + ((lng - B.minLng) / (B.maxLng - B.minLng || 1)) * (W - PAD_L - PAD_R);
  const y = PAD_T + ((B.maxLat - lat) / (B.maxLat - B.minLat || 1)) * (H - PAD_T - PAD_B);
  return [Math.round(Math.min(W - 8, Math.max(8, x))), Math.round(Math.min(H - 8, Math.max(8, y)))];
};
const POS = Object.fromEntries(PLACES.map((p) => [p.name, project(p.lat, p.lng)]));

function km(a, b) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const fmtKm = (d) => (d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1)} km`);

export default function ZoneLock({ email, busy, onEngage }) {
  const [zone, setZone] = useState("");
  const [why, setWhy] = useState(""); // nearest | choice
  const [me, setMe] = useState(null); // { lat, lng }
  const [locating, setLocating] = useState(false);
  const [geoNote, setGeoNote] = useState("");
  const [counts, setCounts] = useState(null);
  const [checks, setChecks] = useState(0);

  // the account is already confirmed by now: the three checks light in turn
  useEffect(() => {
    const t = [1, 2, 3].map((n) => setTimeout(() => setChecks(n), 140 * n));
    return () => t.forEach(clearTimeout);
  }, []);

  // open reports per zone (public, no sign-in needed)
  useEffect(() => {
    if (!SERVER_ON) return undefined;
    let live = true;
    api.get("/public/board").then(({ data }) => { if (live && data?.byZone) setCounts(data.byZone); }).catch(() => {});
    return () => { live = false; };
  }, []);

  const distances = useMemo(() => (me ? Object.fromEntries(PLACES.map((p) => [p.name, km(me, p)])) : null), [me]);

  const place = (pos) => {
    const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    setMe(here);
    const near = PLACES.map((p) => ({ name: p.name, d: km(here, p) })).sort((a, b) => a.d - b.d)[0];
    if (near && near.d <= NEAR_KM) {
      setZone((cur) => cur || near.name);
      setWhy((cur) => cur || "nearest");
      setGeoNote("");
    } else setGeoNote("You're outside the six zones. Pick the one you report in most.");
  };
  const locate = () => {
    if (!navigator.geolocation) { setGeoNote("This browser can't share a location. Pick your zone."); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLocating(false); place(pos); },
      () => { setLocating(false); setGeoNote("Location wasn't shared. Pick your zone."); },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  };

  // only locate on its own when the site already has permission (no surprise prompt)
  useEffect(() => {
    let live = true;
    navigator.permissions?.query({ name: "geolocation" }).then((st) => {
      if (live && st.state === "granted") locate();
    }).catch(() => {});
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const choose = (name) => { if (busy) return; setZone(name); setWhy("choice"); };
  const onKey = (e, i) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(PLACES[i].name); }
    if (["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(e.key)) {
      e.preventDefault();
      const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
      const next = PLACES[(i + step + PLACES.length) % PLACES.length].name;
      choose(next);
      e.currentTarget.parentNode.querySelector(`[data-z="${CSS.escape(next)}"]`)?.focus();
    }
  };

  const target = zone ? POS[zone] : null;
  const you = me ? project(me.lat, me.lng) : null;
  const initials = (email || "?").split("@")[0].replace(/[^a-z0-9]/gi, " ").trim().split(/\s+/).slice(0, 2).map((s) => s[0]).join("").toUpperCase() || "?";
  const count = zone && counts ? counts[zone] : null;

  return (
    <div className={`zl${busy ? " engaging" : ""}`}>
      <div className="zl-who">
        <span className="zl-av" aria-hidden>{initials}</span>
        <span className="zl-id"><b>{email || "Google account"}</b><small>Google account</small></span>
        <span className="zl-checks" aria-label="Google verified, email confirmed, citizen desk">
          {["Verified", "Email", "Citizen"].map((t, i) => (
            <em key={t} className={checks > i ? "on" : ""}><Check size={11} /> {t}</em>
          ))}
        </span>
      </div>

      <div className="zl-head">
        <span>Zone lock</span>
        <em>{zone ? (why === "nearest" ? "Nearest · from your location" : "Your choice") : "Tap a zone"}</em>
      </div>

      <div className="zl-plate">
        <svg viewBox={`0 0 ${W} ${H}`} className="zl-map" role="radiogroup" aria-label="Your home zone">
          <g className="zl-grid" aria-hidden>
            {[1, 2, 3].map((n) => <line key={`h${n}`} x1="0" x2={W} y1={(H / 4) * n} y2={(H / 4) * n} />)}
            {[1, 2, 3].map((n) => <line key={`v${n}`} y1="0" y2={H} x1={(W / 4) * n} x2={(W / 4) * n} />)}
          </g>
          <path className="zl-river" aria-hidden d={`M${PAD_L - 52} 0 C ${PAD_L - 22} 58, ${PAD_L - 64} 112, ${PAD_L - 30} 156 S ${PAD_L - 12} 212, ${PAD_L - 26} ${H}`} />
          {you && target ? <line className="zl-beam" aria-hidden x1={you[0]} y1={you[1]} x2={target[0]} y2={target[1]} /> : null}
          {you ? (
            <g className="zl-you" transform={`translate(${you[0]} ${you[1]})`} aria-hidden>
              <circle className="ping" r="6" /><circle r="4" />
            </g>
          ) : null}
          {PLACES.map((p, i) => {
            const [x, y] = POS[p.name];
            const on = zone === p.name;
            const l = LABEL[p.name] || { dx: 27, dy: 4, a: "start" };
            return (
              <g key={p.name} data-z={p.name} className={`zl-node${on ? " on" : ""}`} transform={`translate(${x} ${y})`}
                role="radio" aria-checked={on} aria-label={p.name} tabIndex={on || (!zone && i === 0) ? 0 : -1}
                onClick={() => choose(p.name)} onKeyDown={(e) => onKey(e, i)}>
                <circle className="hit" r="16" />
                <circle className="dot" r={on ? 6 : 4.5} />
                <text x={l.dx} y={l.dy} textAnchor={l.a}>{p.name}</text>
              </g>
            );
          })}
          {target ? (
            <g className="zl-ret" style={{ transform: `translate(${target[0]}px, ${target[1]}px)` }} aria-hidden>
              <g className="spin"><circle r="16" /></g>
              <path d="M-24 0h8M16 0h8M0-24v8M0 16v8" />
            </g>
          ) : null}
        </svg>
        <i className="zl-scan" aria-hidden />
        <button type="button" className="zl-locate" onClick={locate} disabled={locating || busy}>
          <LocateFixed size={13} /> {locating ? "Locating" : me ? "Locate again" : "Locate me"}
        </button>
      </div>

      <div className={`zl-read${zone ? " locked" : ""}`} aria-live="polite">
        <Crosshair size={17} aria-hidden />
        <span>
          <b>{zone || "No zone locked"}</b>
          <small>
            {zone
              ? [distances ? `${fmtKm(distances[zone])} away` : null, Number.isFinite(count) ? `${count} open report${count === 1 ? "" : "s"}` : null].filter(Boolean).join(" · ") || "Home zone"
              : geoNote || "Tap a zone on the map, or let it locate you"}
          </small>
        </span>
        {zone ? <em>LOCKED</em> : null}
      </div>
      {zone && geoNote ? <p className="zl-note"><MapPin size={12} /> {geoNote}</p> : null}

      <button type="button" className="pk-btn zl-go" disabled={!zone || busy} onClick={() => onEngage(zone)}>
        {busy ? "Saving your zone" : zone ? `Enter Smart Kolkata · ${zone}` : "Lock a zone to continue"}
      </button>
      <p className="zl-log" aria-live="polite">{busy ? `› Home zone · ${zone} · saving with the server` : " "}</p>
      <p className="zl-fine">You can change your zone anytime in Settings.</p>
    </div>
  );
}
