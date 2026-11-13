import { useRef } from "react";

// 3D hover-tilt wrapper with a moving glare. Used by every dashboard tile.
function TiltCard({ as: Tag = "article", className = "", max = 7, style, children, ...rest }) {
  const ref = useRef(null);

  const move = (e) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty("--px", (px * 2 - 1).toFixed(3));
    el.style.setProperty("--py", (py * 2 - 1).toFixed(3));
    el.style.setProperty("--gx", `${(px * 100).toFixed(1)}%`);
    el.style.setProperty("--gy", `${(py * 100).toFixed(1)}%`);
  };

  const leave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--px", "0");
    el.style.setProperty("--py", "0");
  };

  return (
    <Tag
      ref={ref}
      className={`tilt ${className}`}
      style={{ "--max": `${max}deg`, ...style }}
      onPointerMove={move}
      onPointerLeave={leave}
      {...rest}
    >
      <span className="tilt-glare" aria-hidden="true" />
      {children}
    </Tag>
  );
}

export default TiltCard;