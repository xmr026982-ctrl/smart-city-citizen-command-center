import TiltCard from "./TiltCard";
import AnimatedNumber from "./AnimatedNumber";
import Sparkline from "./Sparkline";

function KpiCard({ icon: Icon, label, value, history, unit, status, color, lowerIsBetter = false }) {
  const prev = history.length > 1 ? history[history.length - 2] : value;
  const delta = value - prev;
  const good = lowerIsBetter ? delta <= 0 : delta >= 0;

  return (
    <TiltCard className="kpi" style={{ "--tone": color }}>
      <header>
        <span className="kpi-icon"><Icon size={18} strokeWidth={1.8} /></span>
        <span className="kpi-label">{label}</span>
        <span className="live-chip"><i />LIVE</span>
      </header>
      <div className="kpi-value">
        <AnimatedNumber value={value} />
        <small>{unit}</small>
      </div>
      <div className="kpi-status">
        <span>{status}</span>
        <em className={`delta ${good ? "good" : "bad"}`}>{delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}</em>
      </div>
      <Sparkline data={history} color={color} live />
    </TiltCard>
  );
}

export default KpiCard;