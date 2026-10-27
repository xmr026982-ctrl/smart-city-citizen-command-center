
require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const readline = require("readline");

const User = require("../models/User");
const connectDB = require("../config/db");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const ask = (question) =>
  new Promise((resolve) => rl.question(question, resolve));

async function createAdmin() {
  try {
    const email = (await ask("Enter admin email: "))
      .trim()
      .toLowerCase();

    const password = await ask("Enter a strong admin password: ");

    if (!email || !password || password.length < 8) {
      throw new Error(
        "Email is required and password must be at least 8 characters."
      );
    }

    await connectDB();

    const existingAdmin = await User.findOne({
      role: "admin",
    });

    if (existingAdmin) {
      throw new Error(
        `An admin account already exists: ${existingAdmin.email}`
      );
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      throw new Error(
        "This email already belongs to another account. Use a different email."
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const admin = await User.create({
      name: "System Administrator",
      email,
      password: hashedPassword,
      role: "admin",
      isActive: true,
    });

    console.log("\nAdmin account created successfully!");
    console.log("Admin email:", admin.email);
    console.log("Role:", admin.role);
    console.log("You can now log in through your Admin Login page.");
  } catch (error) {
    console.error("\nAdmin setup failed:", error.message);
    process.exitCode = 1;
  } finally {
    rl.close();
    await mongoose.disconnect().catch(() => {});
  }
}

createAdmin().catch((error) => {
  console.error("Unexpected error:", error.message);
  process.exitCode = 1;
});
