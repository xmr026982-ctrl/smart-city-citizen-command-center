import { Link } from "react-router-dom";

function NotFound() {
  return (
    <div className="empty-state">
      <h1>Page not found</h1>
      <p style={{ marginTop: 8 }}>This route is outside Issue Management.</p>
      <Link to="/" className="btn btn-primary" style={{ marginTop: 16 }}>
        Back to issues
      </Link>
    </div>
  );
}

export default NotFound;