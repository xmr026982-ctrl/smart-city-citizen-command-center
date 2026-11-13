import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Radar, X, Info } from "lucide-react";
import MapView from "../../components/map/MapView";
import { getRole } from "../../store/authStore";
import { nearestZone } from "../../services/citizenService";
import "../../styles/city-map.css";
import "../../styles/map-k2.css";

/* ------------------------------------------------------------------
   City Map (Person 3's map, integrated by Person 4) at /map.
   The map fills everything under the top bar; Person 3's controls float
   over it as glass HUD tools in the role accent. Notices from the map
   show as a glass toast instead of browser pop-ups. Traffic is hidden
   when no TomTom key is set. "Report issue" from the map goes to Report
   Issue without a reload, with the zone and spot when one is selected.
   Report Issue opens it in pick mode: /map?zone=<zone>&pick=1&return=...
------------------------------------------------------------------- */

const MAP_ROLE = { citizen: "user", staff: "staff", admin: "admin" };
const REACH_M = 3000;
const HAS_TRAFFIC = Boolean(import.meta.env.VITE_TOMTOM_API_KEY);

function CityMap() {
  const role = getRole() || "citizen";
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const pick = params.get("pick") === "1";
  const [notice, setNotice] = useState(null);
  const [credits, setCredits] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    const onNotice = (e) => {
      clearTimeout(timer.current);
      setNotice({ ...e.detail, at: Date.now() });
      timer.current = setTimeout(() => setNotice(null), 4200);
    };
    window.addEventListener("citymap:notice", onNotice);
    return () => { window.removeEventListener("citymap:notice", onNotice); clearTimeout(timer.current); };
  }, []);

  // the map's "Report issue": hand the spot over only if it falls in a service zone
  const reportFromMap = (spot) => {
    if (spot && Number.isFinite(spot.latitude) && Number.isFinite(spot.longitude)) {
      const near = nearestZone({ lat: spot.latitude, lng: spot.longitude });
      if (near && near.m <= REACH_M) {
        const q = new URLSearchParams({ zone: near.ward.name, lat: spot.latitude.toFixed(6), lng: spot.longitude.toFixed(6), label: "Pinned on the city map" });
        navigate(`/citizen/report?${q}`);
        return;
      }
    }
    navigate("/citizen/report");
  };

  return (
    <div className={`page city-map-page tone-${role}${pick ? " picking" : ""}`}>
      <section className={`city-map tone-${role}${HAS_TRAFFIC ? "" : " no-traffic"}`}>
        <div className="cm-stage">
          <MapView role={MAP_ROLE[role] || "user"} onReportIssue={role === "citizen" ? reportFromMap : undefined} />
        </div>
        {/* map data credit (required by the OpenStreetMap / Esri licences), shown on demand */}
        <div className={`cm-credit${credits ? " open" : ""}`}>
          <button type="button" onClick={() => setCredits((v) => !v)} aria-label="Map data credits" aria-expanded={credits}><Info size={13} /></button>
          {credits ? <span>Map data © OpenStreetMap contributors · © CARTO · Imagery and labels © Esri · OpenTopoMap</span> : null}
        </div>
        {notice ? (
          <div className={`cm-notice ${notice.tone || "info"}`} key={notice.at} role="status">
            <Radar size={15} />
            <span>{notice.message}</span>
            <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss"><X size={14} /></button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

export default CityMap;