
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const StaffRequest = require("../models/StaffRequest");
const User = require("../models/User");
const {
  sendStaffPasswordSetupEmail,
} = require("../services/emailService");

// Hash the setup token before saving it in MongoDB.
const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

// POST /api/staff-requests
const submitStaffRequest = async (req, res) => {
  try {
    const {
  name,
  email,
  zone,
  note = "",
} = req.body;

// Keep both Experience and Expertise.
const Experience =
  req.body.Experience ?? req.body.qualification;

const Expertise =
  req.body.Expertise ?? req.body.department;

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof Experience !== "string" ||
      typeof Expertise !== "string" ||
      typeof zone !== "string" ||
      !name.trim() ||
      !email.trim() ||
      !Experience.trim() ||
      !Expertise.trim() ||
      !zone.trim()
    ) {
      return res.status(400).json({
        message:
          "Name, email, experience, expertise and zone are required.",
      });
    }

    if (typeof note !== "string") {
      return res.status(400).json({
        message: "Note must be text.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        message: "An account already exists with this email.",
      });
    }

    let request = await StaffRequest.findOne({
      email: normalizedEmail,
    });

    if (request && request.status !== "rejected") {
      return res.status(409).json({
        message: "A staff application already exists for this email.",
        status: request.status,
      });
    }

    if (request) {
      // Allow rejected applicants to apply again.
      request.name = name.trim();
      request.Experience = Experience.trim();
      request.Expertise = Expertise.trim();
      request.zone = zone.trim();
      request.note = note.trim();
      request.status = "pending";

      request.setupTokenHash = undefined;
      request.setupTokenExpiresAt = undefined;

      await request.save();
    } else {
      // Save every staff application field in MongoDB.
      request = await StaffRequest.create({
        name: name.trim(),
        email: normalizedEmail,
        Experience: Experience.trim(),
        Expertise: Expertise.trim(),
        zone: zone.trim(),
        note: note.trim(),
        status: "pending",
      });
    }

    return res.status(201).json({
      message: "Staff application submitted successfully.",
      applicationId: request._id,
      status: request.status,
    });
  } catch (error) {
    console.error("Staff application error:", error);

    return res.status(500).json({
      message: "Could not submit the staff application.",
    });
  }
};

// GET /api/staff-requests (admin only)
const getStaffRequests = async (req, res) => {
  try {
    const requests = await StaffRequest.find()
      .select("-setupTokenHash -setupTokenExpiresAt")
      .sort({ createdAt: -1 });

    return res.json({
      count: requests.length,
      requests,
    });
  } catch (error) {
    console.error("Get staff requests error:", error);

    return res.status(500).json({
      message: "Could not fetch staff applications.",
    });
  }
};

// PATCH /api/staff-requests/:id/approve (admin only)
const approveStaffRequest = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid application ID.",
      });
    }

    const request = await StaffRequest.findById(id);

    if (!request) {
      return res.status(404).json({
        message: "Application not found.",
      });
    }

    if (request.status !== "pending") {
      return res.status(409).json({
        message: "Only pending applications can be approved.",
      });
    }

    const existingUser = await User.findOne({
      email: request.email,
    });

    if (existingUser) {
      return res.status(409).json({
        message: "A user account already exists for this email.",
      });
    }

    // Generate a one-time password-setup token.
    const rawToken = crypto.randomBytes(32).toString("hex");

    request.status = "approved";
    request.setupTokenHash = hashToken(rawToken);
    request.setupTokenExpiresAt = new Date(
      Date.now() + 30 * 60 * 1000
    );

    await request.save();

    const frontendUrl = (
      process.env.FRONTEND_URL || "http://localhost:5173"
    ).replace(/\/+$/, "");

    const setupUrl =
      `${frontendUrl}/staff-setup?token=${encodeURIComponent(rawToken)}`;

    try {
      await sendStaffPasswordSetupEmail({
        name: request.name,
        email: request.email,
        setupUrl,
      });
    } catch (emailError) {
      // Restore pending status if the email could not be sent.
      request.status = "pending";
      request.setupTokenHash = undefined;
      request.setupTokenExpiresAt = undefined;

      await request.save();

      console.error("Staff setup email error:", emailError);

      return res.status(500).json({
        message: "Approval email failed to send. Please try again.",
      });
    }

    return res.json({
      message:
        "Staff application approved. Password setup email sent.",
    });
  } catch (error) {
    console.error("Approve staff request error:", error);

    return res.status(500).json({
      message: "Could not approve the application.",
    });
  }
};

// PATCH /api/staff-requests/:id/reject (admin only)
const rejectStaffRequest = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid application ID.",
      });
    }

    const request = await StaffRequest.findById(id);

    if (!request) {
      return res.status(404).json({
        message: "Application not found.",
      });
    }

    if (request.status !== "pending") {
      return res.status(409).json({
        message: "Only pending applications can be rejected.",
      });
    }

    request.status = "rejected";
    request.setupTokenHash = undefined;
    request.setupTokenExpiresAt = undefined;

    await request.save();

    return res.json({
      message: "Staff application rejected.",
    });
  } catch (error) {
    console.error("Reject staff request error:", error);

    return res.status(500).json({
      message: "Could not reject the application.",
    });
  }
};

// POST /api/staff-requests/set-password
const setStaffPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (
      typeof token !== "string" ||
      !token.trim() ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        message: "Setup token and password are required.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: "Password must be at least 8 characters.",
      });
    }

    const request = await StaffRequest.findOne({
      setupTokenHash: hashToken(token),
      setupTokenExpiresAt: { $gt: new Date() },
      status: "approved",
    }).select("+setupTokenHash +setupTokenExpiresAt");

    if (!request) {
      return res.status(400).json({
        message: "Setup link is invalid, expired or already used.",
      });
    }

    const existingUser = await User.findOne({
      email: request.email,
    });

    if (existingUser) {
      return res.status(409).json({
        message: "An account already exists for this email.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await User.create({
      name: request.name,
      email: request.email,
      password: hashedPassword,
      role: "staff",
      department: request.Expertise,
      isActive: true,
    });

    // Mark the setup token as used.
    request.status = "completed";
    request.setupTokenHash = undefined;
    request.setupTokenExpiresAt = undefined;

    await request.save();

    return res.status(201).json({
      message:
        "Password created successfully. You can now log in as staff.",
    });
  } catch (error) {
    console.error("Staff password setup error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        message: "An account already exists for this email.",
      });
    }

    return res.status(500).json({
      message: "Could not set up the staff account.",
    });
  }
};

module.exports = {
  submitStaffRequest,
  getStaffRequests,
  approveStaffRequest,
  rejectStaffRequest,
  setStaffPassword,
};