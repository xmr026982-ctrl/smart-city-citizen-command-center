const express = require("express");
const router = express.Router();

const protect = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const {
  getStaffDashboard,
} = require("../controllers/staffController");

router.get(
  "/dashboard",
  protect,
  roleMiddleware("staff"),
  getStaffDashboard
);

module.exports = router;