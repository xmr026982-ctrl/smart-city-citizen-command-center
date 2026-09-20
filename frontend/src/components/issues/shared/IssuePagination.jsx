function IssuePagination({ page, pageCount, onPage }) {
  if (pageCount <= 1) return null;

  return (
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
      <button
        type="button"
        className="btn btn-secondary"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        Previous
      </button>
      <span className="mono" style={{ display: "grid", placeItems: "center" }}>
        {page} / {pageCount}
      </span>
      <button
        type="button"
        className="btn btn-secondary"
        disabled={page >= pageCount}
        onClick={() => onPage(page + 1)}
      >
        Next
      </button>
    </div>
  );
}

export default IssuePagination;