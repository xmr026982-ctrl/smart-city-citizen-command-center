import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Marker, Polyline, Rectangle, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import { Navigation, ArrowUpRight, X, Route as RouteIcon, Users, MapPinned } from "lucide-react";
import { useIssues } from "../../../store/issueStore";
import { useAuth } from "../../../store/authStore";
import { setActiveZone } from "../../../store/zoneStore";
import { ZONES } from "../../../config/zones";
import { CATEGORY_LABEL } from "../../../constants/issueCategories";
import { slaOf, urgencyCompare, span } from "../../../utils/sla";
import { fileLink } from "../../../utils/fileLink";
import { meToo, isReporter, isSupporter } from "../../../services/citizenService";
import { useFieldRoster } from "../../../store/fieldRoster";
import ZONE_BOUNDARIES from "../zoneBoundaries";
import { useCommunity, announcementLive, residentsOf } from "../../../store/communityStore";
import { WARDS } from "../../../constants/issueConstants";

/* ------------------------------------------------------------------
   Map extras (added on top of Person 3's map, see INTEGRATION.md):
   PickNearby  citizen pinning a report: "already reported nearby"
   TodayRoute  field crew: their open work as one ordered route
   ZoneBreach  admin: the 6 issue zones shaded by breaches, clickable
   Cards sit bottom left (beside the tool dock), one per role.
------------------------------------------------------------------- */
const metres = (a, b) => {
  const R = 6371000;
  const r = (x) => (x * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
const ago = (iso) => {
  const h = (Date.now() - new Date(iso)) / 36e5;
  return h < 1 ? "under an hour ago" : h < 24 ? `${Math.round(h)}h ago` : `${Math.round(h / 24)}d ago`;
};
const Portal = ({ children }) => {
  const map = useMap();
  return createPortal(children, map.getContainer());
};

/* ---------------- citizen: already reported nearby ---------------- */
const NEARBY_M = 200;
export function PickNearby({ spot, category }) {
  const issues = useIssues();
  const me = useAuth();
  const navigate = useNavigate();
  const [hidden, setHidden] = useState("");
  const near = useMemo(() => {
    if (!spot) return [];
    return issues
      .filter((i) => i.status !== "resolved" && Number.isFinite(i.lat) && (!category || i.category === category))
      .map((i) => ({ i, m: Math.round(metres({ lat: spot.latitude, lng: spot.longitude }, i)) }))
      .filter((x) => x.m <= NEARBY_M)
      .sort((a, b) => a.m - b.m);
  }, [issues, spot, category]);
  const top = near[0];
  if (!top || hidden === `${top.i.id}@${spot.latitude}`) return null;
  const mine = isReporter(top.i, me);
  const joined = isSupporter(top.i, me);
  const join = () => {
    meToo(top.i.id, me);
    navigate("/citizen/saved");
  };
  return (
    <Portal>
      <aside className="mx-card warn" role="status">
        <header>
          <span className="mx-ic"><Users size={15} /></span>
          <div>
            <p className="mx-kick">Already reported nearby</p>
            <h4>{top.i.title}</h4>
          </div>
          <button type="button" className="mx-x" onClick={() => setHidden(`${top.i.id}@${spot.latitude}`)} aria-label="Dismiss"><X size={14} /></button>
        </header>
        <p className="mx-line"><span className="ac-id">{top.i.id}</span> · {top.m} m from your pin · {CATEGORY_LABEL[top.i.category]} · reported {ago(top.i.createdAt)}</p>
        {mine ? (
          <p className="mx-note">You reported this one already. It&apos;s in My Reports.</p>
        ) : joined ? (
          <p className="mx-note">You already said it affects you. You follow it in Saved.</p>
        ) : (
          <div className="mx-acts">
            <button type="button" className="mx-btn go" onClick={join}>Same problem · it affects me too</button>
            <button type="button" className="mx-btn ghost" onClick={() => setHidden(`${top.i.id}@${spot.latitude}`)}>Different problem</button>
          </div>
        )}
      </aside>
    </Portal>
  );
}

/* ---------------- field: today's route ---------------- */
function stopIcon(n, next) {
  return L.divIcon({ className: "ip-wrap", html: `<span class="mx-stop${next ? " next" : ""}">${n}</span>`, iconSize: [22, 22], iconAnchor: [-6, 30] });
}
/* order: breached first (most overdue first), then the nearest next stop each time */
export function orderStops(list, start) {
  const late = list.filter((i) => slaOf(i).state === "over").sort(urgencyCompare);
  const rest = list.filter((i) => slaOf(i).state !== "over");
  const out = [...late];
  let at = out.length ? out[out.length - 1] : start || [...rest].sort(urgencyCompare)[0];
  while (rest.length) {
    rest.sort((a, b) => metres(at, a) - metres(at, b));
    at = rest.shift();
    out.push(at);
  }
  return out;
}
export function TodayRoute({ userLocation, onRoute, hidden }) {
  const issues = useIssues();
  const me = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);
  const stops = useMemo(() => {
    const mine = issues.filter((i) => i.assignedTo === me?.name && i.status !== "resolved" && i.status !== "pending_review" && Number.isFinite(i.lat));
    const start = userLocation ? { lat: userLocation[0], lng: userLocation[1] } : null;
    return orderStops(mine, start);
  }, [issues, me?.name, userLocation]);
  if (!stops.length) return null;
  const km = stops.reduce((s, x, k) => (k ? s + metres(stops[k - 1], x) : s), 0) / 1000;
  const next = stops[0];
  const sla = slaOf(next);
  return (
    <>
      {stops.length > 1 ? <Polyline positions={stops.map((s) => [s.lat, s.lng])} pathOptions={{ color: "var(--cm, #0d9488)", weight: 3, dashArray: "2 9", lineCap: "round", interactive: false, className: "mx-path" }} /> : null}
      {stops.map((s, k) => <Marker key={`stop-${s.id}`} position={[s.lat, s.lng]} icon={stopIcon(k + 1, k === 0)} interactive={false} zIndexOffset={1200} />)}
      {hidden ? null : open ? (
        <Portal>
          <aside className="mx-card">
            <header>
              <span className="mx-ic"><RouteIcon size={15} /></span>
              <div>
                <p className="mx-kick">Today&apos;s route · {stops.length} stop{stops.length === 1 ? "" : "s"} · {km.toFixed(1)} km</p>
                <h4>Next: {next.title}</h4>
              </div>
              <button type="button" className="mx-x" onClick={() => setOpen(false)} aria-label="Hide today's route"><X size={14} /></button>
            </header>
            <p className={`mx-line ${sla.state}`}><span className="ac-id">{next.id}</span> · {next.ward} · {sla.state === "over" ? `${span(-sla.left)} over its window` : `${span(sla.left)} left`}</p>
            <div className="mx-acts">
              <button type="button" className="mx-btn ghost" onClick={() => onRoute({ latitude: next.lat, longitude: next.lng, name: next.title })}><Navigation size={13} /> Route to next stop</button>
              <button type="button" className="mx-btn go" onClick={() => navigate(fileLink("staff", next.id, "/map"))}>Open file <ArrowUpRight size={13} /></button>
            </div>
            <p className="mx-foot">Overdue work first, then the nearest stop each time.</p>
          </aside>
        </Portal>
      ) : (
        <Portal>
          <button type="button" className="mx-chip" onClick={() => setOpen(true)}><RouteIcon size={13} /> Today&apos;s route · {stops.length}</button>
        </Portal>
      )}
    </>
  );
}

/* ---------------- admin: zone breach overlay ---------------- */
export function ZoneBreach() {
  const issues = useIssues();
  const { roster } = useFieldRoster();
  const navigate = useNavigate();
  const map = useMap();
  const [pick, setPick] = useState(null);
  const zones = useMemo(() => Object.entries(ZONE_BOUNDARIES).map(([name, rect]) => {
    const open = issues.filter((i) => i.ward === name && i.status !== "resolved");
    const over = open.filter((i) => slaOf(i).state === "over").length;
    const crew = roster.filter((p) => p.zone === name && p.onDuty).length;
    return { name, rect, open: open.length, over, crew };
  }), [issues, roster]);
  const max = Math.max(1, ...zones.map((z) => z.over));
  const chosen = zones.find((z) => z.name === pick);
  const choose = (z) => {
    setPick(z.name);
    const known = ZONES.find((x) => x.name === z.name);
    if (known) setActiveZone(known.id); // the top bar follows, the map glides there
    else map.flyTo([(z.rect[0][0] + z.rect[1][0]) / 2, (z.rect[0][1] + z.rect[1][1]) / 2], Math.max(map.getZoom(), 14), { duration: 0.9 });
  };
  return (
    <>
      {zones.map((z) => (
        <Rectangle
          key={z.name}
          bounds={z.rect}
          eventHandlers={{ click: () => choose(z) }}
          pathOptions={{
            color: z.over ? "#ef4444" : "var(--cm, #7c3aed)", weight: z.name === pick ? 2.5 : 1.2, opacity: z.over ? 0.75 : 0.45, dashArray: z.over ? "" : "5 6",
            fillColor: z.over ? "#ef4444" : "var(--cm, #7c3aed)", fillOpacity: z.over ? 0.05 + (z.over / max) * 0.13 : 0.03, className: "mx-zone",
          }}
        >
          <Tooltip direction="center" className="mx-zone-tip" sticky>{z.name} · {z.open} open{z.over ? ` · ${z.over} breached` : ""}</Tooltip>
        </Rectangle>
      ))}
      {chosen ? (
        <Portal>
          <aside className="mx-card">
            <header>
              <span className="mx-ic"><MapPinned size={15} /></span>
              <div>
                <p className="mx-kick">Zone</p>
                <h4>{chosen.name}</h4>
              </div>
              <button type="button" className="mx-x" onClick={() => setPick(null)} aria-label="Close"><X size={14} /></button>
            </header>
            <div className="mx-stats">
              <div><b>{chosen.open}</b><span>open</span></div>
              <div className={chosen.over ? "hot" : ""}><b>{chosen.over}</b><span>breached</span></div>
              <div><b>{chosen.crew}</b><span>crew on duty</span></div>
            </div>
            <div className="mx-acts">
              <button type="button" className="mx-btn go" onClick={() => navigate("/admin/command", { state: { zone: chosen.name } })}>Open in Issue Command <ArrowUpRight size={13} /></button>
            </div>
          </aside>
        </Portal>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------
   Community on the map (every role): proposals under review sit at
   their zone as violet-edged diamonds (size follows resident backing),
   and a zone with a live announcement shows a megaphone badge. Click
   one to open it on the Community board. Proposals carry a zone, not a
   point, so they fan out around the zone centre.
------------------------------------------------------------------- */
function diamond(n, target) {
  const k = Math.min(1, n / Math.max(1, target));
  const size = Math.round(20 + k * 10);
  return L.divIcon({ className: "ip-wrap", html: `<span class="mx-prop${n >= target ? " met" : ""}" style="--k:${k}"><i></i></span>`, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
}
const megaphone = (n) => L.divIcon({ className: "ip-wrap", html: `<span class="mx-ann"><b>${n}</b></span>`, iconSize: [30, 30], iconAnchor: [15, 15] });

export function CommunityMarkers({ zones = null }) {
  const c = useCommunity();
  const navigate = useNavigate();
  const centre = (ward) => WARDS.find((w) => w.name === ward);
  const props = c.proposals.filter((p) => p.status === "review" && (!zones || zones.has(p.ward)));
  const byZone = new Map();
  props.forEach((p) => byZone.set(p.ward, [...(byZone.get(p.ward) || []), p]));
  const anns = new Map();
  c.announcements.filter(announcementLive).forEach((a) => {
    (a.zones.includes("all") ? WARDS.map((w) => w.name) : a.zones).forEach((z) => { if (!zones || zones.has(z)) anns.set(z, [...(anns.get(z) || []), a]); });
  });
  return (
    <>
      {[...byZone.entries()].flatMap(([ward, list]) => {
        const w = centre(ward);
        if (!w) return [];
        return list.map((p, k) => {
          const ang = (k / list.length) * Math.PI * 2 + 0.6;
          const pos = [w.lat + Math.sin(ang) * 0.0042, w.lng + Math.cos(ang) * 0.0048];
          const r = residentsOf(p);
          return (
            <Marker key={p.id} position={pos} icon={diamond(r, p.target)} zIndexOffset={150} eventHandlers={{ click: () => navigate("/community", { state: { open: p.id } }) }}>
              <Tooltip direction="top" offset={[0, -12]} className="ip-tip"><b>{p.id}</b> {p.title} · {r}/{p.target} residents</Tooltip>
            </Marker>
          );
        });
      })}
      {[...anns.entries()].map(([ward, list]) => {
        const w = centre(ward);
        if (!w) return null;
        return (
          <Marker key={`ann-${ward}`} position={[w.lat + 0.0062, w.lng - 0.0062]} icon={megaphone(list.length)} zIndexOffset={160} eventHandlers={{ click: () => navigate("/community", { state: { focus: list[0].id } }) }}>
            <Tooltip direction="top" offset={[0, -14]} className="ip-tip"><b>{ward}</b> {list[0].title}{list.length > 1 ? ` · +${list.length - 1} more` : ""}</Tooltip>
          </Marker>
        );
      })}
    </>
  );
}