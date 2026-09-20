function IssuePhotoGallery({ photos = [] }) {
  if (!photos.length) {
    return (
      <p style={{ color: "var(--muted)", fontSize: 14 }}>
        No photographic evidence attached.
      </p>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
      {photos.map((photo) => (
        <figure key={photo.id} style={{ margin: 0 }}>
          <img
            src={photo.url}
            alt={photo.name}
            style={{
              width: "100%",
              aspectRatio: "3 / 2",
              objectFit: "cover",
              borderRadius: 12,
              border: "1px solid var(--border)",
            }}
          />
          <figcaption className="mono" style={{ marginTop: 6 }}>
            {photo.name}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

export default IssuePhotoGallery;