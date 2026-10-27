const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const {
  getStaffDashboard,
} = require("../controllers/staffController");

const router = express.Router();

router.get(
  "/dashboard",
  authMiddleware,
  roleMiddleware("staff"),
  getStaffDashboard
);

module.exports = router;