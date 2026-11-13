import { useId, useLayoutEffect, useMemo, useRef } from "react";

// New data slides in from the right like a live ticker (no redraw jump).
function Sparkline({ data, color = "#16a34a", height = 34, live = false }) {
  const id = useId().replace(/:/g, "");
  const group = useRef(null);
  const first = useRef(true);

  // only real numbers are drawn; with fewer than two there is no line yet
  const points = useMemo(() => (Array.isArray(data) ? data.filter((v) => typeof v === "number" && Number.isFinite(v)) : []), [data]);
  const empty = points.length < 2;

  const { line, area, endY } = useMemo(() => {
    const w = 100;
    const pad = 5;
    if (empty) {
      const y = height / 2;
      return { line: `M0,${y} L${w},${y}`, area: "", endY: y };
    }
    const data = points;
    const max = Math.max(...data);
    const min = Math.min(...data);
    const span = max - min || 1;
    const pts = data.map((v, i) => [(i / (data.length - 1)) * w, height - pad - ((v - min) / span) * (height - pad * 2)]);
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      const cx = (x0 + x1) / 2;
      d += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`;
    }
    return { line: d, area: `${d} L${w},${height} L0,${height} Z`, endY: pts[pts.length - 1][1] };
  }, [points, empty, height]);

  useLayoutEffect(() => {
    if (first.current) { first.current = false; return; }
    if (empty) return;
    const el = group.current;
    if (!el || !el.animate) return;
    const step = 100 / (points.length - 1);
    el.animate(
      [{ transform: `translateX(${step}px)` }, { transform: "translateX(0px)" }],
      { duration: 900, easing: "cubic-bezier(.2,.8,.2,1)" }
    );
  }, [points, empty]);

  return (
    <div className={`spark${empty ? " spark-empty" : ""}`} style={{ height }}>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <g ref={group}>
          {area ? <path d={area} fill={`url(#${id})`} /> : null}
          <path d={line} fill="none" stroke={color} strokeWidth="1.8" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeDasharray={empty ? "2 4" : undefined} opacity={empty ? 0.35 : 1} />
        </g>
      </svg>
      {live && !empty && <i className="spark-dot" style={{ top: `${(endY / height) * 100}%`, "--c": color }} />}
    </div>
  );
}

export default Sparkline;