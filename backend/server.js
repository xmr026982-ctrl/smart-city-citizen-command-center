const http = require("http");
const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");
const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

// Load backend .env
const envPath = path.resolve(__dirname, ".env");

const dotenvResult = dotenv.config({
  path: envPath,
  quiet: true,
});

// Force a strong JWT secret
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error(
    "FATAL: JWT_SECRET must be set and at least 32 characters long"
  );
  process.exit(1);
}

// Import modules that may use environment variables.
const { initializeSocket } = require("./socket/socket");

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
const policyRoutes = require("./routes/policyRoutes");
const auditRoutes = require("./routes/auditRoutes");
const staffRequestRoutes = require("./routes/staffRequestRoutes");
const issueRoutes = require("./routes/issueRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const communityRoutes = require("./routes/communityRoutes");
const metricsRoutes = require("./routes/metricsRoutes");
const { startCityMetricsPolling } = require("./services/cityMetricsService");

const app = express();
const PORT = process.env.PORT || 5000;

/* Behind a hosting proxy (Render, Railway, Azure, Nginx) every request
   arrives from the proxy's address. TRUST_PROXY=1 makes Express read the
   visitor's real address from X-Forwarded-For, so rate limits and lockouts
   apply per visitor instead of to everyone at once. Leave it unset locally. */
const trustProxy = String(process.env.TRUST_PROXY || "").trim();
if (trustProxy) {
  app.set("trust proxy", /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy === "true" ? true : trustProxy);
}

// =====================================
// MIDDLEWARE
// =====================================

// Configure allowed frontend origins.
// FRONTEND_URL can contain comma-separated URLs.
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const multer = require("multer");
const sanitize = require("./middleware/sanitize");

// ... after app = express()

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },
  })
);

// Basic rate limit for public endpoints
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,         // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later." },
});

// Rate limits by IP on the public endpoints people could abuse (contract A2 §4, A3).
// Signed-in calls like /auth/me and /auth/activity are not limited here.
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many messages from here. Try again in an hour." },
});
["/api/auth/login", "/api/auth/register", "/api/auth/google", "/api/auth/forgot-password", "/api/auth/reset-password", "/api/auth/confirm-email", "/api/staff-requests/setup", "/api/staff-requests/set-password"].forEach((route) => app.use(route, publicLimiter));
app.post("/api/staff-requests", publicLimiter);
app.use("/api/contact", contactLimiter);

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
app.use(sanitize); // strips $-operators from bodies (express-mongo-sanitize does not work with Express 5)

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
    message: "Smart Kolkata API is running",
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
      subject: `Smart Kolkata Support - ${cleanIssueType}`,
      html: `
        <h2>New Citizen Support Request</h2>
        <p><strong>Name:</strong> ${escapeHtml(cleanName)}</p>
        <p><strong>Email:</strong> ${escapeHtml(cleanEmail)}</p>
        <p><strong>Issue Type:</strong> ${escapeHtml(cleanIssueType)}</p>
        <h3>Message</h3>
        <p>${escapeHtml(cleanMessage).replace(/\r?\n/g, "<br>")}</p>
        <hr>
        <p>Sent from the Smart Kolkata support page.</p>
      `,
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({
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
app.use("/api/policy", policyRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/staff-requests", staffRequestRoutes);

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Smart Kolkata API is running",
    database:
      mongoose.connection.readyState === 1
        ? "connected"
        : "disconnected",
    timestamp: new Date().toISOString(),
  });
});

// Issue management routes
app.get("/api/public/board", publicLimiter, require("./controllers/publicController").getPublicBoard);
app.use("/api/issues", issueRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/community", communityRoutes);
app.use("/api/metrics", metricsRoutes);

app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"), {
    setHeaders: (res) => {
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    },
  })
);

// =====================================
// HEALTH CHECK
// =====================================

app.get("/health", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Smart Kolkata API is running",
    status: "OK",
  });
});

// =====================================
// NOT FOUND HANDLER
// =====================================

app.use((req, res) => {
  return res.status(404).json({
    message: "API endpoint not found."
  });
});

// =====================================
// GLOBAL ERROR HANDLER
// =====================================

app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      message:
        err.code === "LIMIT_FILE_SIZE"
          ? "Each photo must be 5 MB or smaller."
          : err.code === "LIMIT_FILE_COUNT"
            ? "You can upload a maximum of 3 photos."
            : "The photo upload is invalid."
    });
  }

  const status = Number.isInteger(err.status) ? err.status : 500;

  if (status >= 500) {
    console.error("API error:", err);
  }

  return res.status(status).json({
    message: status >= 500
      ? "Something went wrong. Please try again."
      : err.message
  });
});

// =====================================
// START SERVER AFTER DATABASE CONNECTS
// =====================================

const startServer = async () => {
  try {
    // Connect MongoDB first
    await connectDB();

    // Create HTTP server using Express
    const server = http.createServer(app);

    // Initialize Socket.io on the HTTP server
    initializeSocket(server);
    startCityMetricsPolling();

    // Start listening
    server.listen(PORT, () => {
      console.log(`Smart Kolkata API running on port ${PORT}`);
      console.log("MongoDB connection established.");
      console.log("Socket.io server initialized successfully.");
    });

  } catch (error) {
    console.error("Failed to start backend:", error.message);
    process.exit(1);
  }
};

startServer();