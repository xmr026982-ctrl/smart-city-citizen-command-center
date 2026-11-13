import TiltCard from "./TiltCard";
import AnimatedNumber from "./AnimatedNumber";
import Sparkline from "./Sparkline";

const real = (v) => typeof v === "number" && Number.isFinite(v);

/* One City Health reading. `value` is a number or null (no reading yet);
   `live` is false when the server or the reading's source isn't answering. */
function KpiCard({ icon: Icon, label, value, history = [], unit, status, statusTip, color, decimals = 0, lowerIsBetter = false, live = true }) {
  const has = real(value);
  const series = history.filter(real);
  const prev = series.length > 1 ? series[series.length - 2] : null;
  const delta = has && prev !== null ? value - prev : null;
  const good = delta === null ? true : lowerIsBetter ? delta <= 0 : delta >= 0;
  const on = live && has;

  return (
    <TiltCard className={`kpi${has ? "" : " kpi-none"}`} style={{ "--tone": color }}>
      <header>
        <span className="kpi-icon"><Icon size={18} strokeWidth={1.8} /></span>
        <span className="kpi-label">{label}</span>
        <span className={`live-chip${on ? "" : " off"}`}><i />{on ? "LIVE" : "NO DATA"}</span>
      </header>
      <div className="kpi-value">
        <AnimatedNumber value={has ? value : null} decimals={decimals} />
        {has ? <small>{unit}</small> : null}
      </div>
      <div className="kpi-status">
        <span title={statusTip || undefined}>{status}</span>
        {delta !== null && Math.abs(delta) >= 0.05 ? (
          <em className={`delta ${good ? "good" : "bad"}`}>{delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}</em>
        ) : null}
      </div>
      <Sparkline data={series} color={color} live={on} />
    </TiltCard>
  );
}

export default KpiCard;
