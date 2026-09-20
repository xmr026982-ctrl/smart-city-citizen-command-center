import { useState } from "react";


export default function Contact() {
  const [showSupport, setShowSupport] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();

    alert("Your support request has been submitted!");

    setShowSupport(false);
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

        {/* Talk to City Team */}
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
            href="mailto:info@smartkolkata.com"
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

          {/* OPEN POPUP */}
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
            <span>support@smartkolkata.com</span>
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

          {/* Popup Box */}
          <div
            className="support-modal-box"
            onClick={(e) => e.stopPropagation()}
          >

            {/* Header */}
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
                  placeholder="Enter your name"
                  required
                />

              </div>


              <div className="form-group">

                <label>Email</label>

                <input
                  type="email"
                  placeholder="Enter your email"
                  required
                />

              </div>


              <div className="form-group">

                <label>Issue Type</label>

                <select required>

                  <option value="">
                    Select an issue
                  </option>

                  <option>
                    Road / Street
                  </option>

                  <option>
                    Garbage / Waste
                  </option>

                  <option>
                    Water Supply
                  </option>

                  <option>
                    Electricity
                  </option>

                  <option>
                    Public Transport
                  </option>

                  <option>
                    Other
                  </option>

                </select>

              </div>


              <div className="form-group">

                <label>Message</label>

                <textarea
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
                >
                  Send Request
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

    </main>
  );
}