<<<<<<< HEAD

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

// =========================
// REGISTER CITIZEN MANUALLY
// =========================
const register = async (req, res) => {
  try {
    const { name, email, password, ward } = req.body;

    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof email !== "string" ||
      !email.trim() ||
      typeof password !== "string" ||
      !password
    ) {
      return res.status(400).json({
        message: "Name, email and password are required",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: "Password must contain at least 8 characters",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        message: "An account with this email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: "citizen",
      ward: typeof ward === "string" ? ward.trim() : "",
      isActive: true,
    });

    const token = generateToken(user);

    return res.status(201).json({
      message: "Citizen registered successfully",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        ward: user.ward,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "An account with this email already exists",
      });
    }

    console.error("Registration Error:", error.message);

    return res.status(500).json({
      message: "Registration failed",
    });
  }
};

// =========================
// MANUAL LOGIN
// CITIZEN, STAFF, MODERATOR, ADMIN
// =========================
const login = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      typeof role !== "string" ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        message: "Email, password and role are required",
      });
    }

    const databaseRole = role === "user" ? "citizen" : role;

    if (
      !["citizen", "staff", "moderator", "admin"].includes(databaseRole)
    ) {
      return res.status(400).json({
        message: "Invalid role",
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
      role: databaseRole,
    });

    if (!user || user.isActive === false) {
      return res.status(401).json({
        message: "Invalid email, password or role",
      });
    }

    const passwordMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatch) {
      return res.status(401).json({
        message: "Invalid email, password or role",
      });
    }

    const token = generateToken(user);

    // Email failure must not prevent login.
    try {
      await sendWelcomeEmail(user);
    } catch (emailError) {
      console.error("Welcome email failed:", emailError.message);
    }

    return res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        ward: user.ward,
      },
    });
  } catch (error) {
    console.error("Login Error:", error.message);

    return res.status(500).json({
      message: "Login failed",
    });
  }
};

// =========================
// GOOGLE LOGIN / SIGNUP
// CITIZENS ONLY
// =========================
const googleLogin = async (req, res) => {
  try {
    const { idToken } = req.body;

    if (typeof idToken !== "string" || !idToken) {
      return res.status(400).json({
        message: "Google ID token is required",
      });
    }

    const decodedToken = await adminAuth.verifyIdToken(idToken);

    if (!decodedToken.email || decodedToken.email_verified !== true) {
      return res.status(401).json({
        message: "Please use a verified Google email address",
      });
    }

    const email = decodedToken.email.trim().toLowerCase();
    const name = decodedToken.name || email.split("@")[0];

    let user = await User.findOne({ email });

    if (user) {
      // Google sign-in must not grant staff/admin access.
      if (user.role !== "citizen") {
        return res.status(403).json({
          message:
            "This email belongs to a non-citizen account. Please use the appropriate login method.",
        });
      }

      if (user.isActive === false) {
        return res.status(403).json({
          message: "This account is disabled. Please contact support.",
        });
      }
    } else {
      // Create an unusable random password for a Google-only citizen.
      const randomPassword = crypto.randomBytes(48).toString("hex");
      const hashedPassword = await bcrypt.hash(randomPassword, 12);

      user = await User.create({
        name,
        email,
        password: hashedPassword,
        role: "citizen",
        isActive: true,
      });
    }

    const token = generateToken(user);

    return res.json({
      message: "Google sign-in successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        ward: user.ward,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message:
          "An account with this email already exists. Please try signing in again.",
      });
    }

    console.error("Google Login Error:", error.message);

    return res.status(401).json({
      message: "Google sign-in failed. Please try again.",
    });
  }
};

// =========================
// FORGOT PASSWORD
// CITIZEN, STAFF, MODERATOR, ADMIN
// =========================
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const safeMessage =
      "If an account exists for that email, a password reset link will be sent.";

    if (typeof email !== "string" || !email.trim()) {
      return res.status(200).json({ message: safeMessage });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({
      email: normalizedEmail,
      isActive: { $ne: false },
    });

    // Don't disclose whether an email is registered.
    if (!user) {
      return res.status(200).json({ message: safeMessage });
    }

    // Remove previous outstanding reset links for this account.
    await PasswordResetToken.deleteMany({ userId: user._id });

    const rawToken = crypto.randomBytes(32).toString("hex");

    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await PasswordResetToken.create({
      userId: user._id,
      tokenHash,
      expiresAt,
    });

    const frontendUrl = process.env.FRONTEND_URL;

    if (!frontendUrl) {
      await PasswordResetToken.deleteMany({ userId: user._id });
      throw new Error("FRONTEND_URL is not configured");
    }

    const resetUrl =
      `${frontendUrl.replace(/\/$/, "")}/reset-password?token=${rawToken}`;

    try {
      await sendPasswordResetEmail(user, resetUrl);
    } catch (emailError) {
      await PasswordResetToken.deleteMany({ userId: user._id });
      throw emailError;
    }

    return res.status(200).json({ message: safeMessage });
  } catch (error) {
    console.error("Forgot Password Error:", error.message);

    return res.status(500).json({
      message:
        "Unable to process your request right now. Please try again later.",
    });
  }
};

