import { usePointerLight } from "../../hooks/usePointerLight";

function GlassCard({
  children,
  className = "",
  delay = 0,
  living = "",
  style,
  onClick,
}) {
  const { onMouseMove } = usePointerLight();

  return (
    <div
      className={`glass-card boot-in ${living} ${className}`}
      style={{ animationDelay: `${delay}ms`, ...style }}
      onMouseMove={onMouseMove}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

export default GlassCard;