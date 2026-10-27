import { useState } from "react";

const helpResponses = {
  account: {
    title: "Account / Sign In Help",
    message:
      "Check that your email and password are correct and that you selected the correct account type. If you still cannot sign in, describe the error below and submit a support request.",
  },
  registration: {
    title: "Registration Help",
    message:
      "Make sure all required fields are filled in and your email address is valid. If registration still fails, describe the error you see.",
  },
  password: {
    title: "Password Recovery Help",
    message:
      "Use the Forgot password option on the login page if available. Follow the secure password-reset instructions. Never share your password or OTP in this form.",
  },
  technical: {
    title: "Technical Support",
    message:
      "Try refreshing the page and checking your internet connection. If the problem continues, describe what you were doing when it occurred.",
  },
  website: {
    title: "Website / App Help",
    message:
      "Try refreshing the website. If a page or button is not working, tell us which page you were using and what happened.",
  },
  feedback: {
    title: "Feedback and Suggestions",
    message:
      "We welcome your ideas for improving Smart City services. Describe your suggestion in the message field below.",
  },
  other: {
    title: "Other Support",
    message:
      "Please explain your problem clearly below so your support request can be reviewed.",
  },
};

export default function Contact() {
  const [showSupport, setShowSupport] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    issueType: "",
    message: "",
  });

  const [loading, setLoading] = useState(false);
  const [responseMessage, setResponseMessage] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));

    setResponseMessage("");
  };

  const closeSupport = () => {
    if (loading) return;

    setShowSupport(false);
    setResponseMessage("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResponseMessage("");

    try {
      const response = await fetch("http://localhost:5000/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setResponseMessage(
          "Your support request was sent successfully! Please check your email if a confirmation was configured."
        );

        setFormData({
          name: "",
          email: "",
          issueType: "",
          message: "",
        });
      } else {
        setResponseMessage(
          data.message || "Failed to send your support request. Please try again."
        );
      }
    } catch (error) {
      console.error("Contact request error:", error);

      setResponseMessage(
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
          <div className="contact-icon">📞</div>

          <h2>Talk to City Team</h2>

          <p>
            Have a question about smart city services or want to
            share an idea? Our team is ready to help.
          </p>

          <a href="tel:+913312345678" className="contact-info">
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
          <div className="contact-icon">💬</div>

          <h2>Citizen Support</h2>

          <p>
            Having trouble signing in, recovering your account, or using
            a city service? Select your problem to get automatic help.
          </p>

          <button
            type="button"
            className="support-btn"
            onClick={() => {
              setShowSupport(true);
              setResponseMessage("");
            }}
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
          onClick={closeSupport}
        >
          <div
            className="support-modal-box"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="support-modal-header">
              <div>
                <h2>Citizen Support</h2>

                <p>
                  Select your problem to see automatic help.
                </p>
              </div>

              <button
                type="button"
                className="close-modal"
                onClick={closeSupport}
                disabled={loading}
                aria-label="Close support form"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="support-name">Name</label>

                <input
                  id="support-name"
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Enter your name"
                  autoComplete="name"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="support-email">Email</label>

                <input
                  id="support-email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Enter your email"
                  autoComplete="email"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="support-issue">Issue Type</label>

                <select
                  id="support-issue"
                  name="issueType"
                  value={formData.issueType}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select a topic</option>

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

                {formData.issueType && helpResponses[formData.issueType] && (
                  <div
                    className="automatic-help"
                    role="status"
                    aria-live="polite"
                  >
                    <strong>
                      🤖 {helpResponses[formData.issueType].title}
                    </strong>

                    <p>
                      {helpResponses[formData.issueType].message}
                    </p>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="support-message">
                  Describe your problem
                </label>

                <textarea
                  id="support-message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  rows="4"
                  placeholder="Describe what happened..."
                  required
                ></textarea>

                <small>
                  Do not include your password, OTP, or account recovery codes.
                </small>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={closeSupport}
                  disabled={loading}
                >
                  Close
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

            {responseMessage && (
              <p className="support-status" role="status" aria-live="polite">
                {responseMessage}
              </p>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
