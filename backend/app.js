const path = require("path");
const cors = require("cors");
const express = require("express");
const routes = require("./routes");

const app = express();

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.resolve("uploads")));
app.use("/api", routes);
app.get("/health", (_req, res) => res.json({ ok: true }));

module.exports = app;