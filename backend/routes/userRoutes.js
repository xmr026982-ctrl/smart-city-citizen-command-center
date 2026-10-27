const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const {
  getMyProfile,
} = require("../controllers/userController");

const router = express.Router();

router.get(
  "/profile",
  authMiddleware,
  roleMiddleware("citizen"),
  getMyProfile
);

module.exports = router;