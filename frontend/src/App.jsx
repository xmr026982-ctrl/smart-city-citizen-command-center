import { Routes, Route } from "react-router-dom";

import Home from "./pages/Home.jsx";
import Auth from "./pages/Auth.jsx";
import About from "./pages/About.jsx";
import PlatformPreview from "./pages/PlatformPreview.jsx";
import Contact from "./pages/Contact.jsx";

import Navbar from "./components/Navbar.jsx";
import Footer from "./components/Footer.jsx";

import "./App.css";


function PublicLayout({ children }) {
  return (
    <>
      <Navbar />
      {children}
      <Footer />
    </>
  );
}


export default function App() {
  return (
    <Routes>

      {/* Home */}
      <Route
        path="/"
        element={
          <PublicLayout>
            <Home />
          </PublicLayout>
        }
      />

      <Route
        path="/home"
        element={
          <PublicLayout>
            <Home />
          </PublicLayout>
        }
      />


      {/* Public Pages */}
      <Route
        path="/about"
        element={
          <PublicLayout>
            <About />
          </PublicLayout>
        }
      />

      <Route
        path="/contact"
        element={
          <PublicLayout>
            <Contact />
          </PublicLayout>
        }
      />

      <Route
        path="/preview"
        element={
            <PlatformPreview />
        }
      />


      {/* Authentication */}
      <Route
        path="/login"
        element={<Auth initialMode="login" />}
      />

      <Route
        path="/signup"
        element={<Auth initialMode="signup" />}
      />

    </Routes>
  );
}