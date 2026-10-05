const bcrypt = require("bcryptjs");

const User = require("../models/User");
const { generateToken } = require("../services/jwtService");
const { sendWelcomeEmail } = require("../services/emailService");

// =========================
// REGISTER CITIZEN
// =========================

const register = async (req, res) => {
  try {
    const { name, email, password, ward } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email and password are required",
      });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        message: "User already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
  name,
  email,
  password: hashedPassword,
  role: "citizen",
  ward: ward || "",
});

 

    const token = generateToken(user);

    res.status(201).json({
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
    console.error("Registration Error:", error);

    res.status(500).json({
      message: "Registration failed",
    });
  }
};

// =========================
// LOGIN
// =========================

const login = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password || !role) {
      return res.status(400).json({
        message: "Email, password and role are required",
      });
    }

    // Frontend "user" means backend "citizen"
    const databaseRole = role === "user" ? "citizen" : role;

    const user = await User.findOne({
      email,
      role: databaseRole,
    });

    if (!user) {
      return res.status(401).json({
        message: "Invalid email, password or role",
      });
    }

    // Check password
    const passwordMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatch) {
      return res.status(401).json({
        message: "Invalid email, password or role",
      });
    }

    // =========================
    // SEND WELCOME EMAIL
    // =========================

    try {
      await sendWelcomeEmail(user);

      console.log(
        `Welcome email sent to ${user.email}`
      );
    } catch (emailError) {
      // Email failure should NOT stop the login
      console.error(
        "Welcome email failed:",
        emailError.message
      );
    }

    // =========================
    // GENERATE JWT
    // =========================

    const token = generateToken(user);

    // =========================
    // LOGIN RESPONSE
    // =========================

    res.json({
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
    console.error("Login Error:", error);

    res.status(500).json({
      message: "Login failed",
    });
  }
};

// =========================
// EXPORT
// =========================

module.exports = {
  register,
  login,
};