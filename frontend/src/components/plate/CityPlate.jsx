import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Leaf,
  Car,
  CloudRain,
  ThermometerSun,
  RotateCw,
  Box,
  LocateFixed,
  Radar,
  ArrowUpRight,
  Sun,
  Moon,
  SunMoon,
} from "lucide-react";
import CityScene from "./CityScene";
import { ZONE_POS, project } from "./geo";
import { skyFor, SKY_MODES, SKY_LABEL } from "./sky";
import KpiCard from "../dashboard/KpiCard";
import { LiveAlerts, CityOverview, EnvIndex, Uptime } from "../dashboard/BottomPanels";
import { useLiveFeed } from "../../hooks/useLiveFeed";
import { useSettings, setSetting } from "../../store/settingsStore";
import { useActiveZone, setActiveZone } from "../../store/zoneStore";
import { useAuth } from "../../store/authStore";
import { useIssues } from "../../store/issueStore";
import { useInbox } from "../../store/notifyStore";
import { useCommunity, pollOpen } from "../../store/communityStore";
import { refreshFeed } from "../../services/liveFeed";
import { ZONES, deriveAlerts, aqiLabel, trafficLabel, waterLabel, powerLabel } from "../../config/zones";
import { WARDS } from "../../constants/issueConstants";
import { STATUS_LABEL, publicStatus } from "../../constants/issueStatuses";
import { slaOf } from "../../utils/sla";
import { fileLink } from "../../utils/fileLink";
import "../../styles/plate.css";

// Defined outside the component so React never re-applies them.
const CAMERA = { position: [42, 52, 69], fov: 35, near: 1, far: 700 };
const GL = { antialias: true, powerPreference: "high-performance" };
const STYLE = { position: "absolute", inset: 0 };
const DPR_CAP = { high: 2, balanced: 1.5, lite: 1 };
const SKY_ICON = { auto: SunMoon, day: Sun, night: Moon };
const SKY_NEXT = { auto: "day", day: "night", night: "auto" };

const ROLE = { admin: "admin", staff: "staff", user: "citizen" };
const ACCENT = { admin: "#7c3aed", staff: "#0d9488", citizen: "#0891b2" };
const COVERED = new Set(WARDS.map((w) => w.name));
const RIPPLE_COLOR = { submitted: null, acknowledged: null, in_progress: "#f59e0b", pending_review: "#06b6d4", resolved: "#10b981" };

/* which open issues this person sees on the model */
function mine(role, me) {
  if (role === "admin") return () => true;
  if (role === "staff") return (i) => i.assignedTo === me?.name;
  return (i) => i.reporterId === me?.id;
}

