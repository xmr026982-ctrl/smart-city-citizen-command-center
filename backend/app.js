const express = require("express");
const cors = require("cors");

const issueRoutes = require("./routes/issueRoutes");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Test route
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Smart City Backend is running",
  });
});

// Issue routes
app.use("/api/issues", issueRoutes);

module.exports = app;