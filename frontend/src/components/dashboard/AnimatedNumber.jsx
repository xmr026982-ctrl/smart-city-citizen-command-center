import { useEffect, useLayoutEffect, useRef } from "react";

// Counts smoothly from the old value to the new one by writing straight to the DOM,
// so it causes zero React re-renders (this is what keeps it buttery).
function AnimatedNumber({ value, decimals = 0, duration = 800, format }) {
  const ref = useRef(null);
  const current = useRef(value);
  const fmt = useRef(null);
  fmt.current = format || ((n) => n.toFixed(decimals));

  useLayoutEffect(() => {
    ref.current.textContent = fmt.current(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = ref.current;
    const from = current.current;
    if (from === value) return undefined;
    const start = performance.now();
    let raf;
    const step = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = from + (value - from) * eased;
      current.current = v;
      el.textContent = fmt.current(v);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <span ref={ref} />;
}

export default AnimatedNumber;