function CityPlate() {
  const goal = useRef(null);
  const stageRef = useRef(null);
  const ripples = useRef([]);
  const cfg = useSettings();
  const me = useAuth();
  const issues = useIssues();
  const { unreadIssues } = useInbox(); // beacons with an unread update pulse in the role colour
  const navigate = useNavigate();
  const location = useLocation();
  const role = ROLE[me?.role] || "citizen";
  const accent = ACCENT[role];
  const activeId = useActiveZone(); // shared with the top-bar zone switcher and Settings
  const [orbit, setOrbit] = useState(() => !cfg.reduceMotion && cfg.autoOrbit !== false);
  const [flat, setFlat] = useState(false);
  const [dprDrop, setDprDrop] = useState(false);
  const [onScreen, setOnScreen] = useState(true);
  const [hoverId, setHoverId] = useState(null);

  // the sky: Live sky follows the sun over Kolkata (checked every 30 s), or Day / Night pinned
  const skyMode = SKY_MODES.includes(cfg.skyMode) ? cfg.skyMode : "auto";
  const [sky, setSky] = useState(() => skyFor(skyMode));
  useEffect(() => {
    setSky(skyFor(skyMode));
    if (skyMode !== "auto") return undefined;
    const t = setInterval(() => setSky(skyFor("auto")), 30000);
    return () => clearInterval(t);
  }, [skyMode]);
  const night = Math.round(sky.night * 100) / 100;
  const SkyIcon = SKY_ICON[skyMode];
  const nextSky = SKY_NEXT[skyMode];
  // the opening glide plays once per page visit, never with Reduce motion
  const [intro] = useState(() => !cfg.reduceMotion);

  // auto orbit is the default; Reduce motion in Settings turns it off
  useEffect(() => { setOrbit(!cfg.reduceMotion && cfg.autoOrbit !== false); }, [cfg.autoOrbit, cfg.reduceMotion]);
  useEffect(() => { setDprDrop(false); }, [cfg.perfMode]);

  // stop drawing while the model is off screen or the tab is hidden
  useEffect(() => {
    const el = stageRef.current;
    let seen = true;
    const sync = () => setOnScreen(seen && document.visibilityState !== "hidden");
    const io = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver(([e]) => { seen = e.isIntersecting; sync(); }, { threshold: 0.02 }) : null;
    if (io && el) io.observe(el);
    document.addEventListener("visibilitychange", sync);
    return () => { io?.disconnect(); document.removeEventListener("visibilitychange", sync); };
  }, []);

  // whenever the active zone changes (top bar, 3D click, or Settings default), glide the camera there
  useEffect(() => {
    const pos = ZONE_POS[activeId];
    if (!pos) return;
    goal.current = { ...(goal.current || {}), x: pos[0], z: pos[1], dist: 50 };
    setHoverId(null);
  }, [activeId]);

  // ripples: an issue filed, or moved to a new status, sends a ring out where it is
  const seen = useRef(null);
  useEffect(() => {
    const keep = mine(role, me);
    const now = new Map(issues.map((i) => [i.id, i.status]));
    if (seen.current) {
      issues.forEach((i) => {
        if (!keep(i) || !Number.isFinite(i.lat)) return;
        const was = seen.current.get(i.id);
        if (was === i.status) return;
        const color = was === undefined ? accent : RIPPLE_COLOR[i.status] || accent;
        const [x, z] = project(i.lat, i.lng);
        ripples.current.push({ x, z, color });
      });
    }
    seen.current = now;
  }, [issues, role, me, accent]);

  // community: something published or decided in a zone sends a ring out there (every zone = the hub)
  const community = useCommunity();
  const seenTrail = useRef(null);
  useEffect(() => {
    const ids = new Set(community.trail.map((e) => e.id));
    if (seenTrail.current) {
      community.trail.forEach((e) => {
        if (seenTrail.current.has(e.id) || !["announced", "poll-opened", "poll-closed", "decided", "notice", "proposed"].includes(e.n?.type)) return;
        const wards = e.n.zones ? (e.n.zones.includes("all") ? ["Central Kolkata"] : e.n.zones) : [e.n.ward];
        wards.forEach((w) => {
          const z = ZONES.find((x) => x.name === w);
          const pos = z && ZONE_POS[z.id];
          if (pos) ripples.current.push({ x: pos[0], z: pos[1], color: e.n.type === "announced" ? "#f59e0b" : accent });
        });
      });
    }
    seenTrail.current = ids;
  }, [community.trail, accent]);

  const device = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const dpr = dprDrop ? 1 : Math.min(device, DPR_CAP[cfg.perfMode] ?? 1.5);

  const feed = useLiveFeed();
  const active = ZONES.find((z) => z.id === activeId) || ZONES[0];
  const zm = feed.zones[active.id];
  const alerts = useMemo(() => feed.alertsOverride ?? deriveAlerts(feed.zones), [feed.alertsOverride, feed.zones]);
  const inCoverage = COVERED.has(active.name);

  // the selected zone's open issues, as this person may see them
  const zoneIssues = useMemo(() => {
    if (!inCoverage) return [];
    const keep = mine(role, me);
    return issues.filter((i) => i.ward === active.name && i.status !== "resolved" && keep(i) && Number.isFinite(i.lat) && Number.isFinite(i.lng));
  }, [issues, inCoverage, active.name, role, me]);
  const beacons = useMemo(
    () => zoneIssues.map((i) => ({ id: i.id, lat: i.lat, lng: i.lng, status: i.status, breached: role !== "citizen" && slaOf(i).state === "over", fresh: unreadIssues.has(i.id) })),
    [zoneIssues, role, unreadIssues]
  );
  const breached = beacons.filter((b) => b.breached).length;
  const hovered = zoneIssues.find((i) => i.id === hoverId) || null;

  const select = useCallback((zone) => setActiveZone(zone.id), []);
  const openIssue = useCallback((id) => navigate(fileLink(role, id, location.pathname)), [navigate, role, location.pathname]);

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

  const what = role === "admin" ? "open" : role === "staff" ? "of your files" : "of your reports";

  return (
    <section className={`stage plate-${role}${night > 0.5 ? " is-night" : ""}`} ref={stageRef} style={{ "--acc": accent, "--night": night }}>
      <Canvas flat dpr={dpr} camera={CAMERA} gl={GL} style={STYLE} frameloop={onScreen ? "always" : "never"}>
        <PerformanceMonitor onDecline={() => setDprDrop(true)} />
        <CityScene
          activeId={activeId}
          onSelect={select}
          goal={goal}
          orbit={orbit}
          accent={accent}
          beacons={beacons}
          onOpenIssue={openIssue}
          onHoverIssue={setHoverId}
          hoverIssueId={hoverId}
          ripples={ripples}
          sky={sky}
          intro={intro}
          instantSky={!!cfg.reduceMotion}
        />
      </Canvas>

      <div className="hud-grid" />
      <div className="aurora" />
      <div className="fade fade-top" />
      <div className="fade fade-bottom" />
      <div className="scan" />
      <i className="hud tl" /><i className="hud tr" /><i className="hud bl" /><i className="hud br" />

      <div className="zone-chip"><i />ZONE<b>{active.name}</b></div>

      <div className={`cov-card ${inCoverage ? "in" : "out"}`}>
        {inCoverage ? (
          <>
            <p className="cov-k"><Radar size={12} /> Issue coverage</p>
            <p className="cov-v">
              <b>{beacons.length}</b> {what}
              {breached ? <em>{breached} breached</em> : null}
            </p>
            <p className="cov-h">{beacons.length ? "Beacons on the model mark them · select one to open its file" : "Nothing open here right now"}</p>
            {beacons.length ? (
              <button
                type="button"
                className="cov-comm cov-open"
                onClick={() => {
                  if (beacons.length === 1) { openIssue(beacons[0].id); return; }
                  if (role === "admin") navigate("/admin/queue", { state: { ward: active.name } });
                  else navigate(role === "staff" ? "/staff/assigned" : "/citizen/my-reports");
                }}
              >
                {beacons.length === 1
                  ? `Open ${beacons[0].id}`
                  : role === "admin" ? `Open ${active.name} in All Issues` : role === "staff" ? "Open in Assigned Work" : "Open in My Reports"} <ArrowUpRight size={12} />
              </button>
            ) : null}
            {(() => {
              const props = community.proposals.filter((p) => p.ward === active.name && p.status === "review").length;
              const polls = community.polls.filter((p) => (p.ward === active.name || p.ward === "all") && pollOpen(p)).length;
              return props || polls ? (
                <button type="button" className="cov-comm" onClick={() => navigate("/community")}>
                  Community · {props} proposal{props === 1 ? "" : "s"}{polls ? ` · ${polls} live poll${polls === 1 ? "" : "s"}` : ""} <ArrowUpRight size={12} />
                </button>
              ) : null;
            })()}
          </>
        ) : (
          <>
            <p className="cov-k">Outside coverage</p>
            <p className="cov-v"><b>Issue reporting covers {WARDS.length} zones</b></p>
            <div className="cov-chips">
              {WARDS.map((w) => {
                const z = ZONES.find((x) => x.name === w.name);
                return z ? <button key={w.name} type="button" onClick={() => setActiveZone(z.id)}>{w.name}</button> : null;
              })}
            </div>
          </>
        )}
      </div>

      {hovered ? (
        <div className="cp-issue" role="status">
          <span className={`cp-dot s-${hovered.status}${role !== "citizen" && slaOf(hovered).state === "over" ? " br" : ""}`} />
          <b className="m">{hovered.id}</b>
          <span className="cp-t">{hovered.title}</span>
          <span className="cp-s">{STATUS_LABEL[role === "citizen" ? publicStatus(hovered.status) : hovered.status] || hovered.status}</span>
          <span className="cp-go">Open the file <ArrowUpRight size={12} /></span>
        </div>
      ) : null}

      <div className="map-tools">
        <button type="button" aria-pressed={orbit} title="Auto orbit" onClick={() => setOrbit((v) => !v)}><RotateCw size={17} /></button>
        <button type="button" aria-pressed={!flat} title="3D tilt" onClick={toggleFlat}><Box size={17} /></button>
        <button type="button" title="Recenter" onClick={recenter}><LocateFixed size={17} /></button>
        <button
          type="button"
          className="sky-btn"
          title={`Sky: ${SKY_LABEL[skyMode]} · switch to ${SKY_LABEL[nextSky]}`}
          aria-label={`Sky: ${SKY_LABEL[skyMode]}. Switch to ${SKY_LABEL[nextSky]}`}
          onClick={() => setSetting("skyMode", nextSky)}
        >
          <SkyIcon size={17} />
          {skyMode === "auto" ? <i className="sky-live" /> : null}
        </button>
      </div>

      <div className="kpi-row">
  <KpiCard
    icon={Leaf}
    label="Air Quality"
    value={zm.aqi ?? "—"}
    history={zm.history.aqi}
    unit=" AQI"
    status={aqiLabel(zm.aqi, cfg.aqiStd)}
    color="#16a34a"
    lowerIsBetter
  />

  <KpiCard
    icon={Car}
    label="Traffic Flow"
    value={zm.traffic ?? "—"}
    history={zm.history.traffic}
    unit="%"
    status={trafficLabel(zm.traffic)}
    color="#2563eb"
  />

  <KpiCard
    icon={CloudRain}
    label="Rainfall"
    value={zm.rain ?? "—"}
    history={zm.history.rain}
    unit=" mm"
    status="Preceding hour"
    color="#0ea5e9"
  />

  <KpiCard
    icon={ThermometerSun}
    label="Heat"
    value={zm.heat ?? "—"}
    history={zm.history.heat}
    unit=" °C"
    status={
      Number.isFinite(Number(zm.feels))
        ? `Feels like ${Number(zm.feels).toFixed(1)} °C`
        : "Feels-like unavailable"
    }
    color="#a855f7"
  />
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
