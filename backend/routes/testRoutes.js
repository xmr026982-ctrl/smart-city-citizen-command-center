const express = require("express");

const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const router = express.Router();

router.get(
  "/admin",
  protect,
  authorizeRoles("admin"),
  (req, res) => {
    res.json({
      message: "Welcome Admin!",
      user: req.user
    });
  }
);

router.get(
  "/moderator",
  protect,
  authorizeRoles("admin", "moderator"),
  (req, res) => {
    res.json({
      message: "Welcome Moderator!",
      user: req.user
    });
  }
);

module.exports = router;