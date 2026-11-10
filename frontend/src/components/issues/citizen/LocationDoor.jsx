import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MapPinned, X, Radar, LocateFixed, Crosshair, ArrowUpRight, Check } from "lucide-react";
import ZonePinPicker, { useGpsPin, fromCentre } from "./ZonePinPicker";
import { CITY_MAP } from "../../../config/cityMap";
import "../../../styles/gate-door.css";

/* ------------------------------------------------------------------
   Location door: slides in when the citizen opens "Exact spot" after
   picking a zone.

   With the city map installed (config/cityMap.js) the door shows the
   zone card and one main action, "Open <zone> on the city map": the map
   opens in pick mode inside that zone, the citizen pins and confirms,
   and the map sends them back to Report Issue with the pin, its place
   name and coordinates. Text and photos survive the trip.

   Until then, the zone card in the door is the picker itself: tap the
   spot, nudge it, "Lock this spot". Same door, same flow.
   "Use my location" works in both.
------------------------------------------------------------------- */

function LocationDoor({ open, ward, lat, lng, pinLabel, openIssues, onWard, onConfirm, onOpenMap, onClose }) {
  const viaMap = CITY_MAP.installed;
  const [temp, setTemp] = useState(null); // { lat, lng, label }
  const goRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const gpsPin = useGpsPin({ onWard: (name) => onWard(name), onPin: (p) => setTemp(p) });

  // each opening starts from the spot already on the report
  useEffect(() => {
    if (!open) return;
    setTemp(Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng, label: pinLabel || "" } : null);
    gpsPin.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      closeRef.current();
    };
    window.addEventListener("keydown", onKey, true);
    const t = setTimeout(() => (viaMap ? goRef.current : document.querySelector(".gd.cyan .zp-stage > svg"))?.focus(), 80);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prev;
    };
  }, [open, viaMap]);

  if (!open || !ward) return null;

  const pinned = temp && Number.isFinite(temp.lat) && Number.isFinite(temp.lng);
  const gpsPinned = pinned && temp.label === "Your location (GPS)";
  const lock = () => {
    if (!pinned) return;
    onConfirm({ lat: temp.lat, lng: temp.lng, label: temp.label || "" });
  };

  return createPortal(
    <div className="ix">
      <div className="gd-veil" onClick={onClose} />
      <aside className="gd cyan ld" role="dialog" aria-modal="true" aria-label={`Pin the exact spot in ${ward}`}>
        <span className="gd-edge" aria-hidden />
        <header className="gd-head">
          <div className="gd-id">
            <span className="gd-mark"><MapPinned size={18} /></span>
            <div>
              <p className="gd-kicker">02 · Exact spot</p>
              <p className="gd-code">{ward}</p>
            </div>
          </div>
          <button type="button" className="gd-x" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </header>

        <div className="gd-body">
          <div>
            <h2>{viaMap ? `Pin it on the ${ward} map` : `Tap the exact spot in ${ward}`}</h2>
            <p className="gd-lead">
              {viaMap
                ? "The city map opens inside this zone. Search or zoom to the point, drop the pin and press Confirm. You come straight back here with the place, its latitude and longitude. What you typed and your photos stay."
                : "Tap where the problem is. Arrow keys nudge the pin, Shift moves it further. Dots are reports already open here, so you can see if someone got there first."}
            </p>
          </div>

          <ZonePinPicker
            ward={ward}
            lat={pinned ? temp.lat : null}
            lng={pinned ? temp.lng : null}
            openIssues={openIssues}
            chips={false}
            editable={!viaMap}
            onWard={onWard}
            onPin={(p) => setTemp({ lat: p.lat, lng: p.lng, label: "" })}
          />

          <div className="ld-gps">
            <button type="button" className={`zp-gps ${gpsPin.gps.state}`} onClick={gpsPin.locate} disabled={gpsPin.gps.state === "busy"}>
              <Radar size={13} /> {gpsPin.gps.state === "busy" ? "Locating…" : "Use my location"}
            </button>
            {gpsPin.gps.text ? <p className={`zp-note ${gpsPin.gps.state}`} role="status">{gpsPin.gps.text}</p> : null}
          </div>

          <div className={`gd-ticket ld-read${pinned ? " on" : ""}`} aria-live="polite">
            <p>{pinned ? "Pinned spot" : "No spot yet"}</p>
            <strong>{pinned ? temp.label || "Dropped pin" : viaMap ? "Pin it on the city map" : "Tap the zone card"}</strong>
            {pinned ? (
              <div className="ld-coords">
                <span><em>LAT</em>{temp.lat.toFixed(6)}</span>
                <span><em>LNG</em>{temp.lng.toFixed(6)}</span>
                <span><em>FROM CENTRE</em>{fromCentre(ward, temp.lat, temp.lng)}</span>
              </div>
            ) : (
              <div className="ld-coords wait"><span><Crosshair size={12} /> Coordinates appear once the pin drops</span></div>
            )}
          </div>

          <ol className="gd-steps">
            {viaMap ? (
              <>
                <li><b>1</b>Open the {ward} map. The pin can only drop inside this zone.</li>
                <li><b>2</b>Drop the pin on the exact point and press Confirm.</li>
                <li><b>3</b>Back here, the spot locks onto the zone card.</li>
              </>
            ) : (
              <>
                <li><b>1</b>Tap the spot on the zone card, or use your location.</li>
                <li><b>2</b>Nudge it until it sits right on the problem.</li>
                <li><b>3</b>Lock it. The crew gets these exact coordinates.</li>
              </>
            )}
          </ol>
        </div>

        <footer className="gd-foot">
          {viaMap && gpsPinned ? (
            <button type="button" className="gd-btn" onClick={lock}><LocateFixed size={14} /> Use this GPS spot</button>
          ) : (
            <button type="button" className="gd-btn" onClick={onClose}>Cancel</button>
          )}
          {viaMap ? (
            <button ref={goRef} type="button" className="gd-btn go" onClick={() => onOpenMap(ward)}>
              <MapPinned size={14} /> Open {ward} map <ArrowUpRight size={13} />
            </button>
          ) : (
            <button type="button" className="gd-btn go" onClick={lock} disabled={!pinned}>
              <Check size={14} /> Lock this spot
            </button>
          )}
        </footer>
      </aside>
    </div>,
    document.body
  );
}

export default LocationDoor;