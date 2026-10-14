function Badge({ children, className = "", tone = "neutral" }) {
  const tones = {
    neutral: { background: "var(--bg)", color: "var(--muted)" },
    info: { background: "var(--info-soft)", color: "var(--info)" },
    success: { background: "var(--success-soft)", color: "var(--success)" },
    warning: { background: "var(--warning-soft)", color: "var(--warning)" },
    danger: { background: "var(--danger-soft)", color: "var(--danger)" },
  };

  return (
    <span className={`badge ${className}`} style={tones[tone] || tones.neutral}>
      {children}
    </span>
  );
}

export default Badge;