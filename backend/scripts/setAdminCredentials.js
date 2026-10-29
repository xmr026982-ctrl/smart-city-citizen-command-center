
require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const connectDB = require("../config/db");

async function setAdminCredentials() {
  try {
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;

    if (!email || !password || password.length < 12) {
      throw new Error(
        "Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 12 characters) in .env."
      );
    }

    await connectDB();

    const existingAdmin = await User.findOne({ role: "admin" });
    const emailOwner = await User.findOne({ email });

    if (
      emailOwner &&
      (!existingAdmin ||
        emailOwner._id.toString() !== existingAdmin._id.toString())
    ) {
      throw new Error(
        "That email belongs to another account. Choose a different ADMIN_EMAIL."
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    if (existingAdmin) {
      existingAdmin.name = "System Administrator";
      existingAdmin.email = email;
      existingAdmin.password = hashedPassword;
      existingAdmin.isActive = true;
      await existingAdmin.save();
    } else {
      await User.create({
        name: "System Administrator",
        email,
        password: hashedPassword,
        role: "admin",
        isActive: true,
      });
    }

    console.log("Admin credentials saved successfully.");
    console.log("Admin email:", email);
    console.log("Use the password you set in your .env file.");
  } catch (error) {
    console.error("Admin setup failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
}

setAdminCredentials();