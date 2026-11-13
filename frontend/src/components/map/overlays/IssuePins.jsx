import { useMemo, useState } from "react";
import { Marker, Tooltip, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { useIssues } from "../../../store/issueStore";
import { useAuth } from "../../../store/authStore";
import { slaOf } from "../../../utils/sla";
import { useInbox } from "../../../store/notifyStore";

/* ------------------------------------------------------------------
   Issue pins (added on top of Person 3's map, see INTEGRATION.md).
   Read straight from the issue board, so they move the moment the board
   does. Each role sees what it may:
     admin   every issue
     staff   their own files
     citizen their own reports (with a progress ring), plus open public
             issues as small quiet dots (no details)
   Clarity rules:
   - one colour per status, the same everywhere in the app
   - white outline + soft shadow, readable on streets and on satellite
   - the selected pin grows; the others dim
   - zoomed out, nearby pins merge into a count bubble (tap to zoom in)
   - the title shows on hover only, on a solid chip
------------------------------------------------------------------- */
const STAGE = { submitted: 0, acknowledged: 1, in_progress: 2, pending_review: 2.5, resolved: 3 };
const LABEL = { submitted: "New", acknowledged: "Queued", in_progress: "Being fixed", pending_review: "Being fixed", resolved: "Resolved" };
const CLUSTER_BELOW = 14; // zoom levels under this merge nearby pins
const CLUSTER_PX = 46;

function pinIcon({ status, breached, selected, dim, own, quiet, fresh }) {
  const cls = ["ip", `s-${status}`, breached && "br", selected && "sel", dim && "dim", own && "own", quiet && "quiet", fresh && "fresh"].filter(Boolean).join(" ");
  const ring = own ? `style="--p:${Math.round(((STAGE[status] || 0) / 3) * 100)}"` : "";
  const size = selected ? 46 : quiet ? 14 : 28;
  return L.divIcon({
    className: "ip-wrap",
    html: `<span class="${cls}" ${ring}><i></i>${selected ? "<b></b>" : ""}${fresh ? "<u></u>" : ""}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function bubbleIcon(n, hot) {
  const size = n > 9 ? 40 : 34;
  return L.divIcon({ className: "ip-wrap", html: `<span class="ip-bubble${hot ? " hot" : ""}">${n}</span>`, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
}

export default function IssuePins({ role, selectedId, onSelect, keep = () => true }) {
  const issues = useIssues();
  const me = useAuth();
  const { unreadIssues } = useInbox(); // pins with an unread update pulse in the role colour
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  const [, setMoved] = useState(0);
  useMapEvents({ zoomend: () => setZoom(map.getZoom()), moveend: () => setMoved((n) => n + 1) });

  const pins = useMemo(() => {
    const list = issues.filter((i) => Number.isFinite(i.lat) && Number.isFinite(i.lng));
    if (role === "admin") return list.filter(keep).map((i) => ({ i, own: false, quiet: false }));
    if (role === "staff") return list.filter((i) => i.assignedTo === me?.name).filter(keep).map((i) => ({ i, own: false, quiet: false }));
    // citizen: own reports (any stage) + open public issues as quiet dots
    return list
      .filter((i) => i.reporterId === me?.id || i.status !== "resolved")
      .map((i) => ({ i, own: i.reporterId === me?.id, quiet: i.reporterId !== me?.id }));
  }, [issues, role, me?.name, me?.id, keep]);

  // merge nearby pins when zoomed out (the selected pin never merges)
  const groups = useMemo(() => {
    if (zoom >= CLUSTER_BELOW) return pins.map((p) => ({ one: p }));
    const cells = new Map();
    pins.forEach((p) => {
      if (p.i.id === selectedId) { cells.set(`sel-${p.i.id}`, [p]); return; }
      const pt = map.project([p.i.lat, p.i.lng], zoom);
      const key = `${Math.floor(pt.x / CLUSTER_PX)}:${Math.floor(pt.y / CLUSTER_PX)}`;
      cells.set(key, [...(cells.get(key) || []), p]);
    });
    return [...cells.values()].map((g) => (g.length === 1 ? { one: g[0] } : { many: g }));
  }, [pins, zoom, selectedId, map]);

  return groups.map((g) => {
    if (g.many) {
      const lat = g.many.reduce((s, p) => s + p.i.lat, 0) / g.many.length;
      const lng = g.many.reduce((s, p) => s + p.i.lng, 0) / g.many.length;
      const hot = g.many.some((p) => !p.quiet && slaOf(p.i).state === "over");
      return (
        <Marker
          key={`c-${g.many.map((p) => p.i.id).join("-")}`}
          position={[lat, lng]}
          icon={bubbleIcon(g.many.length, hot)}
          eventHandlers={{ click: () => map.flyTo([lat, lng], Math.min(map.getZoom() + 2, 17), { duration: 0.6 }) }}
        />
      );
    }
    const { i, own, quiet } = g.one;
    const selected = i.id === selectedId;
    const breached = !quiet && slaOf(i).state === "over";
    return (
      <Marker
        key={i.id}
        position={[i.lat, i.lng]}
        icon={pinIcon({ status: i.status, breached, selected, dim: Boolean(selectedId) && !selected, own, quiet, fresh: !quiet && unreadIssues.has(i.id) })}
        zIndexOffset={selected ? 1000 : breached ? 200 : own ? 100 : 0}
        eventHandlers={{ click: () => onSelect(i) }}
      >
        {!selected ? (
          <Tooltip direction="top" offset={[0, quiet ? -6 : -14]} className="ip-tip">
            {quiet ? <>{LABEL[i.status]} · {i.ward}</> : <><b>{i.id}</b> {i.title}</>}
          </Tooltip>
        ) : null}
      </Marker>
    );
  });
}