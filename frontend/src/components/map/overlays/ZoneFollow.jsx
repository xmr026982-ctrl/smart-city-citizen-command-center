import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMap, Polygon, Rectangle, CircleMarker, Tooltip } from "react-leaflet";
import { CornerUpLeft } from "lucide-react";
import { useActiveZone, setActiveZone, getActiveZoneId } from "../../../store/zoneStore";
import { ZONES } from "../../../config/zones";
import ZONE_BOUNDARIES from "../zoneBoundaries";

/* ------------------------------------------------------------------
   Top bar zone ↔ map (added on top of Person 3's map, see INTEGRATION.md).

   Where the map starts is decided BEFORE it is drawn (startView), so it
   opens in place with no movement. After that:
   - picking another zone in the top bar glides the map there
   - panning or zooming never changes the zone, only a deliberate pick does
   - a held target wins (an issue / coordinates / a citizen pinning a
     report): the map stays on it and the top bar takes that zone
   - "Back to …" appears once the zone or the target is off-screen
   Safe under React StrictMode: no first-run flags, only "is the map
   already aligned to this zone".

   ZoneFocus draws the zone: in pick mode the report's zone is outlined
   and everything outside it is dimmed; otherwise the picked zone gets a
   thin outline (the 6 issue zones have one) and a beacon at its centre.
------------------------------------------------------------------- */
export const ZONE_ZOOM = 14;
const OUTER = [[22.2, 87.9], [22.2, 88.9], [22.95, 88.9], [22.95, 87.9]];

const zoneByName = (name) => ZONES.find((z) => z.name === name) || null;
const rectOf = (name) => ZONE_BOUNDARIES[name] || null;
const centreOf = (name) => {
  const r = rectOf(name);
  if (r) return [(r[0][0] + r[1][0]) / 2, (r[0][1] + r[1][1]) / 2];
  const z = zoneByName(name);
  return z ? [z.lat, z.lng] : null;
};

/* the first view, computed before <MapContainer> mounts */
export function startView({ pickZone, pickCenter, lat, lng, fallback }) {
  // the same centre / zoom Person 3's pick and issue controllers set, so their first setView doesn't move anything
  if (pickZone) return { center: pickCenter || centreOf(pickZone) || fallback, zoom: ZONE_ZOOM };
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { center: [lat, lng], zoom: 15 };
  const z = ZONES.find((x) => x.id === getActiveZoneId());
  return z ? { center: [z.lat, z.lng], zoom: ZONE_ZOOM } : { center: fallback, zoom: 12 };
}

export default function ZoneFollow({ hold = null, holdZone = "", pick = false }) {
  const map = useMap();
  const zoneId = useActiveZone();
  const zone = ZONES.find((z) => z.id === zoneId);
  const held = holdZone ? zoneByName(holdZone) : null;
  const aligned = useRef(held ? held.id : zoneId); // the zone the map is already showing
  const [away, setAway] = useState(false);

  // a held target names its zone in the top bar (the map is already there)
  useEffect(() => { if (held) { aligned.current = held.id; setActiveZone(held.id); } }, [held?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // a deliberate pick of another zone → glide there
  useEffect(() => {
    if (!zone || pick || zone.id === aligned.current) return;
    aligned.current = zone.id;
    map.flyTo(centreOf(zone.name) || [zone.lat, zone.lng], Math.max(map.getZoom(), ZONE_ZOOM), { duration: 0.9 });
  }, [zoneId]); // eslint-disable-line react-hooks/exhaustive-deps

  // "Back to …"
  const home = hold || (zone ? centreOf(zone.name) || [zone.lat, zone.lng] : null);
  const label = holdZone || zone?.name || "the target";
  useEffect(() => {
    if (!home) return undefined;
    const check = () => setAway(!map.getBounds().pad(-0.2).contains(home));
    check();
    map.on("moveend", check);
    return () => map.off("moveend", check);
  }, [map, home?.[0], home?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <ZoneFocus name={pick ? holdZone : zone?.name} pick={pick} />
      {away && home ? createPortal(
        <button type="button" className="cm-back" onClick={() => map.flyTo(home, Math.max(map.getZoom(), ZONE_ZOOM), { duration: 0.8 })}>
          <CornerUpLeft size={13} /> Back to {label}
        </button>,
        map.getContainer()
      ) : null}
    </>
  );
}

function ZoneFocus({ name, pick }) {
  if (!name) return null;
  const rect = rectOf(name);
  const c = centreOf(name);
  if (pick && rect) {
    const [[s, w], [n, e]] = rect;
    return (
      <>
        {/* the rest of the city dimmed: a sheet with the zone cut out of it */}
        <Polygon positions={[OUTER, [[s, w], [n, w], [n, e], [s, e]]]} pathOptions={{ stroke: false, fillColor: "#0f172a", fillOpacity: 0.22, interactive: false, className: "cm-dim" }} />
        <Rectangle bounds={rect} pathOptions={{ color: "var(--cm, #0ea5e9)", weight: 2.5, dashArray: "10 7", fill: false, interactive: false, className: "cm-zone-line" }}>
          <Tooltip permanent direction="top" offset={[0, -6]} className="cm-zone-tip">{name} · your report&apos;s zone · tap the exact spot</Tooltip>
        </Rectangle>
      </>
    );
  }
  return (
    <>
      {rect ? <Rectangle bounds={rect} pathOptions={{ color: "var(--cm, #0ea5e9)", weight: 1.6, dashArray: "6 6", fillColor: "var(--cm, #0ea5e9)", fillOpacity: 0.05, interactive: false, className: "cm-zone-line soft" }} /> : null}
      {c ? (
        <>
          <CircleMarker center={c} radius={18} pathOptions={{ color: "var(--cm, #0ea5e9)", weight: 1.5, fillOpacity: 0, interactive: false, className: "cm-beacon-ring" }} />
          <CircleMarker center={c} radius={6} pathOptions={{ color: "#fff", weight: 2.5, fillColor: "var(--cm, #0ea5e9)", fillOpacity: 1, interactive: false, className: "cm-beacon" }}>
            <Tooltip permanent direction="right" offset={[10, 0]} className="cm-zone-tip">{name}{rect ? "" : " · outside coverage"}</Tooltip>
          </CircleMarker>
        </>
      ) : null}
    </>
  );
}