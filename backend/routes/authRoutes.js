
const express = require("express");
const router = express.Router();

const {
  register,
  login,
  googleLogin,
  forgotPassword,
  resetPassword,
} = require("../controllers/authController");

// Citizen registration and login
router.post("/register", register);
router.post("/login", login);

// Google authentication
router.post("/google", googleLogin);

// Password reset
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);

module.exports = router;
