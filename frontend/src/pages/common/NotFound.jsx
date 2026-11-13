import { Link } from "react-router-dom";

function NotFound() {
  return (
    <main className="page">
      <h1>Page not on this desk</h1>
      <Link to="/">Return</Link>
    </main>
  );
}

export default NotFound;