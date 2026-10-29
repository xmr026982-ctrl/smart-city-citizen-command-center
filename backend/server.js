
const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");
const path = require("path");

// Load backend .env
const envPath = path.resolve(__dirname, ".env");

const dotenvResult = require("dotenv").config({
  path: envPath,
});

console.log("Backend .env path:", envPath);
console.log("Backend .env loaded:", !dotenvResult.error);

// Never print actual credentials.


// =====================================
// IMPORT DATABASE AND ROUTES
// =====================================

const connectDB = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const staffRoutes = require("./routes/staffRoutes");
const adminRoutes = require("./routes/adminRoutes");
const staffRequestRoutes = require("./routes/staffRequestRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

// =====================================
// MIDDLEWARE
// =====================================

// Configure allowed frontend origins.
// FRONTEND_URL can contain comma-separated URLs.
const allowedOrigins = (
  process.env.FRONTEND_URL || "http://localhost:5173"
)
  .split(",")
  .map((origin) => origin.trim().replace(/\/+$/, ""))
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Permit requests without an Origin header, such as Postman.
      if (!origin) {
        return callback(null, true);
      }

      const normalizedOrigin = origin.replace(/\/+$/, "");

      if (allowedOrigins.includes(normalizedOrigin)) {
        return callback(null, true);
      }

      return callback(new Error("Origin not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// =====================================
// SMTP CONFIGURATION
// =====================================

let transporter = null;

if (process.env.SMTP_EMAIL && process.env.SMTP_PASSWORD) {
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.SMTP_EMAIL,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  // Verify SMTP without blocking server startup.
  transporter.verify((error) => {
    if (error) {
      console.error("SMTP connection failed:", error.message);
    } else {
      console.log("SMTP server is ready");
    }
  });
} else {
  console.warn(
    "SMTP credentials are missing. Contact email will be unavailable."
  );
}

// =====================================
// HTML ESCAPING
// =====================================

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character];
  });
}

// =====================================
// HEALTH CHECK
// =====================================

app.get("/", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Smart City Backend is running!",
    status: "OK",
  });
});

// =====================================
// CONTACT SUPPORT API
// POST /api/contact
// =====================================

app.post("/api/contact", async (req, res) => {
  try {
    const { name, email, issueType, message } = req.body || {};

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof issueType !== "string" ||
      typeof message !== "string" ||
      !name.trim() ||
      !email.trim() ||
      !issueType.trim() ||
      !message.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Please fill all fields.",
      });
    }

    if (!transporter || !process.env.SUPPORT_EMAIL) {
      console.error("Contact email configuration is missing.");

      return res.status(503).json({
        success: false,
        message: "Email service is currently unavailable.",
      });
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim();
    const cleanIssueType = issueType.trim();
    const cleanMessage = message.trim();

    // Basic email format validation.
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(cleanEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address.",
      });
    }

    const mailOptions = {
      from: process.env.SMTP_EMAIL,
      to: process.env.SUPPORT_EMAIL,
      replyTo: cleanEmail,
      subject: `Smart City Support - ${cleanIssueType}`,
      html: `
        <h2>New Citizen Support Request</h2>
        <p><strong>Name:</strong> ${escapeHtml(cleanName)}</p>
        <p><strong>Email:</strong> ${escapeHtml(cleanEmail)}</p>
        <p><strong>Issue Type:</strong> ${escapeHtml(cleanIssueType)}</p>
        <h3>Message</h3>
        <p>${escapeHtml(cleanMessage).replace(/\r?\n/g, "<br>")}</p>
        <hr>
        <p>Sent from Kolkata Smart City Contact Support.</p>
      `,
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({
      success: true,
      message: "Your support request has been sent successfully!",
    });
  } catch (error) {
    console.error("Contact email error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to send email. Please try again later.",
    });
  }
});

// =====================================
// API ROUTES
// =====================================

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/staff-requests", staffRequestRoutes);

// =====================================
// NOT FOUND HANDLER
// =====================================

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: "API endpoint not found.",
    path: req.originalUrl,
  });
});

// =====================================
// GLOBAL ERROR HANDLER
// =====================================

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error.type === "entity.parse.failed") {
    return res.status(400).json({
      success: false,
      message: "Invalid JSON request body.",
    });
  }

  if (error.message === "Origin not allowed by CORS") {
    return res.status(403).json({
      success: false,
      message: "This origin is not allowed.",
    });
  }

  console.error("Server error:", error.message);

  return res.status(500).json({
    success: false,
    message: "Internal server error.",
  });
});

// =====================================
// START SERVER AFTER DATABASE CONNECTS
// =====================================

const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`Smart City Backend running on port ${PORT}`);
      console.log("MongoDB connection established.");
    });
  } catch (error) {
    console.error("Failed to start backend:", error.message);
    process.exit(1);
  }
};

startServer();