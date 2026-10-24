import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { Leaf, Car, Droplets, Zap, RotateCw, Box, LocateFixed } from "lucide-react";
import CityScene from "./CityScene";
import { ZONE_POS } from "./geo";
import KpiCard from "../dashboard/KpiCard";
import { LiveAlerts, CityOverview, EnvIndex, Uptime } from "../dashboard/BottomPanels";
import { useLiveFeed } from "../../hooks/useLiveFeed";
import { useSettings } from "../../store/settingsStore";
import { useActiveZone, setActiveZone } from "../../store/zoneStore";
import { refreshFeed } from "../../services/liveFeed";
import { ZONES, deriveAlerts, aqiLabel, trafficLabel, waterLabel, powerLabel } from "../../config/zones";

// Defined outside the component so React never re-applies them.
const CAMERA = { position: [42, 52, 69], fov: 35, near: 1, far: 700 };
const GL = { antialias: true, powerPreference: "high-performance" };
const STYLE = { position: "absolute", inset: 0 };
const DPR_CAP = { high: 2, balanced: 1.5, lite: 1 };

function CityPlate() {
  const goal = useRef(null);
  const cfg = useSettings();
  const activeId = useActiveZone(); // shared with the top-bar zone switcher and Settings
  const [orbit, setOrbit] = useState(() => cfg.autoOrbit && !cfg.reduceMotion);
  const [flat, setFlat] = useState(false);
  const [dprDrop, setDprDrop] = useState(false);

  // follow the Settings page
  useEffect(() => { setOrbit(cfg.autoOrbit && !cfg.reduceMotion); }, [cfg.autoOrbit, cfg.reduceMotion]);
  useEffect(() => { setDprDrop(false); }, [cfg.perfMode]);

  // whenever the active zone changes (top bar, 3D click, or Settings default), fly the camera there
  useEffect(() => {
    const pos = ZONE_POS[activeId];
    if (!pos) return;
    goal.current = { ...(goal.current || {}), x: pos[0], z: pos[1], dist: 50 };
  }, [activeId]);

  const device = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const dpr = dprDrop ? 1 : Math.min(device, DPR_CAP[cfg.perfMode] ?? 1.5);

  const feed = useLiveFeed();
  const active = ZONES.find((z) => z.id === activeId) || ZONES[0];
  const zm = feed.zones[active.id];
  const alerts = useMemo(() => feed.alertsOverride ?? deriveAlerts(feed.zones), [feed.alertsOverride, feed.zones]);

  const select = useCallback((zone) => setActiveZone(zone.id), []);

  const toggleFlat = () => {
    const next = !flat;
    setFlat(next);
    goal.current = { ...(goal.current || {}), phi: next ? 0.06 : 1.0 };
  };

  const recenter = () => {
    setFlat(false);
    const pos = ZONE_POS[activeId] || [0, 0];
    goal.current = { x: pos[0], z: pos[1], dist: 96, phi: 1.0 };
  };

  return (
    <section className="stage">
      <Canvas flat dpr={dpr} camera={CAMERA} gl={GL} style={STYLE}>
        <PerformanceMonitor onDecline={() => setDprDrop(true)} />
        <CityScene activeId={activeId} onSelect={select} goal={goal} orbit={orbit} />
      </Canvas>

      <div className="hud-grid" />
      <div className="aurora" />
      <div className="fade fade-top" />
      <div className="fade fade-bottom" />
      <div className="scan" />
      <i className="hud tl" /><i className="hud tr" /><i className="hud bl" /><i className="hud br" />

      <div className="zone-chip"><i />ZONE<b>{active.name}</b></div>

      <div className="map-tools">
        <button type="button" aria-pressed={orbit} title="Auto orbit" onClick={() => setOrbit((v) => !v)}><RotateCw size={17} /></button>
        <button type="button" aria-pressed={!flat} title="3D tilt" onClick={toggleFlat}><Box size={17} /></button>
        <button type="button" title="Recenter" onClick={recenter}><LocateFixed size={17} /></button>
      </div>

      <div className="kpi-row">
        <KpiCard icon={Leaf} label="Air Quality" value={zm.aqi} history={zm.history.aqi} unit=" AQI" status={aqiLabel(zm.aqi, cfg.aqiStd)} color="#16a34a" lowerIsBetter />
        <KpiCard icon={Car} label="Traffic Flow" value={zm.traffic} history={zm.history.traffic} unit="%" status={trafficLabel(zm.traffic)} color="#2563eb" />
        <KpiCard icon={Droplets} label="Water Supply" value={zm.water} history={zm.history.water} unit="%" status={waterLabel(zm.water)} color="#0ea5e9" />
        <KpiCard icon={Zap} label="Power Supply" value={zm.power} history={zm.history.power} unit="%" status={powerLabel(zm.power)} color="#a855f7" />
      </div>

      <div className="panel-row">
        <LiveAlerts alerts={alerts} />
        <CityOverview sensors={feed.city.sensors} />
        <EnvIndex value={feed.city.envIndex} history={feed.city.envHistory} />
        <Uptime value={feed.city.uptime} onRefresh={refreshFeed} />
      </div>
    </section>
  );
}

export default CityPlate;