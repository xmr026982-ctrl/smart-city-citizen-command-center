import { useId } from "react";

/* ------------------------------------------------------------------
   The Smart Kolkata mark: Howrah Bridge (approved files in
   Smart-Kolkata-Logo-Files.zip). One component for every place the
   logo appears:
     <LogoTile />   the tile with the bridge, 16–48 px (sidebar, sign-in pages)
     <LogoIcon />   the bridge alone, in the current text colour
     <LogoMark />   the full glowing mark for large displays (loading screen)
   The favicon is public/favicon.svg (the same tile).
------------------------------------------------------------------- */

/** The bridge for 16–48 px, drawn in currentColor. */
export function LogoIcon({ size = 20, className = "", title }) {
  return (
    <svg className={className} width={size} height={Math.round(size * 0.75)} viewBox="0 0 32 24" role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <g fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 17L7 7.4L13 12.6Q16 11.6 19 12.6L25 7.4L30 17" />
        <path d="M1 17H31" />
      </g>
      <g fill="currentColor">
        <path d="M5.65 22.6L6.5 1.6L7.5 1.6L8.35 22.6ZM23.65 22.6L24.5 1.6L25.5 1.6L26.35 22.6Z" />
      </g>
    </svg>
  );
}

/** The app tile: the bridge in white on the role's gradient (set by the tile's CSS). */
export function LogoTile({ size = 20, className = "" }) {
  return (
    <span className={`sk-logo-tile ${className}`} aria-hidden>
      <LogoIcon size={size} />
    </span>
  );
}

/** The full mark with its glow, for large displays. */
export function LogoMark({ width = 160, className = "", title = "Smart Kolkata" }) {
  const uid = useId().replace(/:/g, "");
  const g = `skg-${uid}`;
  const glow = `skglow-${uid}`;
  return (
    <svg className={className} width={width} height={width / 2} viewBox="0 0 64 32" role="img" aria-label={title}>
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="64" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#a5f3fc" />
          <stop offset=".55" stopColor="#38bdf8" />
          <stop offset="1" stopColor="#0284c7" />
        </linearGradient>
        <filter id={glow} x="-200%" y="-200%" width="500%" height="500%">
          <feGaussianBlur stdDeviation=".9" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <g fill="none" stroke={`url(#${g})`} strokeLinecap="round" strokeLinejoin="round">
        <path d="M5.6 24L8.4 15.55L11.2 24M15.2 24L18.25 10.25L21.31 24L24.36 14.55L27.42 24L30.47 14.7L33.53 24L36.58 15.04L39.64 24L42.69 12.4L45.75 24L48.8 8.1M52.8 24L55.6 15.55L58.4 24" strokeWidth="0.3" />
        <path d="M11.1 24L12.25 4.8L13.75 4.8L14.9 24M12.25 4.8L14.09 10.5M13.75 4.8L11.91 10.5M11.91 10.5L14.39 15.5M14.09 10.5L11.61 15.5M11.61 15.5L14.66 20M14.39 15.5L11.34 20M11.34 20L14.9 24M14.66 20L11.1 24M49.1 24L50.25 4.8L51.75 4.8L52.9 24M50.25 4.8L52.09 10.5M51.75 4.8L49.91 10.5M49.91 10.5L52.39 15.5M52.09 10.5L49.61 15.5M49.61 15.5L52.66 20M52.39 15.5L49.34 20M49.34 20L52.9 24M52.66 20L49.1 24" strokeWidth="0.3" />
        <path d="M4 24L13 6.4L25.5 15.2Q32 13.8 38.5 15.2L51 6.4L60 24" strokeWidth="0.55" />
        <path d="M2.5 24H61.5" strokeWidth="0.55" />
      </g>
      <g fill="#67e8f9" filter={`url(#${glow})`}>
        <path d="M13 3.08l1.15 1.725l-1.15 1.725l-1.15 -1.725z" />
        <path d="M51 3.08l1.15 1.725l-1.15 1.725l-1.15 -1.725z" />
      </g>
    </svg>
  );
}
