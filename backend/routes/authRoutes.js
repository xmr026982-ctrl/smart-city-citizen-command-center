const express = require("express");
const router = express.Router();

const {
  register,
  login,
  googleLogin,
  forgotPassword,
  resetPassword,
  getMe,
  logout,
  activity,
} = require("../controllers/authController");

const protect = require("../middleware/authMiddleware");

// Public
router.post("/register", register);
router.post("/login", login);
router.post("/google", googleLogin);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);

// Protected
router.get("/me", protect, getMe);
router.post("/logout", protect, logout);
router.post("/activity", protect, activity);

module.exports = router;