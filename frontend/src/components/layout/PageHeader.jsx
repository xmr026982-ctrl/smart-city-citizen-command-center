function PageHeader({ eyebrow, title, description }) {
  return (
    <header>
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h1 style={{ marginTop: 12, fontSize: "clamp(32px, 4vw, 44px)" }}>{title}</h1>
      {description ? (
        <p style={{ marginTop: 8, color: "var(--muted)", maxWidth: 560 }}>{description}</p>
      ) : null}
    </header>
  );
}

export default PageHeader;