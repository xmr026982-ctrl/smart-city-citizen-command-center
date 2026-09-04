require("dotenv").config();

const bcrypt = require("bcryptjs");
const connectDB = require("./config/db");
const User = require("./models/User");

const createModerator = async () => {
  try {
    await connectDB();

    const email = "moderator2@smartcity.com";
    const password = "Moderator2@12345";

    const existingModerator = await User.findOne({
      email
    });

    if (existingModerator) {
      console.log("Moderator already exists.");
      process.exit(0);
    }

    const hashedPassword = await bcrypt.hash(
      password,
      12
    );

    const moderator = await User.create({
      name: "City Moderator 2",
      email,
      password: hashedPassword,
      role: "moderator",
      ward: "Central",
      isActive: true
    });

    console.log("Moderator created.");
    console.log("Email:", moderator.email);
    console.log("Password:", password);

    process.exit(0);
  } catch (error) {
    console.error(
      "Moderator creation failed:",
      error
    );

    process.exit(1);
  }
};

createModerator();