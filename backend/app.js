const path = require("path");
const cors = require("cors");
const express = require("express");
const routes = require("./routes");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// All API routes
app.use("/api", routes);

// Test route
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Smart City Backend is running",
  });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

module.exports = app;