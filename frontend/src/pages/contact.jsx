
import { useState } from "react";


export default function Contact() {
  const [showSupport, setShowSupport] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    issueType: "",
    message: "",
  });

  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setLoading(true);

    try {
      const response = await fetch("http://localhost:5000/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        alert("Your support request has been sent successfully!");

        setFormData({
          name: "",
          email: "",
          issueType: "",
          message: "",
        });

        setShowSupport(false);
      } else {
        alert(data.message || "Failed to send support request.");
      }
    } catch (error) {
      console.error("Error:", error);
      alert(
        "Unable to connect to the server. Please make sure your backend is running."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="contact-page">
   
      <section className="contact-hero">
        <div className="contact-overlay"></div>

        <div className="contact-hero-content">
          <h1>Get in touch</h1>

          <p>
            Want to connect with the Kolkata Smart City team?
            We're here to listen, help and make our city better together.
          </p>
        </div>
      </section>

      <section className="contact-cards">

        <div className="contact-card">

          <div className="contact-icon">
            📞
          </div>

          <h2>Talk to City Team</h2>

          <p>
            Have a question about smart city services or want to
            share an idea? Our team is ready to help.
          </p>

          <a
            href="tel:+913312345678"
            className="contact-info"
          >
            +91 33 1234 5678
          </a>

          <a
            href="https://mail.google.com/mail/?view=cm&fs=1&to=supportsmartkolkata@gmail.com"
            target="_blank"
            rel="noopener noreferrer"
            className="contact-link"
          >
            Send us an email
          </a>

        </div>

        <div className="contact-card">

          <div className="contact-icon">
            💬
          </div>

          <h2>Citizen Support</h2>

          <p>
            Facing an issue with a city service? Report your problem
            and our support team will help you.
          </p>

          <button
            className="support-btn"
            onClick={() => setShowSupport(true)}
          >
            Contact Support
          </button>

        </div>

      </section>

      <section className="contact-bottom">

        <h2>We're here to help Kolkata</h2>

        <p>
          Your feedback, suggestions and reports help us build a
          cleaner, safer and smarter city.
        </p>

        <div className="contact-details">

          <div>
            <strong>📍 Office</strong>
            <span>Kolkata, West Bengal</span>
          </div>

          <div>
            <strong>✉ Email</strong>
            <span>supportsmartkolkata@gmail.com</span>
          </div>

          <div>
            <strong>☎ Helpline</strong>
            <span>1800-123-4567</span>
          </div>

        </div>

      </section>

      {showSupport && (
        <div
          className="support-modal"
          onClick={() => setShowSupport(false)}
        >

          <div
            className="support-modal-box"
            onClick={(e) => e.stopPropagation()}
          >

            <div className="support-modal-header">

              <div>
                <h2>Citizen Support</h2>

                <p>
                  Tell us how we can help you.
                </p>
              </div>

              <button
                className="close-modal"
                onClick={() => setShowSupport(false)}
              >
                ×
              </button>

            </div>

            <form onSubmit={handleSubmit}>

              <div className="form-group">

                <label>Name</label>

                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Enter your name"
                  required
                />

              </div>

              <div className="form-group">

                <label>Email</label>

                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Enter your email"
                  required
                />

              </div>

              <div className="form-group">

                <label>Issue Type</label>

                <select
                  name="issueType"
                  value={formData.issueType}
                  onChange={handleChange}
                  required
                >

                     <option value="">
      Select a topic
    </option>


                  <option value="account">
      Account / Sign In Problem
    </option>

    <option value="registration">
      Registration / Sign Up Problem
    </option>

    <option value="password">
      Password / Account Recovery
    </option>

    <option value="technical">
      Technical Problem
    </option>

    <option value="website">
      Website / App Problem
    </option>

    <option value="feedback">
      Feedback / Suggestion
    </option>

    <option value="other">
      Other
    </option>
                </select>

              </div>

              <div className="form-group">

                <label>Message</label>

                <textarea
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  rows="4"
                  placeholder="Describe your problem..."
                  required
                ></textarea>

              </div>

              <div className="modal-actions">

                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => setShowSupport(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="send-btn"
                  disabled={loading}
                >
                  {loading ? "Sending..." : "Send Request"}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

    </main>
  );
}

