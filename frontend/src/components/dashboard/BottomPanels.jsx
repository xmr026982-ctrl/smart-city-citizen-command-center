import { useState } from "react";
import { RefreshCw } from "lucide-react";
import TiltCard from "./TiltCard";
import AnimatedNumber from "./AnimatedNumber";
import Sparkline from "./Sparkline";
import { CITY, envLabel } from "../../config/zones";

export function LiveAlerts({ alerts }) {
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
        {alerts.length === 0 && <li className="empty">No active alerts</li>}
      </ul>
    </TiltCard>
  );
}

export function CityOverview({ sensors }) {
  return (
    <TiltCard as="section" className="panel overview">
      <h3>City Overview</h3>
      <dl>
        <div><dt>Population</dt><dd>{CITY.population}</dd></div>
        <div><dt>Area</dt><dd>{CITY.area}</dd></div>
        <div>
          <dt>Active Sensors</dt>
          <dd><AnimatedNumber value={sensors} format={(n) => Math.round(n).toLocaleString("en-US")} /></dd>
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

export function EnvIndex({ value, history }) {
  return (
    <TiltCard as="section" className="panel env">
      <h3>Environmental Index</h3>
      <div className="env-row">
        <div>
          <div className="big"><AnimatedNumber value={value} /></div>
          <span className="sub">{envLabel(value)}</span>
        </div>
        <Sparkline data={history} color="#16a34a" height={46} live />
      </div>
    </TiltCard>
  );
}

export function Uptime({ value, onRefresh }) {
  const [spin, setSpin] = useState(false);
  const refresh = () => {
    setSpin(true);
    onRefresh?.();
    setTimeout(() => setSpin(false), 900);
  };
  return (
    <TiltCard as="section" className="panel uptime">
      <h3>System Uptime</h3>
      <div className="big"><AnimatedNumber value={value} decimals={1} /><small>%</small></div>
      <div className="uptime-row">
        <div className="bar"><i style={{ width: `${value}%` }} /></div>
        <button type="button" aria-label="Refresh" className={spin ? "spin" : ""} onClick={refresh}>
          <RefreshCw size={16} />
        </button>
      </div>
    </TiltCard>
  );
}