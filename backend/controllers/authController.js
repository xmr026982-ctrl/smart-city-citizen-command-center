
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const User = require("../models/User");
const PasswordResetToken = require("../models/PasswordResetToken");

const { generateToken } = require("../services/jwtService");
const {
  sendWelcomeEmail,
  sendPasswordResetEmail,
} = require("../services/emailService");

const { adminAuth } = require("../config/firebaseAdmin");
const { isValidCitizenZone } = require("../config/citizenZones");

// =========================
// HELPERS
// =========================

const getPublicUser = (user) => ({
  id: String(user._id),
  name: user.name,
  email: user.email,
  role: user.role,
  ward: user.ward || "",
  zone: user.zone || "",
});

const normalizeZone = (zone) =>
  typeof zone === "string" ? zone.trim() : "";

const validateCitizenZone = (zone) =>
  typeof zone === "string" && isValidCitizenZone(zone.trim());

const isMissingOrInvalidZone = (zone) =>
  !validateCitizenZone(zone);

// =========================
// REGISTER CITIZEN
// POST /api/auth/register
// =========================

const register = async (req, res) => {
  try {
    const { name, email, password, ward, zone } = req.body || {};

    // Temporary diagnostic log: confirms the submitted zone.
    console.log(
      "[Citizen Registration] Submitted zone:",
      JSON.stringify(zone)
    );

    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof email !== "string" ||
      !email.trim() ||
      typeof password !== "string" ||
      !password
    ) {
      return res.status(400).json({
        message: "Name, email and password are required.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: "Password must contain at least 8 characters.",
      });
    }

    const selectedZone = normalizeZone(zone);

    if (!validateCitizenZone(selectedZone)) {
      return res.status(400).json({
        message: "Please select a valid citizen zone.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        message: "An account with this email already exists.",
      });
    }

    // Create the citizen account with the selected zone.
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: await bcrypt.hash(password, 12),
      role: "citizen",
      ward: typeof ward === "string" ? ward.trim() : "",
      zone: selectedZone,
      isActive: true,
    });

    // Read the saved record back from MongoDB.
    const savedUser = await User.findById(user._id);

    console.log(
      "[Citizen Registration] Saved zone:",
      JSON.stringify(savedUser?.zone)
    );

    // Verify that the zone was actually persisted.
    if (
      !savedUser ||
      savedUser.role !== "citizen" ||
      !validateCitizenZone(savedUser.zone)
    ) {
      console.error(
        "[Citizen Registration] Saved-zone verification failed.",
        {
          userId: String(user._id),
          submittedZone: selectedZone,
          savedZone: savedUser?.zone,
        }
      );

      return res.status(500).json({
        message:
          "Registration could not verify your saved zone. Please contact support.",
      });
    }

    // Email failure must not undo a successfully saved account.
    try {
      await sendWelcomeEmail(savedUser);
    } catch (emailError) {
      console.error(
        "[Citizen Registration] Welcome email failed:",
        emailError.message
      );
    }

    return res.status(201).json({
      message: "Citizen registered successfully.",
      token: generateToken(savedUser),
      user: getPublicUser(savedUser),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "An account with this email already exists.",
      });
    }

    console.error(
      "[Citizen Registration] Error:",
      error.message
    );

    return res.status(500).json({
      message: "Registration failed. Please try again.",
    });
  }
};

// =========================
// LOGIN
// POST /api/auth/login
// CITIZEN, STAFF, MODERATOR, ADMIN
// =========================

