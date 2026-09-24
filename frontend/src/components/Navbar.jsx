import { useLocation, useNavigate } from "react-router-dom";

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="site-nav" aria-label="Main navigation">
      <button
        type="button"
        className={location.pathname === "/home" ? "active" : ""}
        onClick={() => navigate("/home")}
      >
        Home
      </button>

      <button
        type="button"
        className={location.pathname === "/about" ? "active" : ""}
        onClick={() => navigate("/about")}
      >
        About
      </button>

      <button
        type="button"
        onClick={() => navigate("/contact")}
      >
        Contact
      </button>
    </nav>
  );
}