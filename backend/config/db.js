const mongoose = require("mongoose");

async function connectDB() {
  const url = process.env.MONGO_URL;
  if (!url) throw new Error("MONGO_URL is missing");
  await mongoose.connect(url);
  console.log("Mongo connected");
}

module.exports = connectDB;