import { useNavigate } from "react-router-dom";
import VideoComponents from "../components/videocomponents.jsx";

export default function Home() {
  const navigate = useNavigate();

  return (
    <main className="home-page">
      <VideoComponents />

      <section className="home-corner-content" aria-labelledby="home-title">
        <p className="home-eyebrow">WELCOME TO KOLKATA</p>

        <h1 id="home-title">
          Building a smarter city together
        </h1>

        <p>
          Connect with smarter services, discover what is happening around the
          city, and help create a better future for Kolkata.
        </p>

        <button
          type="button"
          className="home-cta"
          onClick={() => navigate("/preview")}
        >
          Explore smart services
        </button>
      </section>
    </main>
  );
}