const login = async (req, res) => {
  try {
    const { email, password, role, zone } = req.body || {};

    if (
      typeof email !== "string" ||
      !email.trim() ||
      typeof password !== "string" ||
      !password ||
      typeof role !== "string" ||
      !role.trim()
    ) {
      return res.status(400).json({
        message: "Email, password and role are required.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedRole = role.trim().toLowerCase();

    const databaseRole =
      normalizedRole === "user" ? "citizen" : normalizedRole;

    if (
      !["citizen", "staff", "moderator", "admin"].includes(
        databaseRole
      )
    ) {
      return res.status(400).json({
        message: "Invalid role.",
      });
    }

    // ADMIN LOGIN
    if (databaseRole === "admin") {
      const adminEmail = process.env.ADMIN_EMAIL;
      const adminPassword = process.env.ADMIN_PASSWORD;

      if (
        typeof adminEmail !== "string" ||
        !adminEmail.trim() ||
        typeof adminPassword !== "string" ||
        !adminPassword
      ) {
        return res.status(500).json({
          message: "Admin login is not configured correctly.",
        });
      }

      const normalizedAdminEmail = adminEmail.trim().toLowerCase();

      if (
        normalizedEmail !== normalizedAdminEmail ||
        password !== adminPassword
      ) {
        return res.status(401).json({
          message: "Invalid email, password or role.",
        });
      }

      const adminUser = await User.findOne({
        email: normalizedAdminEmail,
        role: "admin",
        isActive: { $ne: false },
      });

      if (!adminUser) {
        return res.status(403).json({
          message:
            "Admin account is not provisioned or is disabled.",
        });
      }

      return res.status(200).json({
        message: "Admin login successful.",
        token: generateToken(adminUser),
        user: getPublicUser(adminUser),
      });
    }

    // FIND CITIZEN, STAFF OR MODERATOR
    const user = await User.findOne({
      email: normalizedEmail,
      role: databaseRole,
    });

    if (!user || user.isActive === false) {
      return res.status(401).json({
        message: "Invalid email, password or role.",
      });
    }

    if (
      typeof user.password !== "string" ||
      !user.password ||
      !(await bcrypt.compare(password, user.password))
    ) {
      return res.status(401).json({
        message: "Invalid email, password or role.",
      });
    }

    // CITIZENS MUST HAVE A VALID SAVED ZONE.
    if (user.role === "citizen") {
      const selectedZone = normalizeZone(zone);

      if (selectedZone) {
        if (!validateCitizenZone(selectedZone)) {
          return res.status(400).json({
            message: "Please select a valid citizen zone.",
          });
        }

        user.zone = selectedZone;
        await user.save();

        // Confirm MongoDB persisted the updated zone.
        const savedUser = await User.findById(user._id);

        if (
          !savedUser ||
          !validateCitizenZone(savedUser.zone)
        ) {
          return res.status(500).json({
            message:
              "Your zone could not be saved. Please try again.",
          });
        }

        return res.status(200).json({
          message: "Login successful.",
          token: generateToken(savedUser),
          user: getPublicUser(savedUser),
        });
      }

      // Legacy accounts may not have a zone.
      if (isMissingOrInvalidZone(user.zone)) {
        return res.status(200).json({
          requiresZone: true,
          message: "Please select your zone to continue.",
          email: user.email,
        });
      }
    }

    return res.status(200).json({
      message: "Login successful.",
      token: generateToken(user),
      user: getPublicUser(user),
    });
  } catch (error) {
    console.error("[Login] Error:", error.message);

    return res.status(500).json({
      message: "Login failed. Please try again.",
    });
  }
};

// =========================
// GOOGLE LOGIN / SIGNUP
// POST /api/auth/google
// CITIZENS ONLY
// =========================

const googleLogin = async (req, res) => {
  try {
    const { idToken, zone } = req.body || {};

    console.log(
      "[Google Authentication] Submitted zone:",
      JSON.stringify(zone)
    );

    if (typeof idToken !== "string" || !idToken.trim()) {
      return res.status(400).json({
        message: "Google ID token is required.",
      });
    }

    const decodedToken = await adminAuth.verifyIdToken(idToken);

    if (
      !decodedToken.email ||
      decodedToken.email_verified !== true
    ) {
      return res.status(401).json({
        message: "Please use a verified Google email address.",
      });
    }

    const email = decodedToken.email.trim().toLowerCase();
    const name = decodedToken.name || email.split("@")[0];
    const selectedZone = normalizeZone(zone);

    let user = await User.findOne({ email });

    if (user && user.role !== "citizen") {
      return res.status(403).json({
        message:
          "This email belongs to another account type. Use the appropriate login method.",
      });
    }

    if (user && user.isActive === false) {
      return res.status(403).json({
        message: "This account is disabled. Please contact support.",
      });
    }

    if (selectedZone && !validateCitizenZone(selectedZone)) {
      return res.status(400).json({
        message: "Please select a valid citizen zone.",
      });
    }

    // New Google accounts must select a zone.
    if (!user && !validateCitizenZone(selectedZone)) {
      return res.status(200).json({
        requiresZone: true,
        message: "Please select your zone to continue.",
        email,
      });
    }

    // Existing accounts with an invalid zone must select one.
    if (
      user &&
      isMissingOrInvalidZone(user.zone) &&
      !validateCitizenZone(selectedZone)
    ) {
      return res.status(200).json({
        requiresZone: true,
        message: "Please select your zone to continue.",
        email,
      });
    }

    if (!user) {
      const randomPassword = crypto.randomBytes(48).toString("hex");

      user = await User.create({
        name,
        email,
        password: await bcrypt.hash(randomPassword, 12),
        role: "citizen",
        zone: selectedZone,
        isActive: true,
      });
    } else if (selectedZone) {
      user.zone = selectedZone;
      await user.save();
    }

    // Reload to ensure the response uses the persisted record.
    user = await User.findById(user._id);

    console.log(
      "[Google Authentication] Saved zone:",
      JSON.stringify(user?.zone)
    );

    if (!user || isMissingOrInvalidZone(user.zone)) {
      return res.status(500).json({
        message: "Your account does not have a valid saved zone.",
      });
    }

    return res.status(200).json({
      message: "Google sign-in successful.",
      token: generateToken(user),
      user: getPublicUser(user),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message:
          "An account with this email already exists. Please sign in again.",
      });
    }

    console.error("[Google Authentication] Error:", error.message);

    return res.status(401).json({
      message: "Google sign-in failed. Please try again.",
    });
  }
};

// =========================
// FORGOT PASSWORD
// POST /api/auth/forgot-password
// =========================

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body || {};

    const safeMessage =
      "If an account exists for that email, a password reset link will be sent.";

    if (typeof email !== "string" || !email.trim()) {
      return res.status(200).json({
        message: safeMessage,
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
      isActive: { $ne: false },
    });

    if (!user) {
      return res.status(200).json({
        message: safeMessage,
      });
    }

    await PasswordResetToken.deleteMany({
      userId: user._id,
    });

    const rawToken = crypto.randomBytes(32).toString("hex");

    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    await PasswordResetToken.create({
      userId: user._id,
      tokenHash,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    const frontendUrl = process.env.FRONTEND_URL;

    if (
      typeof frontendUrl !== "string" ||
      !frontendUrl.trim()
    ) {
      await PasswordResetToken.deleteMany({
        userId: user._id,
      });

      throw new Error("FRONTEND_URL is not configured.");
    }

    const baseUrl = frontendUrl.trim().replace(/\/+$/, "");

    const resetUrl =
      `${baseUrl}/reset-password?token=${rawToken}`;

    try {
      await sendPasswordResetEmail(user, resetUrl);
    } catch (emailError) {
      await PasswordResetToken.deleteMany({
        userId: user._id,
      });

      throw emailError;
    }

    return res.status(200).json({
      message: safeMessage,
    });
  } catch (error) {
    console.error("[Forgot Password] Error:", error.message);

    return res.status(500).json({
      message:
        "Unable to process your request right now. Please try again.",
    });
  }
};

// =========================
// RESET PASSWORD
// POST /api/auth/reset-password/:token
// =========================

const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password, confirmPassword } = req.body || {};

    if (
      typeof token !== "string" ||
      !/^[a-f0-9]{64}$/i.test(token)
    ) {
      return res.status(400).json({
        message:
          "This reset link is invalid or expired. Request a new one.",
      });
    }

    if (
      typeof password !== "string" ||
      typeof confirmPassword !== "string" ||
      password.length < 8 ||
      password !== confirmPassword
    ) {
      return res.status(400).json({
        message:
          "Passwords must match and contain at least 8 characters.",
      });
    }

    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const resetRecord = await PasswordResetToken.findOne({
      tokenHash,
      expiresAt: { $gt: new Date() },
    });

    if (!resetRecord) {
      return res.status(400).json({
        message:
          "This reset link is invalid or expired. Request a new one.",
      });
    }

    const user = await User.findById(resetRecord.userId);

    if (!user || user.isActive === false) {
      await PasswordResetToken.deleteOne({
        _id: resetRecord._id,
      });

      return res.status(400).json({
        message: "This account cannot reset its password.",
      });
    }

    user.password = await bcrypt.hash(password, 12);
    await user.save();

    await PasswordResetToken.deleteMany({
      userId: user._id,
    });

    return res.status(200).json({
      message:
        "Password changed successfully. Please sign in with your new password.",
    });
  } catch (error) {
    console.error("[Reset Password] Error:", error.message);

    return res.status(500).json({
      message:
        "Unable to reset your password right now. Please try again.",
    });
  }
};

// =========================
// EXPORT CONTROLLERS
// =========================

module.exports = {
  register,
  login,
  googleLogin,
  forgotPassword,
  resetPassword,
};
