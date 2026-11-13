import { useEffect, useLayoutEffect, useRef } from "react";

const real = (v) => typeof v === "number" && Number.isFinite(v);

// Counts smoothly from the old value to the new one by writing straight to the DOM,
// so it causes zero React re-renders (this is what keeps it buttery).
// A missing value (null, undefined, NaN) shows the placeholder instead of a number.
function AnimatedNumber({ value, decimals = 0, duration = 800, format, placeholder = "—" }) {
  const ref = useRef(null);
  const current = useRef(real(value) ? value : null);
  const fmt = useRef(null);
  fmt.current = format || ((n) => n.toFixed(decimals));

  useLayoutEffect(() => {
    ref.current.textContent = real(value) ? fmt.current(value) : placeholder;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!real(value)) {
      current.current = null;
      el.textContent = placeholder;
      return undefined;
    }
    const from = current.current;
    if (from === value) return undefined;
    if (from === null) {
      // first real reading: show it at once (no count up from zero)
      current.current = value;
      el.textContent = fmt.current(value);
      return undefined;
    }
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
  }, [value, duration, placeholder]);

  return <span ref={ref} />;
}

export default AnimatedNumber;
