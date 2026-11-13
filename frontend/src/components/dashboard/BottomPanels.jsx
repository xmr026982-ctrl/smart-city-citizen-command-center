import { useState } from "react";
import { RefreshCw } from "lucide-react";
import TiltCard from "./TiltCard";
import AnimatedNumber from "./AnimatedNumber";
import Sparkline from "./Sparkline";
import { CITY, envLabel } from "../../config/zones";

const real = (v) => typeof v === "number" && Number.isFinite(v);

export function LiveAlerts({ alerts, live = true }) {
  return (
    <TiltCard as="section" className="panel alerts">
      <header>
        <h3>Live Alerts</h3>
        <span className="count"><AnimatedNumber value={alerts.length} /></span>
      </header>
      <ul>
        {alerts.slice(0, 2).map((a) => (
          <li key={a.id}>
            <i className={`dot ${a.tone}`} />
            <div>
              <strong>{a.title}</strong>
              <span>{a.place}<em>{a.note}</em></span>
            </div>
          </li>
        ))}
        {alerts.length === 0 && <li className="empty">{live ? "No active alerts" : "Waiting for live readings"}</li>}
      </ul>
    </TiltCard>
  );
}

/* sensors = live feeds that answered in the past hour (air, traffic, weather per zone) */
export function CityOverview({ sensors }) {
  return (
    <TiltCard as="section" className="panel overview">
      <h3>City Overview</h3>
      <dl>
        <div><dt>Population</dt><dd>{CITY.population}</dd></div>
        <div><dt>Area</dt><dd>{CITY.area}</dd></div>
        <div>
          <dt>Live Feeds</dt>
          <dd><AnimatedNumber value={real(sensors) ? sensors : null} format={(n) => Math.round(n).toLocaleString("en-IN")} /></dd>
        </div>
      </dl>
      <div className="radar" aria-hidden="true">
        <svg className="ghost-map" viewBox="0 0 100 120">
          <path d="M38 6 L62 14 L74 34 L70 50 L84 66 L76 92 L58 112 L40 104 L34 80 L20 66 L26 44 L22 24 Z" />
        </svg>
        <i className="sweep" />
        <i className="blip b1" />
        <i className="blip b2" />
        <i className="blip b3" />
        <i className="blip b4" />
      </div>
    </TiltCard>
  );
}

/* the city's average AQI across the zones reporting right now */
export function EnvIndex({ value, history, std, calibrating = false }) {
  const has = real(value);
  return (
    <TiltCard as="section" className="panel env">
      <h3>City Air Index</h3>
      <div className="env-row">
        <div>
          <div className={`big${has ? "" : " none"}`}><AnimatedNumber value={has ? value : null} /></div>
          <span className="sub" title={has && calibrating ? "Estimated from the latest station readings. Switches to the official CPCB 24-hour average after 16 hours." : undefined}>{has ? (calibrating ? `${envLabel(value, std)} · Calibrating` : `Avg AQI · ${envLabel(value, std)}`) : "No reading"}</span>
        </div>
        <Sparkline data={history} color="#16a34a" height={46} live={has} />
      </div>
    </TiltCard>
  );
}

/* share of successful source checks over the past 24 hours */
export function Uptime({ value, onRefresh }) {
  const [spin, setSpin] = useState(false);
  const has = real(value);
  const refresh = () => {
    setSpin(true);
    onRefresh?.();
    setTimeout(() => setSpin(false), 900);
  };
  return (
    <TiltCard as="section" className="panel uptime">
      <h3>Feed Uptime · 24 h</h3>
      <div className={`big${has ? "" : " none"}`}><AnimatedNumber value={has ? value : null} decimals={1} />{has ? <small>%</small> : null}</div>
      <div className="uptime-row">
        <div className="bar"><i style={{ width: `${has ? Math.max(0, Math.min(100, value)) : 0}%` }} /></div>
        <button type="button" aria-label="Refresh readings" title="Refresh readings" className={spin ? "spin" : ""} onClick={refresh}>
          <RefreshCw size={16} />
        </button>
      </div>
    </TiltCard>
  );
}
