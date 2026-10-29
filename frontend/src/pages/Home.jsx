import VideoComponents from "../components/videocomponents.jsx";

<<<<<<< HEAD
=======

>>>>>>> 4e7ddac (Integrated)
export default function Home({ onNavigate }) {
  return (
    <main className="home-page">

      <VideoComponents />

<<<<<<< HEAD
      

=======
>>>>>>> 4e7ddac (Integrated)
      <section
        className="home-corner-content"
        aria-labelledby="home-title"
      >
        <p className="home-eyebrow">
          WELCOME TO KOLKATA
        </p>

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
          onClick={() => onNavigate?.("preview")}
        >
          Explore smart services
        </button>
      </section>

    </main>
  );
}