// =========================
// RESET PASSWORD USING EMAIL LINK
// =========================
const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password, confirmPassword } = req.body;

    if (
      typeof token !== "string" ||
      !/^[a-f0-9]{64}$/i.test(token)
    ) {
      return res.status(400).json({
        message: "This reset link is invalid or expired. Request a new one.",
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
        message: "This reset link is invalid or expired. Request a new one.",
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

    // Change only the password. Preserve email, role and account ID.
    user.password = await bcrypt.hash(password, 12);
    await user.save();

    // Make all outstanding reset links for this account unusable.
    await PasswordResetToken.deleteMany({ userId: user._id });

    return res.status(200).json({
      message:
        "Password changed successfully. Please sign in with your new password.",
    });
  } catch (error) {
    console.error("Reset Password Error:", error.message);

    return res.status(500).json({
      message: "Unable to reset your password right now. Please try again.",
    });
  }
};

// =========================
// EXPORT ALL AUTH FUNCTIONS
// =========================
module.exports = {
  register,
  login,
  googleLogin,
  forgotPassword,
  resetPassword,
};
=======

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

// =========================
// ADMIN PASSWORD VALIDATION
// At least 2 special characters
// =========================
const hasTwoSpecialCharacters = (password) => {
  if (typeof password !== "string") return false;

  const specialCharacters = password.match(/[^A-Za-z0-9]/g) || [];

  return specialCharacters.length >= 2;
};

// =========================
// REGISTER CITIZEN MANUALLY
// =========================
const register = async (req, res) => {
  try {
    const { name, email, password, ward } = req.body;

    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof email !== "string" ||
      !email.trim() ||
      typeof password !== "string" ||
      !password
    ) {
      return res.status(400).json({
        message: "Name, email and password are required",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: "Password must contain at least 8 characters",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        message: "An account with this email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: "citizen",
      ward: typeof ward === "string" ? ward.trim() : "",
      isActive: true,
    });

    const token = generateToken(user);

    return res.status(201).json({
      message: "Citizen registered successfully",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        ward: user.ward,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "An account with this email already exists",
      });
    }

    console.error("Registration Error:", error.message);

    return res.status(500).json({
      message: "Registration failed",
    });
  }
};

// =========================
// LOGIN
// CITIZEN, STAFF, MODERATOR, ADMIN
// =========================
const login = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      typeof role !== "string" ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        message: "Email, password and role are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const databaseRole = role.trim().toLowerCase() === "user"
      ? "citizen"
      : role.trim().toLowerCase();

    if (!["citizen", "staff", "moderator", "admin"].includes(databaseRole)) {
      return res.status(400).json({
        message: "Invalid role",
      });
    }

    // =========================
    // STATIC ADMIN LOGIN
    // Credentials come from backend .env
    // =========================
    if (databaseRole === "admin") {
      const adminEmail = process.env.ADMIN_EMAIL;
      const adminPassword = process.env.ADMIN_PASSWORD;

      console.log("Admin environment diagnostic:", {
  envFileLoaded: Boolean(process.env.ADMIN_EMAIL),
  emailConfigured:
    typeof adminEmail === "string" && adminEmail.trim().length > 0,
  passwordConfigured:
    typeof adminPassword === "string" && adminPassword.length > 0,
  passwordHasTwoSpecialCharacters:
    hasTwoSpecialCharacters(adminPassword || ""),
});

      if (
        typeof adminEmail !== "string" ||
        !adminEmail.trim() ||
        !hasTwoSpecialCharacters(adminPassword)
      ) {
        console.error(
          "Admin login configuration is missing or invalid. Check ADMIN_EMAIL and ADMIN_PASSWORD in the backend .env file."
        );

        return res.status(500).json({
          message: "Admin login is not configured correctly",
        });
      }

      // Compare credentials from the backend environment.
      if (
        normalizedEmail !== adminEmail.trim().toLowerCase() ||
        password !== adminPassword
      ) {
        return res.status(401).json({
          message: "Invalid email, password or role",
        });
      }

      // Require an existing, active Admin record in MongoDB.
      const adminUser = await User.findOne({
        email: adminEmail.trim().toLowerCase(),
        role: "admin",
        isActive: { $ne: false },
      });

      if (!adminUser) {
        console.error(
          "Admin credentials matched, but no active Admin user record was found."
        );

        return res.status(401).json({
          message: "Admin account is not provisioned",
        });
      }

      // Generate the token only after successful validation.
      const token = generateToken(adminUser);

      return res.status(200).json({
        message: "Login successful",
        token,
        user: {
          id: adminUser._id,
          name: adminUser.name,
          email: adminUser.email,
          role: adminUser.role,
          ward: adminUser.ward,
        },
      });
    }

    // =========================
    // NORMAL DATABASE LOGIN
    // CITIZEN, STAFF, MODERATOR
    // =========================
    const user = await User.findOne({
      email: normalizedEmail,
      role: databaseRole,
    });

    if (!user || user.isActive === false) {
      return res.status(401).json({
        message: "Invalid email, password or role",
      });
    }

    if (
      typeof user.password !== "string" ||
      !user.password
    ) {
      return res.status(401).json({
        message: "Invalid email, password or role",
      });
    }

    const passwordMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatch) {
      return res.status(401).json({
        message: "Invalid email, password or role",
      });
    }

    const token = generateToken(user);

    // Email failure must not prevent login.
    try {
      await sendWelcomeEmail(user);
    } catch (emailError) {
      console.error("Welcome email failed:", emailError.message);
    }

    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        ward: user.ward,
      },
    });
  } catch (error) {
    console.error("Login Error:", error.message);

    return res.status(500).json({
      message: "Login failed",
    });
  }
};

