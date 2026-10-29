
require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const connectDB = require("./config/db");
const User = require("./models/User");

const accounts = [
  {
    name: "Priti Sarkar",
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
    role: "admin",
  },
  {
    name: "Koushik Bhowmik",
    email: process.env.STAFF1_EMAIL,
    password: process.env.STAFF1_PASSWORD,
    role: "staff",
    department: "Civic",
  },
  {
    name: "Subhomoy Ghosh",
    email: process.env.STAFF2_EMAIL,
    password: process.env.STAFF2_PASSWORD,
    role: "staff",
    department: "Electrical",
  },
  // {
  //   name: "Taras Hembram",
  //   email: process.env.STAFF3_EMAIL,
  //   password: process.env.STAFF3_PASSWORD,
  //   role: "staff",
  //   department: "Roads",
  // },
  // {
  //   name: "Sayan Majumder",
  //   email: process.env.STAFF4_EMAIL,
  //   password: process.env.STAFF4_PASSWORD,
  //   role: "staff",
  //   department: "Water",
  // },
  // {
  //   name: "Swarup Sutradhar",
  //   email: process.env.STAFF5_EMAIL,
  //   password: process.env.STAFF5_PASSWORD,
  //   role: "staff",
  //   department: "Waste",
  // },
];

async function createAccounts() {
  try {
    const missing = accounts.filter(
      (account) =>
        !account.name ||
        !account.email ||
        !account.password ||
        account.password.startsWith("SET_A_NEW_")
    );

    if (missing.length > 0) {
      throw new Error(
        "Missing account settings in .env. Check ADMIN_EMAIL, ADMIN_PASSWORD, STAFF1-5_EMAIL and STAFF1-5_PASSWORD."
      );
    }

    await connectDB();

    for (const account of accounts) {
      const email = account.email.trim().toLowerCase();

      const existingUser = await User.findOne({ email });

      const hashedPassword = await bcrypt.hash(
        account.password,
        12
      );

      if (existingUser) {
        existingUser.name = account.name;
        existingUser.password = hashedPassword;
        existingUser.role = account.role;
        existingUser.isActive = true;

        if (account.department) {
          existingUser.department = account.department;
        }

        await existingUser.save();

        console.log(`Updated account: ${email}`);
      } else {
        await User.create({
          name: account.name,
          email,
          password: hashedPassword,
          role: account.role,
          department: account.department || "",
          isActive: true,
        });

        console.log(`Created account: ${email}`);
      }
    }

    console.log("Admin and staff accounts are ready.");
  } catch (error) {
    console.error("Account setup failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

createAccounts();