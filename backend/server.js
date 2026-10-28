<<<<<<< HEAD
const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");
require("dotenv").config();

const connectDB = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const staffRoutes = require("./routes/staffRoutes");
const adminRoutes = require("./routes/adminRoutes");
const staffRequestRoutes = require("./routes/staffRequestRoutes");

const app = express();

const PORT = process.env.PORT || 5000;

// Connect MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());


// =========================
// SMTP
// =========================

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD,
  },
});

transporter.verify((error, success) => {
  if (error) {
    console.log("SMTP Error:", error);
  } else {
    console.log("SMTP server is ready");
  }
});


// =========================
// CONTACT API
// =========================

app.post("/api/contact", async (req, res) => {
  console.log("CONTACT API CALLED");
  console.log("Received data:", req.body);

  try {
    const {
      name,
      email,
      issueType,
      message
    } = req.body;

    if (!name || !email || !issueType || !message) {
      return res.status(400).json({
        success: false,
        message: "Please fill all fields.",
      });
    }

    const mailOptions = {
      from: process.env.SMTP_EMAIL,
      to: process.env.SUPPORT_EMAIL,

      subject: `Smart City Support - ${issueType}`,

      html: `
        <h2>New Citizen Support Request</h2>

        <p><strong>Name:</strong> ${name}</p>

        <p><strong>Email:</strong> ${email}</p>

        <p><strong>Issue Type:</strong> ${issueType}</p>

        <h3>Message</h3>

        <p>${message}</p>

        <hr>

        <p>
          Sent from Kolkata Smart City Contact Support.
        </p>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({
      success: true,
      message: "Your support request has been sent successfully!",
    });

  } catch (error) {
    console.error("Email error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to send email.",
    });
  }
});


// =========================
// JWT AUTH ROUTES
// =========================

app.use("/api/auth", authRoutes);


// =========================
// USER ROUTES
// =========================

app.use("/api/users", userRoutes);


// =========================
// STAFF ROUTES
// =========================

app.use("/api/staff", staffRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/staff-requests", staffRequestRoutes);

// =========================
// HOME
// =========================

app.get("/", (req, res) => {
  res.send("Smart City Backend is running!");
});


// =========================
// START SERVER
// =========================

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
=======

const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");
const path = require("path");

// =========================
// LOAD BACKEND .ENV FIRST
// =========================

const envPath = path.resolve(__dirname, ".env");

const dotenvResult = require("dotenv").config({
  path: envPath,
});

console.log("Backend .env path:", envPath);
console.log(
  "Backend .env loaded:",
  !dotenvResult.error
);

// Never print actual credentials.
console.log("Admin environment status:", {
  emailExists: Boolean(process.env.ADMIN_EMAIL?.trim()),
  passwordExists: Boolean(process.env.ADMIN_PASSWORD),
  passwordHasTwoSpecialCharacters:
    typeof process.env.ADMIN_PASSWORD === "string" &&
    (process.env.ADMIN_PASSWORD.match(/[^A-Za-z0-9]/g) || [])
      .length >= 2,
});

// =========================
// IMPORT ROUTES AND DATABASE
// .ENV IS LOADED BEFORE THESE
// =========================

const connectDB = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const staffRoutes = require("./routes/staffRoutes");
const adminRoutes = require("./routes/adminRoutes");
const staffRequestRoutes = require("./routes/staffRequestRoutes");

const app = express();

const PORT = process.env.PORT || 5000;

// =========================
// MIDDLEWARE
// =========================

app.use(cors());
app.use(express.json());

// =========================
// CONNECT MONGODB
// =========================

connectDB();

// =========================
// SMTP CONFIGURATION
// =========================

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD,
  },
});

transporter.verify((error) => {
  if (error) {
    console.error("SMTP connection failed:", error.message);
  } else {
    console.log("SMTP server is ready");
  }
});

// =========================
// CONTACT API
// =========================

app.post("/api/contact", async (req, res) => {
  try {
    const { name, email, issueType, message } = req.body;

    if (
      !name?.trim?.() ||
      !email?.trim?.() ||
      !issueType?.trim?.() ||
      !message?.trim?.()
    ) {
      return res.status(400).json({
        success: false,
        message: "Please fill all fields.",
      });
    }

    if (!process.env.SUPPORT_EMAIL || !process.env.SMTP_EMAIL) {
      console.error("Contact email configuration is missing.");

      return res.status(500).json({
        success: false,
        message: "Email service is not configured.",
      });
    }

    const mailOptions = {
      from: process.env.SMTP_EMAIL,
      to: process.env.SUPPORT_EMAIL,
      replyTo: email.trim(),
      subject: `Smart City Support - ${issueType.trim()}`,

      // Escape user input before inserting it into HTML.
      html: `
        <h2>New Citizen Support Request</h2>
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Issue Type:</strong> ${escapeHtml(issueType)}</p>
        <h3>Message</h3>
        <p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>
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
      message: "Failed to send email.",
    });
  }
});

// Escape HTML characters supplied by users.
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

// =========================
// AUTH ROUTES
// =========================

app.use("/api/auth", authRoutes);

// =========================
// USER ROUTES
// =========================

app.use("/api/users", userRoutes);

// =========================
// STAFF ROUTES
// =========================

app.use("/api/staff", staffRoutes);

// =========================
// ADMIN ROUTES
// =========================

app.use("/api/admin", adminRoutes);

// =========================
// STAFF REQUEST ROUTES
// =========================

app.use("/api/staff-requests", staffRequestRoutes);

// =========================
// HOME / HEALTH CHECK
// =========================

app.get("/", (req, res) => {
  res.status(200).send("Smart City Backend is running!");
});

// =========================
// START SERVER
// =========================

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
>>>>>>> f899dda (Fix admin login configuration)
