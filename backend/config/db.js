
const mongoose = require("mongoose");

const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing from environment variables.");
  }

  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 10,
    });

    console.log("MongoDB Atlas connected successfully.");

    return mongoose.connection;
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    throw error;
  }
};

module.exports = connectDB;