// =========================
// GOOGLE LOGIN / SIGNUP
// CITIZENS ONLY
// =========================
const googleLogin = async (req, res) => {
  try {
    const { idToken } = req.body;

    if (typeof idToken !== "string" || !idToken) {
      return res.status(400).json({
        message: "Google ID token is required",
      });
    }

    const decodedToken = await adminAuth.verifyIdToken(idToken);

    if (
      !decodedToken.email ||
      decodedToken.email_verified !== true
    ) {
      return res.status(401).json({
        message: "Please use a verified Google email address",
      });
    }

    const email = decodedToken.email.trim().toLowerCase();
    const name = decodedToken.name || email.split("@")[0];

    let user = await User.findOne({ email });

    if (user) {
      // Google sign-in must never grant staff/admin access.
      if (user.role !== "citizen") {
        return res.status(403).json({
          message:
            "This email belongs to a non-citizen account. Please use the appropriate login method.",
        });
      }

      if (user.isActive === false) {
        return res.status(403).json({
          message:
            "This account is disabled. Please contact support.",
        });
      }
    } else {
      const randomPassword = crypto.randomBytes(48).toString("hex");
      const hashedPassword = await bcrypt.hash(randomPassword, 12);

      user = await User.create({
        name,
        email,
        password: hashedPassword,
        role: "citizen",
        isActive: true,
      });
    }

    const token = generateToken(user);

    return res.status(200).json({
      message: "Google sign-in successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        ward: user.ward,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message:
          "An account with this email already exists. Please try signing in again.",
      });
    }

    console.error("Google Login Error:", error.message);

    return res.status(401).json({
      message: "Google sign-in failed. Please try again.",
    });
  }
};

// =========================
// FORGOT PASSWORD
// ALL ACTIVE ACCOUNT ROLES
// =========================
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const safeMessage =
      "If an account exists for that email, a password reset link will be sent.";

    if (typeof email !== "string" || !email.trim()) {
      return res.status(200).json({
        message: safeMessage,
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({
      email: normalizedEmail,
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

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await PasswordResetToken.create({
      userId: user._id,
      tokenHash,
      expiresAt,
    });

    const frontendUrl = process.env.FRONTEND_URL;

    if (!frontendUrl) {
      await PasswordResetToken.deleteMany({
        userId: user._id,
      });

      throw new Error("FRONTEND_URL is not configured");
    }

    const resetUrl =
      `${frontendUrl.replace(/\/+$/, "")}/reset-password?token=${rawToken}`;

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
    console.error("Forgot Password Error:", error.message);

    return res.status(500).json({
      message:
        "Unable to process your request right now. Please try again later.",
    });
  }
};

// =========================
// RESET PASSWORD USING EMAIL LINK
// =========================
const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password, confirmPassword } = req.body;

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
    console.error("Reset Password Error:", error.message);

    return res.status(500).json({
      message:
        "Unable to reset your password right now. Please try again.",
    });
  }
};

// =========================
// EXPORT ALL AUTH FUNCTIONS
// =========================
module.exports = {
  register,
  login,
  googleLogin,
  forgotPassword,
  resetPassword,
};
>>>>>>> f899dda (Fix admin login configuration)
