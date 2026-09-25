const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");
require("dotenv").config();

const app = express();

const PORT = 5000;


app.use(cors());
app.use(express.json());


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


app.get("/", (req, res) => {
  res.send("Smart City Backend is running!");
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
