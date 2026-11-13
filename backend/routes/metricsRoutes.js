const express = require("express");
const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const { getLiveMetrics } = require("../controllers/metricsController");

const router = express.Router();

router.get(
  "/live",
  protect,
  authorizeRoles("admin", "staff", "citizen"),
  getLiveMetrics
);

module.exports = router;