
require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const connectDB = require("../config/db");
const User = require("../models/User");

const staffAccounts = [
  {
    email: process.env.STAFF1_EMAIL,
    password: process.env.STAFF1_PASSWORD,
  },
  {
    email: process.env.STAFF2_EMAIL,
    password: process.env.STAFF2_PASSWORD,
  },
  {
    email: process.env.STAFF3_EMAIL,
    password: process.env.STAFF3_PASSWORD,
  },
  {
    email: process.env.STAFF4_EMAIL,
    password: process.env.STAFF4_PASSWORD,
  },
  {
    email: process.env.STAFF5_EMAIL,
    password: process.env.STAFF5_PASSWORD,
  },
];

async function createStaffAccounts() {
  try {
    await connectDB();

    for (let i = 0; i < staffAccounts.length; i++) {
      const staff = staffAccounts[i];

      if (!staff.email || !staff.password) {
        throw new Error(
          `Missing email or password for staff account ${i + 1}. Check your .env file.`
        );
      }

      if (staff.password.length < 12) {
        throw new Error(
          `Password for staff account ${i + 1} must be at least 12 characters.`
        );
      }

      const email = staff.email.trim().toLowerCase();

      let existingUser = await User.findOne({ email });

      if (existingUser && existingUser.role !== "staff") {
        throw new Error(
          `${email} already belongs to a non-staff account.`
        );
      }

      const hashedPassword = await bcrypt.hash(staff.password, 12);

      if (existingUser) {
        existingUser.password = hashedPassword;
        existingUser.isActive = true;
        await existingUser.save();

        console.log(`Updated staff account ${i + 1}: ${email}`);
      } else {
        await User.create({
          name: `Staff ${i + 1}`,
          email,
          password: hashedPassword,
          role: "staff",
          isActive: true,
        });

        console.log(`Created staff account ${i + 1}: ${email}`);
      }
    }

    console.log("All five staff accounts are ready.");
  } catch (error) {
    console.error("Staff account setup failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

createStaffAccounts();