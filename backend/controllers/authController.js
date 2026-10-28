
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
// HELPERS
// =========================

// Return safe user details without exposing the password.
const getPublicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  ward: user.ward || "",
});

// =========================
// REGISTER CITIZEN
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
        message: "Name, email and password are required.",
      });
    }

    // Citizen password rule remains unchanged.
    if (password.length < 8) {
      return res.status(400).json({
        message: "Password must contain at least 8 characters.",
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
      message: "Citizen registered successfully.",
      token,
      user: getPublicUser(user),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "An account with this email already exists.",
      });
    }

    console.error("Registration Error:", error.message);

    return res.status(500).json({
      message: "Registration failed. Please try again.",
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
      !password ||
      !role.trim()
    ) {
      return res.status(400).json({
        message: "Email, password and role are required.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedRole = role.trim().toLowerCase();

    // Support frontend role name "user".
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

    // =========================
    // STATIC ADMIN LOGIN
    // =========================
    if (databaseRole === "admin") {
      const adminEmail = process.env.ADMIN_EMAIL;
      const adminPassword = process.env.ADMIN_PASSWORD;

      // No special-character requirement for the static admin.
      if (
        typeof adminEmail !== "string" ||
        !adminEmail.trim() ||
        typeof adminPassword !== "string" ||
        !adminPassword
      ) {
        console.error("Admin login configuration is invalid.");

        return res.status(500).json({
          message: "Admin login is not configured correctly.",
        });
      }

      const normalizedAdminEmail = adminEmail.trim().toLowerCase();

     const emailMatches =
  normalizedEmail === normalizedAdminEmail;

const passwordMatches =
  password === adminPassword;

console.log("Admin login diagnostic:", {
  emailMatches,
  passwordMatches,
  configuredEmailExists: Boolean(normalizedAdminEmail),
  configuredPasswordExists: Boolean(adminPassword),
});

if (!emailMatches || !passwordMatches) {
  return res.status(401).json({
    message: "Invalid email, password or role.",
  });
}
      // The configured admin must also have an active database record.
     const adminUser = await User.findOne({
  role: "admin",
  isActive: { $ne: false },
  $expr: {
    $eq: [
      {
        $toLower: {
          $trim: {
            input: "$email",
          },
        },
      },
      normalizedAdminEmail,
    ],
  },
});

if (!adminUser) {
  console.error(
    "Admin account lookup failed. Check the MongoDB database and admin email."
  );

  return res.status(403).json({
    message:
      "Admin account is not provisioned or is disabled. Contact the system administrator.",
  });
}
      const token = generateToken(adminUser);

      return res.status(200).json({
        message: "Admin login successful.",
        token,
        user: getPublicUser(adminUser),
      });
    }

    // =========================
    // DATABASE LOGIN
    // CITIZEN, STAFF, MODERATOR
    // =========================
    const user = await User.findOne({
      email: normalizedEmail,
      role: databaseRole,
    });

    if (!user || user.isActive === false) {
      return res.status(401).json({
        message: "Invalid email, password or role.",
      });
    }

    if (typeof user.password !== "string" || !user.password) {
      return res.status(401).json({
        message: "Invalid email, password or role.",
      });
    }

    // Staff login already has no special-character requirement.
    const passwordMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatch) {
      return res.status(401).json({
        message: "Invalid email, password or role.",
      });
    }

    const token = generateToken(user);

    // Email failure must not invalidate a successful login.
    if (user.role === "citizen") {
      try {
        await sendWelcomeEmail(user);
      } catch (emailError) {
        console.error(
          "Welcome email failed:",
          emailError.message
        );
      }
    }

    return res.status(200).json({
      message: "Login successful.",
      token,
      user: getPublicUser(user),
    });
  } catch (error) {
    console.error("Login Error:", error.message);

    return res.status(500).json({
      message: "Login failed. Please try again.",
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

    let user = await User.findOne({ email });

    if (user) {
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
      message: "Google sign-in successful.",
      token,
      user: getPublicUser(user),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message:
          "An account with this email already exists. Please sign in again.",
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
    console.error("Forgot Password Error:", error.message);

    return res.status(500).json({
      message:
        "Unable to process your request right now. Please try again later.",
    });
  }
};

// =========================
// RESET PASSWORD
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
// EXPORT CONTROLLER FUNCTIONS
// =========================
module.exports = {
  register,
  login,
  googleLogin,
  forgotPassword,
  resetPassword,
};
